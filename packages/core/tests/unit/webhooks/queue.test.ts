import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  WebhookQueue,
  setDefaultWebhookQueue,
  type QueuedWebhook,
  type WebhookBatch,
} from '@/webhooks/index.js';

// Helper to create a mock webhook
function createMockWebhook(
  pluginName: string,
  path: string,
  body?: unknown
): QueuedWebhook {
  return {
    pluginName,
    path,
    rawBody: Buffer.from(JSON.stringify(body ?? {})),
    body: body ?? {},
    headers: { 'content-type': 'application/json' },
    timestamp: Date.now(),
  };
}

describe('WebhookQueue', () => {
  let queue: WebhookQueue;

  beforeEach(() => {
    vi.useFakeTimers();
    queue = new WebhookQueue({ debounceMs: 5000, maxQueueSize: 100 });
    setDefaultWebhookQueue(queue);

    // Suppress console logs
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    queue.clear();
  });

  describe('constructor', () => {
    it('should use default debounceMs of 5000', () => {
      const defaultQueue = new WebhookQueue();
      expect(defaultQueue.getDebounceMs()).toBe(5000);
    });

    it('should use default maxQueueSize of 100', () => {
      const defaultQueue = new WebhookQueue();
      expect(defaultQueue.getMaxQueueSize()).toBe(100);
    });

    it('should accept custom debounceMs', () => {
      const customQueue = new WebhookQueue({ debounceMs: 10000 });
      expect(customQueue.getDebounceMs()).toBe(10000);
    });

    it('should accept custom maxQueueSize', () => {
      const customQueue = new WebhookQueue({ maxQueueSize: 50 });
      expect(customQueue.getMaxQueueSize()).toBe(50);
    });
  });

  describe('enqueue', () => {
    it('should add webhook to queue', () => {
      const webhook = createMockWebhook('plugin', 'path');
      queue.enqueue(webhook);
      expect(queue.size()).toBe(1);
    });

    it('should increment queue size with each enqueue', () => {
      queue.enqueue(createMockWebhook('plugin', 'path-1'));
      queue.enqueue(createMockWebhook('plugin', 'path-2'));
      queue.enqueue(createMockWebhook('plugin', 'path-3'));
      expect(queue.size()).toBe(3);
    });

    it('should start debounce timer on first enqueue', () => {
      const webhook = createMockWebhook('plugin', 'path');
      queue.enqueue(webhook);

      // Queue should not be processed yet
      expect(queue.size()).toBe(1);

      // Advance timer by 4999ms (just before debounce)
      vi.advanceTimersByTime(4999);
      expect(queue.size()).toBe(1);

      // Advance timer by 1ms to trigger processing
      vi.advanceTimersByTime(1);
      expect(queue.size()).toBe(0);
    });

    it('should reset debounce timer on each enqueue', () => {
      queue.enqueue(createMockWebhook('plugin', 'path-1'));

      // Advance timer by 4000ms
      vi.advanceTimersByTime(4000);
      expect(queue.size()).toBe(1);

      // Enqueue another webhook - should reset timer
      queue.enqueue(createMockWebhook('plugin', 'path-2'));

      // Advance timer by 4000ms again (total 8000ms since first enqueue)
      vi.advanceTimersByTime(4000);
      expect(queue.size()).toBe(2); // Still queued because timer was reset

      // Advance timer by 1000ms more (5000ms since second enqueue)
      vi.advanceTimersByTime(1000);
      expect(queue.size()).toBe(0); // Processed now
    });
  });

  describe('batch processing', () => {
    it('should emit webhook:process for each webhook in batch', async () => {
      const processedWebhooks: QueuedWebhook[] = [];
      queue.on('webhook:process', (webhook: QueuedWebhook) => {
        processedWebhooks.push(webhook);
      });

      queue.enqueue(createMockWebhook('plugin', 'path-1'));
      queue.enqueue(createMockWebhook('plugin', 'path-2'));
      queue.enqueue(createMockWebhook('plugin', 'path-3'));

      vi.advanceTimersByTime(5000);

      expect(processedWebhooks.length).toBe(3);
      expect(processedWebhooks[0]?.path).toBe('path-1');
      expect(processedWebhooks[1]?.path).toBe('path-2');
      expect(processedWebhooks[2]?.path).toBe('path-3');
    });

    it('should emit webhook:batch-complete after processing', async () => {
      let completedBatch: WebhookBatch | undefined;
      queue.on('webhook:batch-complete', (batch: WebhookBatch) => {
        completedBatch = batch;
      });

      queue.enqueue(createMockWebhook('plugin', 'path-1'));
      queue.enqueue(createMockWebhook('plugin', 'path-2'));

      vi.advanceTimersByTime(5000);

      expect(completedBatch).toBeDefined();
      expect(completedBatch?.webhooks.length).toBe(2);
      expect(completedBatch?.startedAt).toBeGreaterThan(0);
      expect(completedBatch?.completedAt).toBeGreaterThanOrEqual(
        completedBatch!.startedAt
      );
    });

    it('should batch all queued webhooks into single processing', async () => {
      let batchCount = 0;
      queue.on('webhook:batch-complete', () => {
        batchCount++;
      });

      // Enqueue 10 webhooks rapidly
      for (let i = 0; i < 10; i++) {
        queue.enqueue(createMockWebhook('plugin', `path-${i}`));
      }

      vi.advanceTimersByTime(5000);

      // Should only have 1 batch
      expect(batchCount).toBe(1);
    });

    it('should process immediately when max queue size is reached', async () => {
      const smallQueue = new WebhookQueue({
        debounceMs: 5000,
        maxQueueSize: 5,
      });

      let batchCount = 0;
      smallQueue.on('webhook:batch-complete', () => {
        batchCount++;
      });

      // Enqueue 5 webhooks (max size)
      for (let i = 0; i < 5; i++) {
        smallQueue.enqueue(createMockWebhook('plugin', `path-${i}`));
      }

      // Should process immediately without waiting for debounce
      expect(smallQueue.size()).toBe(0);
      expect(batchCount).toBe(1);
    });
  });

  describe('flush', () => {
    it('should process queued webhooks immediately', async () => {
      queue.enqueue(createMockWebhook('plugin', 'path-1'));
      queue.enqueue(createMockWebhook('plugin', 'path-2'));

      expect(queue.size()).toBe(2);

      await queue.flush();

      expect(queue.size()).toBe(0);
    });

    it('should clear debounce timer', async () => {
      queue.enqueue(createMockWebhook('plugin', 'path-1'));

      // Advance timer partially
      vi.advanceTimersByTime(2000);

      await queue.flush();

      // Advance timer past original debounce time
      vi.advanceTimersByTime(5000);

      // Should not process again (no duplicate processing)
      expect(queue.size()).toBe(0);
    });

    it('should emit batch-complete event', async () => {
      let completed = false;
      queue.on('webhook:batch-complete', () => {
        completed = true;
      });

      queue.enqueue(createMockWebhook('plugin', 'path-1'));
      await queue.flush();

      expect(completed).toBe(true);
    });

    it('should do nothing if queue is empty', async () => {
      let completed = false;
      queue.on('webhook:batch-complete', () => {
        completed = true;
      });

      await queue.flush();

      expect(completed).toBe(false);
    });
  });

  describe('clear', () => {
    it('should remove all queued webhooks', () => {
      queue.enqueue(createMockWebhook('plugin', 'path-1'));
      queue.enqueue(createMockWebhook('plugin', 'path-2'));

      expect(queue.size()).toBe(2);

      queue.clear();

      expect(queue.size()).toBe(0);
    });

    it('should clear debounce timer', () => {
      queue.enqueue(createMockWebhook('plugin', 'path-1'));

      queue.clear();

      // Advance timer past debounce time
      vi.advanceTimersByTime(10000);

      // No processing should occur
      expect(queue.size()).toBe(0);
    });
  });

  describe('size', () => {
    it('should return 0 for empty queue', () => {
      expect(queue.size()).toBe(0);
    });

    it('should return correct count after enqueue', () => {
      queue.enqueue(createMockWebhook('plugin', 'path-1'));
      expect(queue.size()).toBe(1);

      queue.enqueue(createMockWebhook('plugin', 'path-2'));
      expect(queue.size()).toBe(2);
    });

    it('should return 0 after processing', () => {
      queue.enqueue(createMockWebhook('plugin', 'path-1'));
      vi.advanceTimersByTime(5000);
      expect(queue.size()).toBe(0);
    });
  });

  describe('processing', () => {
    it('should return false when not processing', () => {
      expect(queue.processing()).toBe(false);
    });

    it('should not process if already processing', async () => {
      let processCount = 0;

      // Use a custom batch processor that tracks calls
      const slowQueue = new WebhookQueue({
        debounceMs: 1000,
        batchProcessor: async (webhooks) => {
          processCount++;
          // Simulate slow processing
          await new Promise((resolve) => setTimeout(resolve, 100));
          return {
            webhooks,
            startedAt: Date.now(),
            completedAt: Date.now(),
          };
        },
      });

      slowQueue.enqueue(createMockWebhook('plugin', 'path-1'));

      // Trigger processing
      vi.advanceTimersByTime(1000);

      // Try to flush while processing (should be skipped)
      await slowQueue.flush();

      // Should only have processed once
      expect(processCount).toBe(1);
    });
  });

  describe('setBatchProcessor', () => {
    it('should use custom batch processor', async () => {
      let processedWebhooks: QueuedWebhook[] = [];

      queue.setBatchProcessor(async (webhooks) => {
        processedWebhooks = webhooks;
        return {
          webhooks,
          startedAt: Date.now(),
          completedAt: Date.now(),
        };
      });

      queue.enqueue(createMockWebhook('plugin', 'path-1'));
      queue.enqueue(createMockWebhook('plugin', 'path-2'));

      await queue.flush();

      expect(processedWebhooks.length).toBe(2);
    });

    it('should not emit webhook:process when using custom processor', async () => {
      let processEventCount = 0;
      queue.on('webhook:process', () => {
        processEventCount++;
      });

      queue.setBatchProcessor(async (webhooks) => ({
        webhooks,
        startedAt: Date.now(),
        completedAt: Date.now(),
      }));

      queue.enqueue(createMockWebhook('plugin', 'path-1'));
      await queue.flush();

      // Custom processor handles processing, so no events emitted
      expect(processEventCount).toBe(0);
    });
  });

  describe('error handling', () => {
    it('should emit webhook:batch-error when processing fails', async () => {
      let receivedError:
        | { webhooks: QueuedWebhook[]; error: Error }
        | undefined;

      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      queue.setBatchProcessor(async () => {
        throw new Error('Processing failed');
      });

      queue.on(
        'webhook:batch-error',
        (error: { webhooks: QueuedWebhook[]; error: Error }) => {
          receivedError = error;
        }
      );

      queue.enqueue(createMockWebhook('plugin', 'path-1'));
      await queue.flush();

      expect(receivedError).toBeDefined();
      expect(receivedError?.error.message).toBe('Processing failed');
      expect(receivedError?.webhooks.length).toBe(1);

      consoleErrorSpy.mockRestore();
    });

    it('should set isProcessing to false after error', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});

      queue.setBatchProcessor(async () => {
        throw new Error('Processing failed');
      });

      queue.enqueue(createMockWebhook('plugin', 'path-1'));
      await queue.flush();

      expect(queue.processing()).toBe(false);
    });
  });
});
