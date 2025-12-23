import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  OutboundWebhookManager,
  type OutboundWebhookConfig,
  type WebhookBatch,
  type QueuedWebhook,
  type TransformPayloadContext,
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
      rawBody: Buffer.from('{}'),
      body: { operation: 'upsert', nodeId: `node-${i}` },
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

    it('should send correct payload structure with items', async () => {
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
      // New: items should be included
      expect(body.items).toBeDefined();
      expect(body.items.length).toBe(3);
      expect(body.items[0]).toHaveProperty('pluginName');
      expect(body.items[0]).toHaveProperty('body');
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
            rawBody: Buffer.from('{}'),
            body: {},
            headers: {},
            timestamp: Date.now(),
          },
          {
            pluginName: 'plugin-a',
            rawBody: Buffer.from('{}'),
            body: {},
            headers: {},
            timestamp: Date.now(),
          },
          {
            pluginName: 'plugin-b',
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

  describe('transformPayload', () => {
    it('should use default payload when no transformPayload provided', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
      });

      const manager = new OutboundWebhookManager([
        { url: 'https://example.com/webhook' },
      ]);
      const batch = createMockBatch(2);

      await manager.triggerAll(batch);

      const callArgs = fetchMock.mock.calls[0]!;
      const body = JSON.parse((callArgs[1] as { body: string }).body);

      expect(body.event).toBe('batch-complete');
      expect(body.timestamp).toBeDefined();
      expect(body.summary).toBeDefined();
      expect(body.source).toBeDefined();
      expect(body.items).toHaveLength(2);
    });

    it('should call transformPayload with full context', async () => {
      let receivedContext: TransformPayloadContext | undefined;

      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
      });

      const manager = new OutboundWebhookManager([
        {
          url: 'https://example.com/webhook',
          transformPayload: (ctx) => {
            receivedContext = ctx;
            return {};
          },
        },
      ]);

      const batch = createMockBatch(2, ['plugin-a', 'plugin-b']);
      await manager.triggerAll(batch);

      expect(receivedContext).toBeDefined();
      expect(receivedContext!.batch).toBe(batch);
      expect(receivedContext!.event).toBe('batch-complete');
      expect(receivedContext!.timestamp).toBeDefined();
      expect(receivedContext!.source).toBeDefined();
      expect(receivedContext!.summary.webhookCount).toBe(2);
      expect(receivedContext!.summary.plugins).toContain('plugin-a');
      expect(receivedContext!.summary.plugins).toContain('plugin-b');
      expect(receivedContext!.items).toHaveLength(2);
      expect(receivedContext!.items[0]).toHaveProperty('pluginName');
      expect(receivedContext!.items[0]).toHaveProperty('body');
      expect(receivedContext!.items[0]).toHaveProperty('headers');
      expect(receivedContext!.items[0]).toHaveProperty('timestamp');
    });

    it('should allow transformPayload to return empty object', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
      });

      const manager = new OutboundWebhookManager([
        {
          url: 'https://api.vercel.com/deploy',
          transformPayload: () => ({}),
        },
      ]);
      const batch = createMockBatch(3);

      await manager.triggerAll(batch);

      const callArgs = fetchMock.mock.calls[0]!;
      const body = JSON.parse((callArgs[1] as { body: string }).body);

      expect(body).toEqual({});
    });

    it('should allow transformPayload to return custom shape', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
      });

      const manager = new OutboundWebhookManager([
        {
          url: 'https://my-ci.example.com/webhook',
          transformPayload: ({ items, timestamp }) => ({
            event: 'content-updated',
            changes: items.map((i) => i.body),
            deployedAt: timestamp,
          }),
        },
      ]);
      const batch = createMockBatch(2);

      await manager.triggerAll(batch);

      const callArgs = fetchMock.mock.calls[0]!;
      const body = JSON.parse((callArgs[1] as { body: string }).body);

      expect(body.event).toBe('content-updated');
      expect(body.changes).toHaveLength(2);
      expect(body.deployedAt).toBeDefined();
      // Original fields should not be present
      expect(body.summary).toBeUndefined();
      expect(body.source).toBeUndefined();
    });

    it('should use convenience values from context', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
      });

      const manager = new OutboundWebhookManager([
        {
          url: 'https://example.com/webhook',
          transformPayload: ({ timestamp, summary }) => ({
            deployedAt: timestamp,
            changedCount: summary.webhookCount,
            plugins: summary.plugins,
          }),
        },
      ]);
      const batch = createMockBatch(3, ['plugin-a']);

      await manager.triggerAll(batch);

      const callArgs = fetchMock.mock.calls[0]!;
      const body = JSON.parse((callArgs[1] as { body: string }).body);

      expect(body.changedCount).toBe(3);
      expect(body.plugins).toEqual(['plugin-a']);
    });

    it('should allow different transforms per trigger', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
      });

      const manager = new OutboundWebhookManager([
        {
          url: 'https://vercel.com/deploy',
          transformPayload: () => ({}),
        },
        {
          url: 'https://ci.example.com/webhook',
          transformPayload: ({ summary }) => ({
            count: summary.webhookCount,
          }),
        },
        {
          url: 'https://default.example.com/webhook',
          // No transform - uses default
        },
      ]);
      const batch = createMockBatch(2);

      await manager.triggerAll(batch);

      expect(fetchMock).toHaveBeenCalledTimes(3);

      // First call: empty object
      const body1 = JSON.parse(
        (fetchMock.mock.calls[0]![1] as { body: string }).body
      );
      expect(body1).toEqual({});

      // Second call: custom shape
      const body2 = JSON.parse(
        (fetchMock.mock.calls[1]![1] as { body: string }).body
      );
      expect(body2).toEqual({ count: 2 });

      // Third call: default payload
      const body3 = JSON.parse(
        (fetchMock.mock.calls[2]![1] as { body: string }).body
      );
      expect(body3.event).toBe('batch-complete');
      expect(body3.items).toBeDefined();
    });

    it('should include headers in items', async () => {
      let receivedItems: TransformPayloadContext['items'] = [];

      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
      });

      const manager = new OutboundWebhookManager([
        {
          url: 'https://example.com/webhook',
          transformPayload: ({ items }) => {
            receivedItems = items;
            return {};
          },
        },
      ]);

      const batch: WebhookBatch = {
        webhooks: [
          {
            pluginName: 'test',
            rawBody: Buffer.from('{}'),
            body: { data: 'test' },
            headers: {
              'x-signature': 'abc123',
              'content-type': 'application/json',
            },
            timestamp: 1234567890,
          },
        ],
        startedAt: Date.now() - 100,
        completedAt: Date.now(),
      };

      await manager.triggerAll(batch);

      expect(receivedItems[0]!.headers['x-signature']).toBe('abc123');
      expect(receivedItems[0]!.headers['content-type']).toBe(
        'application/json'
      );
    });
  });

  describe('method option', () => {
    it('should use POST by default', async () => {
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

      expect(fetchMock).toHaveBeenCalledWith(
        'https://example.com/webhook',
        expect.objectContaining({
          method: 'POST',
        })
      );
    });

    it('should use GET when specified', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
      });

      const manager = new OutboundWebhookManager([
        { url: 'https://example.com/ping', method: 'GET' },
      ]);
      const batch = createMockBatch(1);

      await manager.triggerAll(batch);

      expect(fetchMock).toHaveBeenCalledWith(
        'https://example.com/ping',
        expect.objectContaining({
          method: 'GET',
        })
      );
    });

    it('should send body with GET request', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
      });

      const manager = new OutboundWebhookManager([
        { url: 'https://example.com/ping', method: 'GET' },
      ]);
      const batch = createMockBatch(1);

      await manager.triggerAll(batch);

      const callArgs = fetchMock.mock.calls[0]!;
      const options = callArgs[1] as { method: string; body: string };

      expect(options.method).toBe('GET');
      expect(options.body).toBeDefined();
      const body = JSON.parse(options.body);
      expect(body.event).toBe('batch-complete');
    });

    it('should allow GET with transformPayload', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
      });

      const manager = new OutboundWebhookManager([
        {
          url: 'https://example.com/ping',
          method: 'GET',
          transformPayload: () => ({ ping: true }),
        },
      ]);
      const batch = createMockBatch(1);

      await manager.triggerAll(batch);

      const callArgs = fetchMock.mock.calls[0]!;
      const options = callArgs[1] as { method: string; body: string };

      expect(options.method).toBe('GET');
      const body = JSON.parse(options.body);
      expect(body).toEqual({ ping: true });
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

    it('should use "UDL" if UDL_INSTANCE_ID is not set', async () => {
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

      expect(body.source).toBe('UDL');

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
