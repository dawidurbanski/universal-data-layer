/**
 * Webhook HTTP Handler
 *
 * Routes incoming webhook requests to the appropriate plugin handler.
 * URL format: POST /_webhooks/{pluginName}/{path}
 */

import type { IncomingMessage, ServerResponse } from 'node:http';
import { defaultWebhookRegistry } from '@/webhooks/index.js';
import { defaultStore } from '@/nodes/defaultStore.js';
import { createNodeActions } from '@/nodes/actions/index.js';
import type { WebhookHandlerContext } from '@/webhooks/index.js';

/** URL path prefix for webhook endpoints */
export const WEBHOOK_PATH_PREFIX = '/_webhooks/';

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
 * Parse the webhook URL to extract plugin name and path.
 *
 * @param url - The full request URL (e.g., "/_webhooks/contentful/entry-update")
 * @returns Object with pluginName and webhookPath, or null if invalid
 */
export function parseWebhookUrl(
  url: string
): { pluginName: string; webhookPath: string } | null {
  if (!isWebhookRequest(url)) {
    return null;
  }

  // Remove prefix and any query string
  const urlPath = url.slice(WEBHOOK_PATH_PREFIX.length);
  const pathWithoutPrefix = urlPath.split('?')[0] ?? urlPath;
  const parts = pathWithoutPrefix.split('/');

  // Need at least plugin name and one path segment
  if (parts.length < 2 || !parts[0] || !parts[1]) {
    return null;
  }

  return {
    pluginName: parts[0],
    webhookPath: parts.slice(1).join('/'),
  };
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

  // Parse the URL to get plugin name and path
  const parsed = parseWebhookUrl(req.url || '');
  if (!parsed) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Invalid webhook URL format' }));
    return;
  }

  const { pluginName, webhookPath } = parsed;

  // Look up the registered handler
  const handler = defaultWebhookRegistry.getHandler(pluginName, webhookPath);
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

  // Verify signature if handler requires it
  if (handler.verifySignature) {
    try {
      const isValid = await handler.verifySignature(req, rawBody);
      if (!isValid) {
        console.warn(
          `Webhook signature verification failed: ${pluginName}/${webhookPath}`
        );
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid signature' }));
        return;
      }
    } catch (error) {
      console.error(
        `Webhook signature verification error: ${pluginName}/${webhookPath}`,
        error
      );
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

  // Create context for the handler
  const actions = createNodeActions(defaultStore, pluginName);
  const context: WebhookHandlerContext = {
    store: defaultStore,
    actions,
    rawBody,
    body,
  };

  console.log(`Webhook received: ${pluginName}/${webhookPath}`);

  // Call the handler
  try {
    await handler.handler(req, res, context);
  } catch (error) {
    console.error(`Webhook handler error: ${pluginName}/${webhookPath}`, error);
    // Only send error response if headers haven't been sent
    if (!res.headersSent) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Internal server error' }));
    }
  }
}
