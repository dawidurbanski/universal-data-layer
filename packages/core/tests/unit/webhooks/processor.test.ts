/**
 * Tests for Webhook Batch Processor
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'node:events';

// Mock dependencies before importing the module under test
vi.mock('@/webhooks/registry.js', () => ({
  defaultWebhookRegistry: {
    getHandler: vi.fn(),
  },
}));

vi.mock('@/webhooks/queue.js', () => {
  const mockQueue = new EventEmitter();
  return {
    defaultWebhookQueue: mockQueue,
  };
});

vi.mock('@/webhooks/hooks.js', () => ({
  getWebhookHooks: vi.fn(() => ({})),
}));

vi.mock('@/nodes/defaultStore.js', () => ({
  defaultStore: {
    get: vi.fn(),
    set: vi.fn(),
  },
}));

vi.mock('@/nodes/actions/index.js', () => ({
  createNodeActions: vi.fn(() => ({
    createNode: vi.fn(),
    deleteNode: vi.fn(),
    getNode: vi.fn(),
  })),
}));

import {
  initializeWebhookProcessor,
  processWebhookBatch,
} from '@/webhooks/processor.js';
import { defaultWebhookRegistry } from '@/webhooks/registry.js';
import { defaultWebhookQueue } from '@/webhooks/queue.js';
import { getWebhookHooks } from '@/webhooks/hooks.js';
import { createNodeActions } from '@/nodes/actions/index.js';
import type { QueuedWebhook } from '@/webhooks/queue.js';

describe('webhooks/processor', () => {
  const mockConsoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
  const mockConsoleWarn = vi
    .spyOn(console, 'warn')
    .mockImplementation(() => {});
  const mockConsoleError = vi
    .spyOn(console, 'error')
    .mockImplementation(() => {});

  beforeEach(() => {
    vi.clearAllMocks();
    // Remove all listeners to start fresh
    defaultWebhookQueue.removeAllListeners();
  });

  afterEach(() => {
    defaultWebhookQueue.removeAllListeners();
  });

  const createQueuedWebhook = (
    overrides: Partial<QueuedWebhook> = {}
  ): QueuedWebhook => ({
    pluginName: 'test-plugin',
    rawBody: Buffer.from('{"test": true}'),
    body: { test: true },
    headers: { 'content-type': 'application/json' },
    timestamp: Date.now(),
    ...overrides,
  });

  describe('initializeWebhookProcessor', () => {
    it('should set up event listeners on the queue', () => {
      initializeWebhookProcessor();

      // Check that listeners are registered
      expect(defaultWebhookQueue.listenerCount('webhook:process')).toBe(1);
      expect(defaultWebhookQueue.listenerCount('webhook:batch-complete')).toBe(
        1
      );
      expect(defaultWebhookQueue.listenerCount('webhook:batch-error')).toBe(1);
      expect(mockConsoleLog).toHaveBeenCalledWith(
        '🔗 Webhook processor initialized'
      );
    });

    it('should process individual webhooks when webhook:process is emitted', async () => {
      const mockHandler = vi.fn().mockResolvedValue(undefined);
      vi.mocked(defaultWebhookRegistry.getHandler).mockReturnValue({
        pluginName: 'test-plugin',
        handler: mockHandler,
      });

      initializeWebhookProcessor();

      const webhook = createQueuedWebhook();
      defaultWebhookQueue.emit('webhook:process', webhook);

      // Wait for async processing
      await vi.waitFor(() => {
        expect(mockHandler).toHaveBeenCalled();
      });

      expect(createNodeActions).toHaveBeenCalledWith({
        store: expect.anything(),
        owner: 'test-plugin',
      });
    });

    it('should warn if handler is not found for webhook', async () => {
      vi.mocked(defaultWebhookRegistry.getHandler).mockReturnValue(undefined);

      initializeWebhookProcessor();

      const webhook = createQueuedWebhook({ pluginName: 'unknown-plugin' });
      defaultWebhookQueue.emit('webhook:process', webhook);

      await vi.waitFor(() => {
        expect(mockConsoleWarn).toHaveBeenCalledWith(
          '⚠️ Handler not found for queued webhook: unknown-plugin'
        );
      });
    });

    it('should catch and log handler errors without rethrowing', async () => {
      const mockHandler = vi
        .fn()
        .mockRejectedValue(new Error('Handler failed'));
      vi.mocked(defaultWebhookRegistry.getHandler).mockReturnValue({
        pluginName: 'test-plugin',
        handler: mockHandler,
      });

      initializeWebhookProcessor();

      const webhook = createQueuedWebhook();
      defaultWebhookQueue.emit('webhook:process', webhook);

      await vi.waitFor(() => {
        expect(mockConsoleError).toHaveBeenCalledWith(
          '❌ Error processing webhook test-plugin:',
          expect.any(Error)
        );
      });
    });

    it('should run onAfterWebhookTriggered hook on batch complete', async () => {
      const mockAfterHook = vi.fn().mockResolvedValue(undefined);
      vi.mocked(getWebhookHooks).mockReturnValue({
        onAfterWebhookTriggered: mockAfterHook,
      });

      initializeWebhookProcessor();

      const batch = {
        webhooks: [createQueuedWebhook()],
        startedAt: Date.now(),
        completedAt: Date.now(),
      };

      defaultWebhookQueue.emit('webhook:batch-complete', batch);

      await vi.waitFor(() => {
        expect(mockConsoleLog).toHaveBeenCalledWith(
          '🪝 Running onAfterWebhookTriggered hook...'
        );
        expect(mockAfterHook).toHaveBeenCalledWith({
          batch,
          store: expect.anything(),
        });
      });
    });

    it('should catch and log onAfterWebhookTriggered hook errors', async () => {
      const hookError = new Error('After hook failed');
      const mockAfterHook = vi.fn().mockRejectedValue(hookError);
      vi.mocked(getWebhookHooks).mockReturnValue({
        onAfterWebhookTriggered: mockAfterHook,
      });

      initializeWebhookProcessor();

      const batch = {
        webhooks: [createQueuedWebhook()],
        startedAt: Date.now(),
        completedAt: Date.now(),
      };

      defaultWebhookQueue.emit('webhook:batch-complete', batch);

      await vi.waitFor(() => {
        expect(mockConsoleError).toHaveBeenCalledWith(
          '❌ onAfterWebhookTriggered hook error:',
          hookError
        );
      });
    });

    it('should skip onAfterWebhookTriggered if hook is not defined', async () => {
      vi.mocked(getWebhookHooks).mockReturnValue({});

      initializeWebhookProcessor();

      const batch = {
        webhooks: [createQueuedWebhook()],
        startedAt: Date.now(),
        completedAt: Date.now(),
      };

      defaultWebhookQueue.emit('webhook:batch-complete', batch);

      // Wait a tick to ensure async code would have run
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockConsoleLog).not.toHaveBeenCalledWith(
        '🪝 Running onAfterWebhookTriggered hook...'
      );
    });

    it('should log batch errors', () => {
      initializeWebhookProcessor();

      const webhooks = [createQueuedWebhook(), createQueuedWebhook()];
      const error = new Error('Batch failed');

      defaultWebhookQueue.emit('webhook:batch-error', { webhooks, error });

      expect(mockConsoleError).toHaveBeenCalledWith(
        '❌ Batch processing failed for 2 webhooks:',
        error
      );
    });
  });

  describe('processWebhookBatch', () => {
    it('should process each webhook in the batch', async () => {
      const mockHandler = vi.fn().mockResolvedValue(undefined);
      vi.mocked(defaultWebhookRegistry.getHandler).mockReturnValue({
        pluginName: 'test-plugin',
        handler: mockHandler,
      });
      vi.mocked(getWebhookHooks).mockReturnValue({});

      const webhooks = [
        createQueuedWebhook({ pluginName: 'plugin-1' }),
        createQueuedWebhook({ pluginName: 'plugin-2' }),
      ];

      const batch = await processWebhookBatch(webhooks);

      expect(batch.webhooks).toBe(webhooks);
      expect(batch.startedAt).toBeLessThanOrEqual(batch.completedAt);
      expect(mockHandler).toHaveBeenCalledTimes(2);
    });

    it('should run onBeforeWebhookTriggered hook before processing', async () => {
      const mockBeforeHook = vi.fn().mockResolvedValue(undefined);
      const mockHandler = vi.fn().mockResolvedValue(undefined);
      vi.mocked(getWebhookHooks).mockReturnValue({
        onBeforeWebhookTriggered: mockBeforeHook,
      });
      vi.mocked(defaultWebhookRegistry.getHandler).mockReturnValue({
        pluginName: 'test-plugin',
        handler: mockHandler,
      });

      const webhooks = [createQueuedWebhook()];

      await processWebhookBatch(webhooks);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        '🪝 Running onBeforeWebhookTriggered hook...'
      );
      expect(mockBeforeHook).toHaveBeenCalledWith({
        batch: expect.objectContaining({ webhooks }),
        store: expect.anything(),
      });
      // Verify hook was called before handler
      const hookOrder = mockBeforeHook.mock.invocationCallOrder[0];
      const handlerOrder = mockHandler.mock.invocationCallOrder[0];
      expect(hookOrder).toBeDefined();
      expect(handlerOrder).toBeDefined();
      expect(hookOrder!).toBeLessThan(handlerOrder!);
    });

    it('should catch and log onBeforeWebhookTriggered hook errors but continue processing', async () => {
      const hookError = new Error('Before hook failed');
      const mockBeforeHook = vi.fn().mockRejectedValue(hookError);
      const mockHandler = vi.fn().mockResolvedValue(undefined);
      vi.mocked(getWebhookHooks).mockReturnValue({
        onBeforeWebhookTriggered: mockBeforeHook,
      });
      vi.mocked(defaultWebhookRegistry.getHandler).mockReturnValue({
        pluginName: 'test-plugin',
        handler: mockHandler,
      });

      const webhooks = [createQueuedWebhook()];

      const batch = await processWebhookBatch(webhooks);

      expect(mockConsoleError).toHaveBeenCalledWith(
        '❌ onBeforeWebhookTriggered hook error:',
        hookError
      );
      // Processing should continue despite hook error
      expect(mockHandler).toHaveBeenCalled();
      expect(batch.completedAt).toBeGreaterThan(0);
    });

    it('should skip onBeforeWebhookTriggered if hook is not defined', async () => {
      vi.mocked(getWebhookHooks).mockReturnValue({});
      vi.mocked(defaultWebhookRegistry.getHandler).mockReturnValue({
        pluginName: 'test-plugin',
        handler: vi.fn().mockResolvedValue(undefined),
      });

      const webhooks = [createQueuedWebhook()];

      await processWebhookBatch(webhooks);

      expect(mockConsoleLog).not.toHaveBeenCalledWith(
        '🪝 Running onBeforeWebhookTriggered hook...'
      );
    });

    it('should return batch with correct timestamps', async () => {
      vi.mocked(getWebhookHooks).mockReturnValue({});
      vi.mocked(defaultWebhookRegistry.getHandler).mockReturnValue(undefined);

      const webhooks = [createQueuedWebhook()];
      const beforeTime = Date.now();

      const batch = await processWebhookBatch(webhooks);

      expect(batch.startedAt).toBeGreaterThanOrEqual(beforeTime);
      expect(batch.completedAt).toBeGreaterThanOrEqual(batch.startedAt);
    });

    it('should handle empty webhook array', async () => {
      vi.mocked(getWebhookHooks).mockReturnValue({});

      const batch = await processWebhookBatch([]);

      expect(batch.webhooks).toEqual([]);
      expect(batch.completedAt).toBeGreaterThan(0);
    });
  });

  describe('createMockRequest', () => {
    it('should create a mock request with correct properties', async () => {
      const mockHandler = vi.fn().mockImplementation((req, _res, _context) => {
        // Verify mock request properties
        expect(req.method).toBe('POST');
        expect(req.url).toBe('/_webhooks/test-plugin/sync');
        expect(req.headers).toEqual({
          'content-type': 'application/json',
          'x-custom': 'header',
        });
        expect(req.httpVersion).toBe('1.1');
        expect(req.httpVersionMajor).toBe(1);
        expect(req.httpVersionMinor).toBe(1);
        expect(req.complete).toBe(true);
        expect(req.aborted).toBe(false);
        expect(req.rawHeaders).toEqual([]);
        expect(req.trailers).toEqual({});
        expect(req.rawTrailers).toEqual([]);
        return Promise.resolve();
      });

      vi.mocked(defaultWebhookRegistry.getHandler).mockReturnValue({
        pluginName: 'test-plugin',
        handler: mockHandler,
      });
      vi.mocked(getWebhookHooks).mockReturnValue({});

      const webhook = createQueuedWebhook({
        headers: { 'content-type': 'application/json', 'x-custom': 'header' },
      });

      await processWebhookBatch([webhook]);

      expect(mockHandler).toHaveBeenCalled();
    });

    it('should have setTimeout and destroy methods on mock request', async () => {
      const mockHandler = vi.fn().mockImplementation((req, _res, _context) => {
        expect(typeof req.setTimeout).toBe('function');
        expect(typeof req.destroy).toBe('function');
        // Both should return the emitter (self)
        const result = req.setTimeout();
        expect(result).toBe(req);
        const destroyResult = req.destroy();
        expect(destroyResult).toBe(req);
        return Promise.resolve();
      });

      vi.mocked(defaultWebhookRegistry.getHandler).mockReturnValue({
        pluginName: 'test-plugin',
        handler: mockHandler,
      });
      vi.mocked(getWebhookHooks).mockReturnValue({});

      await processWebhookBatch([createQueuedWebhook()]);

      expect(mockHandler).toHaveBeenCalled();
    });
  });

  describe('createMockResponse', () => {
    it('should create a mock response with correct properties', async () => {
      const mockHandler = vi.fn().mockImplementation((_req, res, _context) => {
        // Verify initial mock response properties
        expect(res.statusCode).toBe(200);
        expect(res.statusMessage).toBe('OK');
        expect(res.headersSent).toBe(false);
        expect(res.writableEnded).toBe(false);
        return Promise.resolve();
      });

      vi.mocked(defaultWebhookRegistry.getHandler).mockReturnValue({
        pluginName: 'test-plugin',
        handler: mockHandler,
      });
      vi.mocked(getWebhookHooks).mockReturnValue({});

      await processWebhookBatch([createQueuedWebhook()]);

      expect(mockHandler).toHaveBeenCalled();
    });

    it('should track headersSent and writableEnded after writeHead', async () => {
      const mockHandler = vi.fn().mockImplementation((_req, res, _context) => {
        expect(res.writableEnded).toBe(false);
        res.writeHead(200);
        // After writeHead, headersSent should be true
        expect(res.writableEnded).toBe(true);
        return Promise.resolve();
      });

      vi.mocked(defaultWebhookRegistry.getHandler).mockReturnValue({
        pluginName: 'test-plugin',
        handler: mockHandler,
      });
      vi.mocked(getWebhookHooks).mockReturnValue({});

      await processWebhookBatch([createQueuedWebhook()]);

      expect(mockHandler).toHaveBeenCalled();
    });

    it('should track headersSent after end', async () => {
      const mockHandler = vi.fn().mockImplementation((_req, res, _context) => {
        expect(res.writableEnded).toBe(false);
        res.end();
        expect(res.writableEnded).toBe(true);
        return Promise.resolve();
      });

      vi.mocked(defaultWebhookRegistry.getHandler).mockReturnValue({
        pluginName: 'test-plugin',
        handler: mockHandler,
      });
      vi.mocked(getWebhookHooks).mockReturnValue({});

      await processWebhookBatch([createQueuedWebhook()]);

      expect(mockHandler).toHaveBeenCalled();
    });

    it('should have all required response methods', async () => {
      const mockHandler = vi.fn().mockImplementation((_req, res, _context) => {
        expect(typeof res.writeHead).toBe('function');
        expect(typeof res.setHeader).toBe('function');
        expect(typeof res.getHeader).toBe('function');
        expect(typeof res.removeHeader).toBe('function');
        expect(typeof res.write).toBe('function');
        expect(typeof res.end).toBe('function');
        expect(typeof res.flushHeaders).toBe('function');
        expect(typeof res.addTrailers).toBe('function');
        expect(typeof res.setTimeout).toBe('function');
        expect(typeof res.destroy).toBe('function');
        expect(typeof res.cork).toBe('function');
        expect(typeof res.uncork).toBe('function');
        expect(typeof res.assignSocket).toBe('function');
        expect(typeof res.detachSocket).toBe('function');
        expect(typeof res.writeContinue).toBe('function');
        expect(typeof res.writeEarlyHints).toBe('function');
        expect(typeof res.writeProcessing).toBe('function');

        // Test return values
        expect(res.setHeader()).toBe(res);
        expect(res.getHeader()).toBeUndefined();
        expect(res.removeHeader()).toBeUndefined();
        expect(res.write()).toBe(true);
        expect(res.flushHeaders()).toBeUndefined();
        expect(res.addTrailers()).toBeUndefined();
        expect(res.setTimeout()).toBe(res);
        expect(res.destroy()).toBe(res);
        expect(res.cork()).toBeUndefined();
        expect(res.uncork()).toBeUndefined();
        expect(res.assignSocket()).toBeUndefined();
        expect(res.detachSocket()).toBeUndefined();
        expect(res.writeContinue()).toBeUndefined();
        expect(res.writeEarlyHints()).toBeUndefined();
        expect(res.writeProcessing()).toBeUndefined();

        return Promise.resolve();
      });

      vi.mocked(defaultWebhookRegistry.getHandler).mockReturnValue({
        pluginName: 'test-plugin',
        handler: mockHandler,
      });
      vi.mocked(getWebhookHooks).mockReturnValue({});

      await processWebhookBatch([createQueuedWebhook()]);

      expect(mockHandler).toHaveBeenCalled();
    });

    it('should return this from writeHead', async () => {
      const mockHandler = vi.fn().mockImplementation((_req, res, _context) => {
        const result = res.writeHead(200, { 'Content-Type': 'text/plain' });
        expect(result).toBe(res);
        return Promise.resolve();
      });

      vi.mocked(defaultWebhookRegistry.getHandler).mockReturnValue({
        pluginName: 'test-plugin',
        handler: mockHandler,
      });
      vi.mocked(getWebhookHooks).mockReturnValue({});

      await processWebhookBatch([createQueuedWebhook()]);

      expect(mockHandler).toHaveBeenCalled();
    });
  });

  describe('processWebhook context', () => {
    it('should pass correct context to handler', async () => {
      const mockHandler = vi.fn().mockImplementation((_req, _res, context) => {
        expect(context.store).toBeDefined();
        expect(context.actions).toBeDefined();
        expect(context.rawBody).toBeInstanceOf(Buffer);
        expect(context.body).toEqual({ test: true });
        return Promise.resolve();
      });

      vi.mocked(defaultWebhookRegistry.getHandler).mockReturnValue({
        pluginName: 'test-plugin',
        handler: mockHandler,
      });
      vi.mocked(getWebhookHooks).mockReturnValue({});

      const webhook = createQueuedWebhook({
        rawBody: Buffer.from('{"test": true}'),
        body: { test: true },
      });

      await processWebhookBatch([webhook]);

      expect(mockHandler).toHaveBeenCalled();
    });
  });
});
