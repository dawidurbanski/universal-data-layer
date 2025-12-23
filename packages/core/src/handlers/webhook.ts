/**
 * Webhook HTTP Handler
 *
 * Routes incoming webhook requests to the appropriate plugin handler.
 * URL format: POST /_webhooks/{pluginName}/sync
 *
 * Webhooks are queued and processed in batches after a debounce period.
 * This prevents N rapid webhooks from triggering N separate processing cycles.
 */

import type { IncomingMessage, ServerResponse } from 'node:http';
import {
  defaultWebhookRegistry,
  defaultWebhookQueue,
  getWebhookHooks,
  type QueuedWebhook,
} from '@/webhooks/index.js';
import { defaultStore } from '@/nodes/defaultStore.js';

/** URL path prefix for webhook endpoints */
export const WEBHOOK_PATH_PREFIX = '/_webhooks/';

/** Pattern for webhook URLs: /_webhooks/{plugin-name}/sync (supports scoped packages like @org/name) */
const WEBHOOK_PATTERN = /^\/_webhooks\/(.+)\/sync(?:\?.*)?$/;

/** Maximum request body size (1MB) */
const MAX_BODY_SIZE = 1024 * 1024;

/**
 * Check if a URL is a webhook request.
 *
 * @param url - The request URL to check
 * @returns True if the URL starts with the webhook path prefix
 */
export function isWebhookRequest(url: string): boolean {
  return url.startsWith(WEBHOOK_PATH_PREFIX);
}

/**
 * Extract the plugin name from a webhook URL.
 *
 * @param url - The full request URL (e.g., "/_webhooks/contentful/sync")
 * @returns The plugin name, or null if invalid format
 */
export function getPluginFromWebhookUrl(url: string): string | null {
  // URL-decode the path to handle encoded characters like %40 for @
  const decodedUrl = decodeURIComponent(url);
  const match = decodedUrl.match(WEBHOOK_PATTERN);
  if (!match) {
    return null;
  }
  return match[1] || null;
}

/**
 * Collect the request body as a Buffer.
 *
 * @param req - The incoming HTTP request
 * @returns Promise resolving to the body Buffer
 * @throws Error if body exceeds MAX_BODY_SIZE
 */
export async function collectRequestBody(
  req: IncomingMessage
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let totalSize = 0;

    req.on('data', (chunk: Buffer) => {
      totalSize += chunk.length;
      if (totalSize > MAX_BODY_SIZE) {
        req.destroy();
        reject(new Error('Request body too large'));
        return;
      }
      chunks.push(chunk);
    });

    req.on('end', () => {
      resolve(Buffer.concat(chunks));
    });

    req.on('error', reject);
  });
}

/**
 * Main webhook HTTP handler.
 *
 * Routes incoming webhook requests to the appropriate plugin handler
 * based on the URL path.
 *
 * @param req - The incoming HTTP request
 * @param res - The server response
 */
export async function webhookHandler(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  // Only accept POST requests
  if (req.method !== 'POST') {
    res.writeHead(405, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Method not allowed' }));
    return;
  }

  // Extract plugin name from URL
  const pluginName = getPluginFromWebhookUrl(req.url || '');
  if (!pluginName) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        error:
          'Invalid webhook URL format. Expected: /_webhooks/{plugin-name}/sync',
      })
    );
    return;
  }

  // Look up the registered handler
  const handler = defaultWebhookRegistry.getHandler(pluginName);
  if (!handler) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Webhook handler not found' }));
    return;
  }

  // Collect request body
  let rawBody: Buffer;
  try {
    rawBody = await collectRequestBody(req);
  } catch (error) {
    if (error instanceof Error && error.message === 'Request body too large') {
      res.writeHead(413, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Payload too large' }));
      return;
    }
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Failed to read request body' }));
    return;
  }

  // Verify signature if handler has verification configured
  if (handler.verifySignature) {
    try {
      const isValid = await handler.verifySignature(req, rawBody);
      if (!isValid) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid signature' }));
        return;
      }
    } catch (error) {
      console.error('Signature verification error:', error);
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Signature verification failed' }));
      return;
    }
  }

  // Parse JSON body if content-type indicates JSON
  let body: unknown = undefined;
  const contentType = req.headers['content-type'] || '';
  if (contentType.includes('application/json')) {
    try {
      body = JSON.parse(rawBody.toString('utf-8'));
    } catch {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid JSON body' }));
      return;
    }
  }

  console.log(`Webhook received: ${pluginName}/sync`);

  // Create the queued webhook object
  let queuedWebhook: QueuedWebhook = {
    pluginName,
    rawBody,
    body,
    headers: req.headers as Record<string, string | string[] | undefined>,
    timestamp: Date.now(),
  };

  // Run onWebhookReceived hook if configured
  const hooks = getWebhookHooks();
  if (hooks.onWebhookReceived) {
    try {
      console.log('🪝 Running onWebhookReceived hook...');
      const result = await hooks.onWebhookReceived({
        webhook: queuedWebhook,
        store: defaultStore,
      });

      if (result === null) {
        // Hook returned null, skip this webhook
        console.log('⏭️ Webhook skipped by onWebhookReceived hook');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ skipped: true }));
        return;
      }

      // Use the transformed webhook
      queuedWebhook = result;
    } catch (error) {
      console.error('❌ onWebhookReceived hook error:', error);
      // Continue with original webhook despite hook error
    }
  }

  // Queue the webhook for batch processing
  defaultWebhookQueue.enqueue(queuedWebhook);

  // Respond immediately with 202 Accepted
  res.writeHead(202, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ queued: true }));
}
