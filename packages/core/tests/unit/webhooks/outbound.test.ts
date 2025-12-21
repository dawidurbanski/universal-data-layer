import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  OutboundWebhookManager,
  type OutboundWebhookConfig,
  type WebhookBatch,
  type QueuedWebhook,
} from '@/webhooks/index.js';

// Helper to create a mock webhook batch
function createMockBatch(
  webhookCount: number,
  plugins: string[] = ['test-plugin']
): WebhookBatch {
  const webhooks: QueuedWebhook[] = [];
  for (let i = 0; i < webhookCount; i++) {
    webhooks.push({
      pluginName: plugins[i % plugins.length]!,
      path: `path-${i}`,
      rawBody: Buffer.from('{}'),
      body: {},
      headers: { 'content-type': 'application/json' },
      timestamp: Date.now(),
    });
  }

  return {
    webhooks,
    startedAt: Date.now() - 100,
    completedAt: Date.now(),
  };
}

describe('OutboundWebhookManager', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    // Mock fetch
    fetchMock = vi.fn();
    originalFetch = globalThis.fetch;
    globalThis.fetch = fetchMock;

    // Suppress console output
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});

    // Use fake timers for retry delay testing
    vi.useFakeTimers();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('constructor', () => {
    it('should create manager with empty config array', () => {
      const manager = new OutboundWebhookManager([]);
      expect(manager.getConfigCount()).toBe(0);
    });

    it('should create manager with provided configs', () => {
      const configs: OutboundWebhookConfig[] = [
        { url: 'https://example.com/webhook1' },
        { url: 'https://example.com/webhook2' },
      ];
      const manager = new OutboundWebhookManager(configs);
      expect(manager.getConfigCount()).toBe(2);
    });

    it('should default to empty array if no configs provided', () => {
      const manager = new OutboundWebhookManager();
      expect(manager.getConfigCount()).toBe(0);
    });
  });

  describe('triggerAll', () => {
    it('should return empty array if no configs', async () => {
      const manager = new OutboundWebhookManager([]);
      const batch = createMockBatch(3);

      const results = await manager.triggerAll(batch);

      expect(results).toEqual([]);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('should trigger single webhook successfully', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
      });

      const manager = new OutboundWebhookManager([
        { url: 'https://example.com/webhook' },
      ]);
      const batch = createMockBatch(3);

      const results = await manager.triggerAll(batch);

      expect(results.length).toBe(1);
      expect(results[0]!.success).toBe(true);
      expect(results[0]!.attempts).toBe(1);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('should trigger multiple webhooks in parallel', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
      });

      const manager = new OutboundWebhookManager([
        { url: 'https://example.com/webhook1' },
        { url: 'https://example.com/webhook2' },
        { url: 'https://example.com/webhook3' },
      ]);
      const batch = createMockBatch(5);

      const results = await manager.triggerAll(batch);

      expect(results.length).toBe(3);
      expect(results.every((r) => r.success)).toBe(true);
      expect(fetchMock).toHaveBeenCalledTimes(3);
    });

    it('should send correct payload structure', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
      });

      const manager = new OutboundWebhookManager([
        { url: 'https://example.com/webhook' },
      ]);
      const batch = createMockBatch(3, ['plugin-a', 'plugin-b']);

      await manager.triggerAll(batch);

      expect(fetchMock).toHaveBeenCalledWith(
        'https://example.com/webhook',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'User-Agent': 'UDL-Webhook/1.0',
          }),
        })
      );

      const callArgs = fetchMock.mock.calls[0]!;
      const body = JSON.parse((callArgs[1] as { body: string }).body);

      expect(body.event).toBe('batch-complete');
      expect(body.timestamp).toBeDefined();
      expect(body.summary.webhookCount).toBe(3);
      expect(body.summary.plugins).toContain('plugin-a');
      expect(body.summary.plugins).toContain('plugin-b');
      expect(body.source).toBeDefined();
    });

    it('should include custom headers in request', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
      });

      const manager = new OutboundWebhookManager([
        {
          url: 'https://example.com/webhook',
          headers: {
            Authorization: 'Bearer secret-token',
            'X-Custom-Header': 'custom-value',
          },
        },
      ]);
      const batch = createMockBatch(1);

      await manager.triggerAll(batch);

      expect(fetchMock).toHaveBeenCalledWith(
        'https://example.com/webhook',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer secret-token',
            'X-Custom-Header': 'custom-value',
          }),
        })
      );
    });

    it('should handle failed webhooks without throwing', async () => {
      fetchMock
        .mockResolvedValueOnce({ ok: true, status: 200, statusText: 'OK' })
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({ ok: true, status: 200, statusText: 'OK' });

      const manager = new OutboundWebhookManager([
        { url: 'https://example.com/webhook1', retries: 0 },
        { url: 'https://example.com/webhook2', retries: 0 },
        { url: 'https://example.com/webhook3', retries: 0 },
      ]);
      const batch = createMockBatch(1);

      const results = await manager.triggerAll(batch);

      expect(results.length).toBe(3);
      expect(results[0]!.success).toBe(true);
      expect(results[1]!.success).toBe(false);
      expect(results[1]!.error).toBe('Network error');
      expect(results[2]!.success).toBe(true);
    });

    it('should handle HTTP error responses', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      const manager = new OutboundWebhookManager([
        { url: 'https://example.com/webhook', retries: 0 },
      ]);
      const batch = createMockBatch(1);

      const results = await manager.triggerAll(batch);

      expect(results[0]!.success).toBe(false);
      expect(results[0]!.error).toBe('HTTP 500: Internal Server Error');
    });

    it('should extract unique plugins from batch', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
      });

      const manager = new OutboundWebhookManager([
        { url: 'https://example.com/webhook' },
      ]);

      // Create batch with duplicate plugin names
      const batch: WebhookBatch = {
        webhooks: [
          {
            pluginName: 'plugin-a',
            path: 'path-1',
            rawBody: Buffer.from('{}'),
            body: {},
            headers: {},
            timestamp: Date.now(),
          },
          {
            pluginName: 'plugin-a',
            path: 'path-2',
            rawBody: Buffer.from('{}'),
            body: {},
            headers: {},
            timestamp: Date.now(),
          },
          {
            pluginName: 'plugin-b',
            path: 'path-3',
            rawBody: Buffer.from('{}'),
            body: {},
            headers: {},
            timestamp: Date.now(),
          },
        ],
        startedAt: Date.now() - 100,
        completedAt: Date.now(),
      };

      await manager.triggerAll(batch);

      const callArgs = fetchMock.mock.calls[0]!;
      const body = JSON.parse((callArgs[1] as { body: string }).body);

      // Should have unique plugins only
      expect(body.summary.plugins).toEqual(['plugin-a', 'plugin-b']);
    });
  });

  describe('retry logic', () => {
    it('should retry on failure', async () => {
      fetchMock
        .mockRejectedValueOnce(new Error('Temporary error'))
        .mockRejectedValueOnce(new Error('Temporary error'))
        .mockResolvedValueOnce({ ok: true, status: 200, statusText: 'OK' });

      const manager = new OutboundWebhookManager([
        { url: 'https://example.com/webhook', retries: 3, retryDelayMs: 100 },
      ]);
      const batch = createMockBatch(1);

      const resultPromise = manager.triggerAll(batch);

      // Advance timers to handle retry delays
      await vi.advanceTimersByTimeAsync(100); // First retry delay
      await vi.advanceTimersByTimeAsync(200); // Second retry delay

      const results = await resultPromise;

      expect(results[0]!.success).toBe(true);
      expect(results[0]!.attempts).toBe(3);
      expect(fetchMock).toHaveBeenCalledTimes(3);
    });

    it('should use exponential backoff for retries', async () => {
      fetchMock
        .mockRejectedValueOnce(new Error('Error'))
        .mockRejectedValueOnce(new Error('Error'))
        .mockRejectedValueOnce(new Error('Error'))
        .mockResolvedValueOnce({ ok: true, status: 200, statusText: 'OK' });

      const manager = new OutboundWebhookManager([
        { url: 'https://example.com/webhook', retries: 3, retryDelayMs: 1000 },
      ]);
      const batch = createMockBatch(1);

      const resultPromise = manager.triggerAll(batch);

      // First retry: 1000ms * 1 = 1000ms
      expect(fetchMock).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(1000);
      expect(fetchMock).toHaveBeenCalledTimes(2);

      // Second retry: 1000ms * 2 = 2000ms
      await vi.advanceTimersByTimeAsync(2000);
      expect(fetchMock).toHaveBeenCalledTimes(3);

      // Third retry: 1000ms * 3 = 3000ms
      await vi.advanceTimersByTimeAsync(3000);
      expect(fetchMock).toHaveBeenCalledTimes(4);

      const results = await resultPromise;
      expect(results[0]!.success).toBe(true);
    });

    it('should give up after max retries', async () => {
      fetchMock.mockRejectedValue(new Error('Persistent error'));

      const manager = new OutboundWebhookManager([
        { url: 'https://example.com/webhook', retries: 2, retryDelayMs: 100 },
      ]);
      const batch = createMockBatch(1);

      const resultPromise = manager.triggerAll(batch);

      // Advance through all retries
      await vi.advanceTimersByTimeAsync(100); // First retry
      await vi.advanceTimersByTimeAsync(200); // Second retry

      const results = await resultPromise;

      expect(results[0]!.success).toBe(false);
      expect(results[0]!.error).toBe('Persistent error');
      expect(results[0]!.attempts).toBe(3); // Initial + 2 retries
      expect(fetchMock).toHaveBeenCalledTimes(3);
    });

    it('should use default retry settings', async () => {
      fetchMock.mockRejectedValue(new Error('Error'));

      const manager = new OutboundWebhookManager([
        { url: 'https://example.com/webhook' }, // No retry config, uses defaults
      ]);
      const batch = createMockBatch(1);

      const resultPromise = manager.triggerAll(batch);

      // Default is 3 retries, so 4 total attempts
      await vi.advanceTimersByTimeAsync(1000); // retry 1
      await vi.advanceTimersByTimeAsync(2000); // retry 2
      await vi.advanceTimersByTimeAsync(3000); // retry 3

      await resultPromise;

      expect(fetchMock).toHaveBeenCalledTimes(4);
    });
  });

  describe('UDL_INSTANCE_ID', () => {
    it('should use UDL_INSTANCE_ID from environment if set', async () => {
      const originalEnv = process.env['UDL_INSTANCE_ID'];
      process.env['UDL_INSTANCE_ID'] = 'my-custom-instance';

      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
      });

      const manager = new OutboundWebhookManager([
        { url: 'https://example.com/webhook' },
      ]);
      const batch = createMockBatch(1);

      await manager.triggerAll(batch);

      const callArgs = fetchMock.mock.calls[0]!;
      const body = JSON.parse((callArgs[1] as { body: string }).body);

      expect(body.source).toBe('my-custom-instance');

      // Restore
      if (originalEnv === undefined) {
        delete process.env['UDL_INSTANCE_ID'];
      } else {
        process.env['UDL_INSTANCE_ID'] = originalEnv;
      }
    });

    it('should use "default" if UDL_INSTANCE_ID is not set', async () => {
      const originalEnv = process.env['UDL_INSTANCE_ID'];
      delete process.env['UDL_INSTANCE_ID'];

      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
      });

      const manager = new OutboundWebhookManager([
        { url: 'https://example.com/webhook' },
      ]);
      const batch = createMockBatch(1);

      await manager.triggerAll(batch);

      const callArgs = fetchMock.mock.calls[0]!;
      const body = JSON.parse((callArgs[1] as { body: string }).body);

      expect(body.source).toBe('default');

      // Restore
      if (originalEnv !== undefined) {
        process.env['UDL_INSTANCE_ID'] = originalEnv;
      }
    });
  });

  describe('getConfigCount', () => {
    it('should return 0 for empty manager', () => {
      const manager = new OutboundWebhookManager([]);
      expect(manager.getConfigCount()).toBe(0);
    });

    it('should return correct count', () => {
      const manager = new OutboundWebhookManager([
        { url: 'https://example.com/1' },
        { url: 'https://example.com/2' },
        { url: 'https://example.com/3' },
      ]);
      expect(manager.getConfigCount()).toBe(3);
    });
  });
});
