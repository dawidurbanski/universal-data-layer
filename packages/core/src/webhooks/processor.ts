/**
 * Webhook Batch Processor
 *
 * Listens to webhook queue events and invokes the appropriate handlers.
 * Also runs lifecycle hooks before and after batch processing.
 */

import type { IncomingMessage, ServerResponse } from 'node:http';
import { EventEmitter } from 'node:events';
import { defaultWebhookRegistry } from './registry.js';
import {
  defaultWebhookQueue,
  type QueuedWebhook,
  type WebhookBatch,
} from './queue.js';
import { getWebhookHooks } from './hooks.js';
import { defaultStore } from '@/nodes/defaultStore.js';
import { createNodeActions } from '@/nodes/actions/index.js';
import type { WebhookHandlerContext } from './types.js';
import { DEFAULT_WEBHOOK_PATH } from './default-handler.js';

/**
 * Create a minimal mock IncomingMessage for queued webhook processing.
 * The handler already sent the real HTTP response (202), so this is just
 * for API compatibility with existing handler signatures.
 */
function createMockRequest(webhook: QueuedWebhook): IncomingMessage {
  const emitter = new EventEmitter();
  return Object.assign(emitter, {
    method: 'POST',
    url: `/_webhooks/${webhook.pluginName}/${DEFAULT_WEBHOOK_PATH}`,
    headers: webhook.headers,
    httpVersion: '1.1',
    httpVersionMajor: 1,
    httpVersionMinor: 1,
    complete: true,
    connection: null,
    socket: null,
    aborted: false,
    rawHeaders: [],
    trailers: {},
    rawTrailers: [],
    setTimeout: () => emitter,
    destroy: () => emitter,
  }) as unknown as IncomingMessage;
}

/**
 * Create a minimal mock ServerResponse for queued webhook processing.
 * The handler already sent the real HTTP response (202), so this captures
 * any response the handler tries to send (which will be ignored).
 */
function createMockResponse(): ServerResponse {
  const emitter = new EventEmitter();
  let headersSent = false;

  return Object.assign(emitter, {
    statusCode: 200,
    statusMessage: 'OK',
    headersSent,
    get writableEnded() {
      return headersSent;
    },
    writeHead(_statusCode: number, _headers?: Record<string, string>) {
      headersSent = true;
      return this;
    },
    setHeader: () => emitter,
    getHeader: () => undefined,
    removeHeader: () => undefined,
    write: () => true,
    end: () => {
      headersSent = true;
      return emitter;
    },
    flushHeaders: () => undefined,
    addTrailers: () => undefined,
    setTimeout: () => emitter,
    destroy: () => emitter,
    cork: () => undefined,
    uncork: () => undefined,
    assignSocket: () => undefined,
    detachSocket: () => undefined,
    writeContinue: () => undefined,
    writeEarlyHints: () => undefined,
    writeProcessing: () => undefined,
  }) as unknown as ServerResponse;
}

/**
 * Process a single webhook from the queue.
 *
 * @param webhook - The queued webhook to process
 */
async function processWebhook(webhook: QueuedWebhook): Promise<void> {
  const handler = defaultWebhookRegistry.getHandler(webhook.pluginName);

  if (!handler) {
    console.warn(
      `⚠️ Handler not found for queued webhook: ${webhook.pluginName}`
    );
    return;
  }

  // Create context for the handler
  const actions = createNodeActions({
    store: defaultStore,
    owner: webhook.pluginName,
  });
  const context: WebhookHandlerContext = {
    store: defaultStore,
    actions,
    rawBody: webhook.rawBody,
    body: webhook.body,
  };

  // Create mock req/res for handler compatibility
  const mockReq = createMockRequest(webhook);
  const mockRes = createMockResponse();

  try {
    await handler.handler(mockReq, mockRes, context);
  } catch (error) {
    console.error(`❌ Error processing webhook ${webhook.pluginName}:`, error);
    // Don't rethrow - continue processing other webhooks in the batch
  }
}

/**
 * Initialize the webhook processor.
 * Sets up event listeners on the default webhook queue.
 *
 * This should be called once during server startup.
 */
export function initializeWebhookProcessor(): void {
  // Listen for individual webhook processing
  defaultWebhookQueue.on('webhook:process', (webhook: QueuedWebhook) => {
    // Process asynchronously but don't await
    void processWebhook(webhook);
  });

  // Listen for batch completion to run hooks
  defaultWebhookQueue.on(
    'webhook:batch-complete',
    async (batch: WebhookBatch) => {
      const hooks = getWebhookHooks();

      // Run onAfterWebhookTriggered hook
      if (hooks.onAfterWebhookTriggered) {
        try {
          console.log('🪝 Running onAfterWebhookTriggered hook...');
          await hooks.onAfterWebhookTriggered({
            batch,
            store: defaultStore,
          });
        } catch (error) {
          console.error('❌ onAfterWebhookTriggered hook error:', error);
        }
      }
    }
  );

  // Listen for batch errors
  defaultWebhookQueue.on(
    'webhook:batch-error',
    (error: { webhooks: QueuedWebhook[]; error: Error }) => {
      console.error(
        `❌ Batch processing failed for ${error.webhooks.length} webhooks:`,
        error.error
      );
    }
  );

  console.log('🔗 Webhook processor initialized');
}

/**
 * Process a batch of webhooks with lifecycle hooks.
 * This is called by the queue before emitting individual webhook:process events.
 *
 * @param webhooks - The webhooks to process
 * @returns The processed batch
 */
export async function processWebhookBatch(
  webhooks: QueuedWebhook[]
): Promise<WebhookBatch> {
  const startedAt = Date.now();
  const hooks = getWebhookHooks();

  // Create the batch object
  const batch: WebhookBatch = {
    webhooks,
    startedAt,
    completedAt: 0,
  };

  // Run onBeforeWebhookTriggered hook
  if (hooks.onBeforeWebhookTriggered) {
    try {
      console.log('🪝 Running onBeforeWebhookTriggered hook...');
      await hooks.onBeforeWebhookTriggered({
        batch,
        store: defaultStore,
      });
    } catch (error) {
      console.error('❌ onBeforeWebhookTriggered hook error:', error);
      // Continue processing despite hook error
    }
  }

  // Process each webhook
  for (const webhook of webhooks) {
    await processWebhook(webhook);
  }

  batch.completedAt = Date.now();
  return batch;
}
