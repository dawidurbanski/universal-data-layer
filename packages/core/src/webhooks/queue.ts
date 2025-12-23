/**
 * Webhook Queue with Debouncing
 *
 * Batches incoming webhooks and processes them after a configurable quiet period.
 * This prevents N rapid webhook events from triggering N separate processing cycles.
 */

import { EventEmitter } from 'node:events';

/**
 * A webhook that has been queued for batch processing.
 */
export interface QueuedWebhook {
  /** Name of the plugin that registered this webhook handler */
  pluginName: string;
  /** Raw request body buffer */
  rawBody: Buffer;
  /** Parsed JSON body (if applicable) */
  body: unknown;
  /** Request headers */
  headers: Record<string, string | string[] | undefined>;
  /** Timestamp when the webhook was received */
  timestamp: number;
}

/**
 * A batch of webhooks that were processed together.
 */
export interface WebhookBatch {
  /** The webhooks that were processed in this batch */
  webhooks: QueuedWebhook[];
  /** Timestamp when batch processing started */
  startedAt: number;
  /** Timestamp when batch processing completed */
  completedAt: number;
}

/**
 * Batch processor function type.
 * Called to process a batch of webhooks with lifecycle hooks.
 */
export type BatchProcessorFn = (
  webhooks: QueuedWebhook[]
) => Promise<WebhookBatch>;

/**
 * Configuration options for the webhook queue.
 */
export interface WebhookQueueConfig {
  /**
   * Debounce period in milliseconds.
   * After each webhook, the queue waits this long for more webhooks before processing.
   * @default 5000
   */
  debounceMs?: number;

  /**
   * Maximum queue size before forced processing.
   * When the queue reaches this size, it will process immediately regardless of debounce.
   * @default 100
   */
  maxQueueSize?: number;

  /**
   * Custom batch processor function.
   * If provided, this function is called to process webhooks instead of the default event emission.
   * This allows for lifecycle hooks integration.
   */
  batchProcessor?: BatchProcessorFn;
}

/**
 * Events emitted by the WebhookQueue.
 */
export interface WebhookQueueEvents {
  /** Emitted immediately when a webhook is queued (before debounce) */
  'webhook:queued': (webhook: QueuedWebhook) => void;
  /** Emitted for each webhook when batch processing occurs */
  'webhook:process': (webhook: QueuedWebhook) => void;
  /** Emitted after a batch of webhooks has been processed successfully */
  'webhook:batch-complete': (batch: WebhookBatch) => void;
  /** Emitted when batch processing encounters an error */
  'webhook:batch-error': (error: {
    webhooks: QueuedWebhook[];
    error: Error;
  }) => void;
}

/**
 * Webhook queue that batches incoming webhooks and processes them after a quiet period.
 *
 * @example
 * ```typescript
 * const queue = new WebhookQueue({ debounceMs: 5000 });
 *
 * queue.on('webhook:process', (webhook) => {
 *   console.log(`Processing webhook: ${webhook.pluginName}/${webhook.path}`);
 * });
 *
 * queue.on('webhook:batch-complete', (batch) => {
 *   console.log(`Batch complete: ${batch.webhooks.length} webhooks processed`);
 * });
 *
 * // Webhooks are queued and processed together after 5 seconds of quiet
 * queue.enqueue(webhook1);
 * queue.enqueue(webhook2); // Resets the 5 second timer
 * queue.enqueue(webhook3); // Resets the 5 second timer again
 * // ... 5 seconds later, all 3 are processed in one batch
 * ```
 */
export class WebhookQueue extends EventEmitter {
  private queue: QueuedWebhook[] = [];
  private debounceTimer: NodeJS.Timeout | null = null;
  private debounceMs: number;
  private maxQueueSize: number;
  private isProcessing: boolean = false;
  private batchProcessor: BatchProcessorFn | undefined;

  constructor(config: WebhookQueueConfig = {}) {
    super();
    this.debounceMs = config.debounceMs ?? 5000;
    this.maxQueueSize = config.maxQueueSize ?? 100;
    this.batchProcessor = config.batchProcessor ?? undefined;
  }

  /**
   * Set the batch processor function.
   * This is called during server initialization to wire up the processor.
   *
   * @param processor - The batch processor function
   */
  setBatchProcessor(processor: BatchProcessorFn): void {
    this.batchProcessor = processor;
  }

  /**
   * Add a webhook to the queue. Resets the debounce timer.
   *
   * @param webhook - The webhook to queue for processing
   */
  enqueue(webhook: QueuedWebhook): void {
    this.queue.push(webhook);
    console.log(
      `📥 Webhook queued: ${webhook.pluginName} (${this.queue.length} in queue)`
    );

    // Emit immediately for instant relay to WebSocket subscribers
    this.emit('webhook:queued', webhook);

    // Check if we've hit max queue size
    if (this.queue.length >= this.maxQueueSize) {
      console.log(
        `📦 Queue reached max size (${this.maxQueueSize}), processing immediately`
      );
      if (this.debounceTimer) {
        clearTimeout(this.debounceTimer);
        this.debounceTimer = null;
      }
      void this.processBatch();
      return;
    }

    // Reset debounce timer
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(() => {
      void this.processBatch();
    }, this.debounceMs);
  }

  /**
   * Process all queued webhooks as a batch.
   */
  private async processBatch(): Promise<void> {
    if (this.queue.length === 0 || this.isProcessing) {
      return;
    }

    this.isProcessing = true;
    const webhooks = [...this.queue];
    this.queue = [];
    this.debounceTimer = null;

    const startedAt = Date.now();
    console.log(`⚡ Processing webhook batch: ${webhooks.length} webhooks`);

    try {
      let batch: WebhookBatch;

      if (this.batchProcessor) {
        // Use the batch processor for full lifecycle hook support
        batch = await this.batchProcessor(webhooks);
      } else {
        // Fallback to event-based processing
        for (const webhook of webhooks) {
          this.emit('webhook:process', webhook);
        }

        const completedAt = Date.now();
        batch = {
          webhooks,
          startedAt,
          completedAt,
        };
      }

      // Emit batch complete event for outbound webhook triggering
      this.emit('webhook:batch-complete', batch);

      console.log(
        `✅ Webhook batch complete: ${webhooks.length} processed in ${batch.completedAt - startedAt}ms`
      );
    } catch (error) {
      console.error('❌ Webhook batch processing error:', error);
      this.emit('webhook:batch-error', {
        webhooks,
        error: error instanceof Error ? error : new Error(String(error)),
      });
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Get current queue size.
   *
   * @returns The number of webhooks currently in the queue
   */
  size(): number {
    return this.queue.length;
  }

  /**
   * Check if the queue is currently processing a batch.
   *
   * @returns True if batch processing is in progress
   */
  processing(): boolean {
    return this.isProcessing;
  }

  /**
   * Force immediate processing of all queued webhooks.
   * Useful for graceful shutdown to ensure pending webhooks are processed.
   */
  async flush(): Promise<void> {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    await this.processBatch();
  }

  /**
   * Clear all queued webhooks without processing them.
   * Useful for testing.
   */
  clear(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    this.queue = [];
  }

  /**
   * Get the configured debounce period.
   *
   * @returns The debounce period in milliseconds
   */
  getDebounceMs(): number {
    return this.debounceMs;
  }

  /**
   * Get the configured maximum queue size.
   *
   * @returns The maximum queue size
   */
  getMaxQueueSize(): number {
    return this.maxQueueSize;
  }
}

/**
 * Default singleton webhook queue instance.
 */
export let defaultWebhookQueue: WebhookQueue = new WebhookQueue();

/**
 * Replace the default webhook queue with a new instance.
 * Useful for testing to ensure isolation between test runs.
 *
 * @param queue - The new queue to use as the default
 */
export function setDefaultWebhookQueue(queue: WebhookQueue): void {
  defaultWebhookQueue = queue;
}
