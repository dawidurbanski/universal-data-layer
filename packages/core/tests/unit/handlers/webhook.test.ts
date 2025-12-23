import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import type { IncomingMessage, ServerResponse } from 'node:http';
import {
  isWebhookRequest,
  getPluginFromWebhookUrl,
  webhookHandler,
  WEBHOOK_PATH_PREFIX,
} from '@/handlers/webhook.js';
import {
  WebhookRegistry,
  setDefaultWebhookRegistry,
  WebhookQueue,
  setDefaultWebhookQueue,
  resetWebhookHooks,
  setWebhookHooks,
  type WebhookRegistration,
  type QueuedWebhook,
} from '@/webhooks/index.js';

// Create a mock request that extends EventEmitter to support .on() calls
function createMockRequest(
  method: string,
  url: string,
  headers: Record<string, string> = {}
): IncomingMessage & EventEmitter {
  const emitter = new EventEmitter();
  return Object.assign(emitter, {
    method,
    url,
    headers,
  }) as IncomingMessage & EventEmitter;
}

// Create a mock response
function createMockResponse(): ServerResponse & {
  _statusCode: number;
  _headers: Record<string, string>;
  _body: string;
  headersSent: boolean;
} {
  const res = {
    _statusCode: 0,
    _headers: {} as Record<string, string>,
    _body: '',
    headersSent: false,
    writeHead(statusCode: number, headers?: Record<string, string>) {
      this._statusCode = statusCode;
      this.headersSent = true;
      if (headers) {
        Object.assign(this._headers, headers);
      }
      return this;
    },
    end(body?: string) {
      if (body) {
        this._body = body;
      }
    },
  };
  return res as unknown as ServerResponse & {
    _statusCode: number;
    _headers: Record<string, string>;
    _body: string;
    headersSent: boolean;
  };
}

// Helper to emit body data on a mock request after a small delay
// This allows the handler to set up event listeners before data is emitted
function emitBody(
  req: IncomingMessage & EventEmitter,
  body: string | Buffer
): void {
  const buffer = Buffer.isBuffer(body) ? body : Buffer.from(body);
  // Use setImmediate to allow the handler to register event listeners first
  setImmediate(() => {
    req.emit('data', buffer);
    req.emit('end');
  });
}

// Sample webhook handler for testing (simplified - no path)
function createTestWebhook(): WebhookRegistration {
  return {
    handler: async (_req, res, _context) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ received: true }));
    },
  };
}

describe('isWebhookRequest', () => {
  it('should return true for valid webhook URLs', () => {
    expect(isWebhookRequest('/_webhooks/plugin/sync')).toBe(true);
    expect(isWebhookRequest('/_webhooks/contentful/sync')).toBe(true);
    expect(isWebhookRequest('/_webhooks/my-plugin/sync')).toBe(true);
  });

  it('should return false for non-webhook URLs', () => {
    expect(isWebhookRequest('/graphql')).toBe(false);
    expect(isWebhookRequest('/health')).toBe(false);
    expect(isWebhookRequest('/ready')).toBe(false);
    expect(isWebhookRequest('/webhooks/plugin/sync')).toBe(false);
    expect(isWebhookRequest('/_webhook/plugin/sync')).toBe(false);
    expect(isWebhookRequest('/')).toBe(false);
  });

  it('should handle edge cases', () => {
    expect(isWebhookRequest('')).toBe(false);
    expect(isWebhookRequest('/_webhooks/')).toBe(true);
    expect(isWebhookRequest('/_webhooks')).toBe(false);
  });
});

describe('getPluginFromWebhookUrl', () => {
  it('should extract plugin name from valid webhook URLs', () => {
    expect(getPluginFromWebhookUrl('/_webhooks/plugin/sync')).toBe('plugin');
    expect(getPluginFromWebhookUrl('/_webhooks/contentful/sync')).toBe(
      'contentful'
    );
    expect(getPluginFromWebhookUrl('/_webhooks/my-plugin/sync')).toBe(
      'my-plugin'
    );
  });

  it('should handle query strings', () => {
    expect(getPluginFromWebhookUrl('/_webhooks/plugin/sync?foo=bar')).toBe(
      'plugin'
    );
  });

  it('should return null for invalid URLs', () => {
    expect(getPluginFromWebhookUrl('/graphql')).toBeNull();
    expect(getPluginFromWebhookUrl('/_webhooks/')).toBeNull();
    expect(getPluginFromWebhookUrl('/_webhooks/plugin')).toBeNull();
    expect(getPluginFromWebhookUrl('/_webhooks/plugin/')).toBeNull();
    expect(getPluginFromWebhookUrl('/_webhooks/plugin/other-path')).toBeNull();
  });
});

describe('WEBHOOK_PATH_PREFIX', () => {
  it('should be /_webhooks/', () => {
    expect(WEBHOOK_PATH_PREFIX).toBe('/_webhooks/');
  });
});

describe('webhookHandler', () => {
  let registry: WebhookRegistry;
  let queue: WebhookQueue;

  beforeEach(() => {
    registry = new WebhookRegistry();
    setDefaultWebhookRegistry(registry);
    queue = new WebhookQueue({ debounceMs: 5000 });
    setDefaultWebhookQueue(queue);
    resetWebhookHooks();
  });

  describe('HTTP method validation', () => {
    it('should return 405 for GET requests', async () => {
      const req = createMockRequest('GET', '/_webhooks/plugin/sync');
      const res = createMockResponse();

      await webhookHandler(req, res);

      expect(res._statusCode).toBe(405);
      const body = JSON.parse(res._body);
      expect(body.error).toBe('Method not allowed');
    });

    it('should return 405 for PUT requests', async () => {
      const req = createMockRequest('PUT', '/_webhooks/plugin/sync');
      const res = createMockResponse();

      await webhookHandler(req, res);

      expect(res._statusCode).toBe(405);
    });

    it('should return 405 for DELETE requests', async () => {
      const req = createMockRequest('DELETE', '/_webhooks/plugin/sync');
      const res = createMockResponse();

      await webhookHandler(req, res);

      expect(res._statusCode).toBe(405);
    });
  });

  describe('URL parsing and handler lookup', () => {
    it('should return 404 for invalid URL format', async () => {
      const req = createMockRequest('POST', '/_webhooks/');
      const res = createMockResponse();

      emitBody(req, '{}');
      await webhookHandler(req, res);

      expect(res._statusCode).toBe(404);
      const body = JSON.parse(res._body);
      expect(body.error).toContain('Invalid webhook URL format');
    });

    it('should return 404 for missing /sync path', async () => {
      const req = createMockRequest('POST', '/_webhooks/plugin');
      const res = createMockResponse();

      emitBody(req, '{}');
      await webhookHandler(req, res);

      expect(res._statusCode).toBe(404);
      const body = JSON.parse(res._body);
      expect(body.error).toContain('Invalid webhook URL format');
    });

    it('should return 404 for wrong path', async () => {
      registry.register('plugin', createTestWebhook());

      const req = createMockRequest('POST', '/_webhooks/plugin/other-path');
      const res = createMockResponse();

      emitBody(req, '{}');
      await webhookHandler(req, res);

      expect(res._statusCode).toBe(404);
    });

    it('should return 404 when no handler is registered', async () => {
      const req = createMockRequest('POST', '/_webhooks/unknown-plugin/sync');
      const res = createMockResponse();

      emitBody(req, '{}');
      await webhookHandler(req, res);

      expect(res._statusCode).toBe(404);
      const body = JSON.parse(res._body);
      expect(body.error).toBe('Webhook handler not found');
    });

    it('should return 404 for wrong plugin name', async () => {
      registry.register('plugin-a', createTestWebhook());

      const req = createMockRequest('POST', '/_webhooks/plugin-b/sync');
      const res = createMockResponse();

      emitBody(req, '{}');
      await webhookHandler(req, res);

      expect(res._statusCode).toBe(404);
    });
  });

  describe('JSON body parsing', () => {
    it('should return 400 for invalid JSON with application/json content-type', async () => {
      registry.register('plugin', createTestWebhook());

      const req = createMockRequest('POST', '/_webhooks/plugin/sync', {
        'content-type': 'application/json',
      });
      const res = createMockResponse();

      emitBody(req, 'invalid json {{{');
      await webhookHandler(req, res);

      expect(res._statusCode).toBe(400);
      const body = JSON.parse(res._body);
      expect(body.error).toBe('Invalid JSON body');
    });

    it('should queue webhook with parsed JSON body', async () => {
      const consoleLogSpy = vi
        .spyOn(console, 'log')
        .mockImplementation(() => {});
      let queuedWebhook: QueuedWebhook | undefined;

      // Listen for enqueue
      const originalEnqueue = queue.enqueue.bind(queue);
      queue.enqueue = (webhook: QueuedWebhook) => {
        queuedWebhook = webhook;
        originalEnqueue(webhook);
      };

      registry.register('plugin', createTestWebhook());

      const req = createMockRequest('POST', '/_webhooks/plugin/sync', {
        'content-type': 'application/json',
      });
      const res = createMockResponse();

      const payload = { type: 'entry.publish', data: { id: '123' } };
      emitBody(req, JSON.stringify(payload));
      await webhookHandler(req, res);

      expect(res._statusCode).toBe(202);
      expect(queuedWebhook?.body).toEqual(payload);

      consoleLogSpy.mockRestore();
    });

    it('should queue webhook with undefined body for non-JSON content types', async () => {
      const consoleLogSpy = vi
        .spyOn(console, 'log')
        .mockImplementation(() => {});
      let queuedWebhook: QueuedWebhook | undefined;

      // Listen for enqueue
      const originalEnqueue = queue.enqueue.bind(queue);
      queue.enqueue = (webhook: QueuedWebhook) => {
        queuedWebhook = webhook;
        originalEnqueue(webhook);
      };

      registry.register('plugin', createTestWebhook());

      const req = createMockRequest('POST', '/_webhooks/plugin/sync', {
        'content-type': 'text/plain',
      });
      const res = createMockResponse();

      emitBody(req, 'plain text body');
      await webhookHandler(req, res);

      expect(res._statusCode).toBe(202);
      expect(queuedWebhook?.body).toBeUndefined();

      consoleLogSpy.mockRestore();
    });

    it('should queue webhook with rawBody buffer', async () => {
      const consoleLogSpy = vi
        .spyOn(console, 'log')
        .mockImplementation(() => {});
      let queuedWebhook: QueuedWebhook | undefined;

      // Listen for enqueue
      const originalEnqueue = queue.enqueue.bind(queue);
      queue.enqueue = (webhook: QueuedWebhook) => {
        queuedWebhook = webhook;
        originalEnqueue(webhook);
      };

      registry.register('plugin', createTestWebhook());

      const req = createMockRequest('POST', '/_webhooks/plugin/sync');
      const res = createMockResponse();

      const bodyText = 'raw body content';
      emitBody(req, bodyText);
      await webhookHandler(req, res);

      expect(res._statusCode).toBe(202);
      expect(queuedWebhook?.rawBody).toBeInstanceOf(Buffer);
      expect(queuedWebhook?.rawBody.toString()).toBe(bodyText);

      consoleLogSpy.mockRestore();
    });
  });

  describe('webhook queuing', () => {
    it('should queue webhook with correct metadata', async () => {
      const consoleLogSpy = vi
        .spyOn(console, 'log')
        .mockImplementation(() => {});
      let queuedWebhook: QueuedWebhook | undefined;

      // Listen for enqueue
      const originalEnqueue = queue.enqueue.bind(queue);
      queue.enqueue = (webhook: QueuedWebhook) => {
        queuedWebhook = webhook;
        originalEnqueue(webhook);
      };

      registry.register('test-plugin', createTestWebhook());

      const req = createMockRequest('POST', '/_webhooks/test-plugin/sync', {
        'content-type': 'application/json',
      });
      const res = createMockResponse();

      emitBody(req, '{"test": true}');
      await webhookHandler(req, res);

      expect(res._statusCode).toBe(202);
      expect(queuedWebhook).toBeDefined();
      expect(queuedWebhook?.pluginName).toBe('test-plugin');
      expect(queuedWebhook?.body).toEqual({ test: true });
      expect(queuedWebhook?.rawBody).toBeInstanceOf(Buffer);
      expect(queuedWebhook?.timestamp).toBeGreaterThan(0);

      consoleLogSpy.mockRestore();
    });

    it('should return 202 with queued response', async () => {
      const consoleLogSpy = vi
        .spyOn(console, 'log')
        .mockImplementation(() => {});

      registry.register('plugin', createTestWebhook());

      const req = createMockRequest('POST', '/_webhooks/plugin/sync');
      const res = createMockResponse();

      emitBody(req, '{}');
      await webhookHandler(req, res);

      expect(res._statusCode).toBe(202);
      const body = JSON.parse(res._body);
      expect(body.queued).toBe(true);

      consoleLogSpy.mockRestore();
    });

    it('should log webhook received message', async () => {
      const consoleLogSpy = vi
        .spyOn(console, 'log')
        .mockImplementation(() => {});

      registry.register('my-plugin', createTestWebhook());

      const req = createMockRequest('POST', '/_webhooks/my-plugin/sync');
      const res = createMockResponse();

      emitBody(req, '{}');
      await webhookHandler(req, res);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        'Webhook received: my-plugin/sync'
      );

      consoleLogSpy.mockRestore();
    });

    it('should include headers in queued webhook', async () => {
      const consoleLogSpy = vi
        .spyOn(console, 'log')
        .mockImplementation(() => {});
      let queuedWebhook: QueuedWebhook | undefined;

      // Listen for enqueue
      const originalEnqueue = queue.enqueue.bind(queue);
      queue.enqueue = (webhook: QueuedWebhook) => {
        queuedWebhook = webhook;
        originalEnqueue(webhook);
      };

      registry.register('plugin', createTestWebhook());

      const req = createMockRequest('POST', '/_webhooks/plugin/sync', {
        'content-type': 'application/json',
        'x-custom-header': 'custom-value',
      });
      const res = createMockResponse();

      emitBody(req, '{}');
      await webhookHandler(req, res);

      expect(res._statusCode).toBe(202);
      expect(queuedWebhook?.headers['content-type']).toBe('application/json');
      expect(queuedWebhook?.headers['x-custom-header']).toBe('custom-value');

      consoleLogSpy.mockRestore();
    });
  });

  describe('onWebhookReceived hook', () => {
    it('should call onWebhookReceived hook when configured', async () => {
      const consoleLogSpy = vi
        .spyOn(console, 'log')
        .mockImplementation(() => {});
      const hookCalled = vi.fn();

      setWebhookHooks({
        onWebhookReceived: async ({ webhook }) => {
          hookCalled(webhook);
          return webhook;
        },
      });

      registry.register('plugin', createTestWebhook());

      const req = createMockRequest('POST', '/_webhooks/plugin/sync');
      const res = createMockResponse();

      emitBody(req, '{}');
      await webhookHandler(req, res);

      expect(hookCalled).toHaveBeenCalled();
      expect(res._statusCode).toBe(202);

      consoleLogSpy.mockRestore();
    });

    it('should skip webhook when onWebhookReceived returns null', async () => {
      const consoleLogSpy = vi
        .spyOn(console, 'log')
        .mockImplementation(() => {});

      setWebhookHooks({
        onWebhookReceived: async () => null,
      });

      registry.register('plugin', createTestWebhook());

      const req = createMockRequest('POST', '/_webhooks/plugin/sync');
      const res = createMockResponse();

      emitBody(req, '{}');
      await webhookHandler(req, res);

      expect(res._statusCode).toBe(200);
      const body = JSON.parse(res._body);
      expect(body.skipped).toBe(true);
      expect(queue.size()).toBe(0);

      consoleLogSpy.mockRestore();
    });

    it('should use transformed webhook from onWebhookReceived', async () => {
      const consoleLogSpy = vi
        .spyOn(console, 'log')
        .mockImplementation(() => {});
      let queuedWebhook: QueuedWebhook | undefined;

      // Listen for enqueue
      const originalEnqueue = queue.enqueue.bind(queue);
      queue.enqueue = (webhook: QueuedWebhook) => {
        queuedWebhook = webhook;
        originalEnqueue(webhook);
      };

      setWebhookHooks({
        onWebhookReceived: async ({ webhook }) => ({
          ...webhook,
          body: { transformed: true, original: webhook.body },
        }),
      });

      registry.register('plugin', createTestWebhook());

      const req = createMockRequest('POST', '/_webhooks/plugin/sync', {
        'content-type': 'application/json',
      });
      const res = createMockResponse();

      emitBody(req, '{"original": "data"}');
      await webhookHandler(req, res);

      expect(res._statusCode).toBe(202);
      expect(queuedWebhook?.body).toEqual({
        transformed: true,
        original: { original: 'data' },
      });

      consoleLogSpy.mockRestore();
    });

    it('should continue with original webhook if onWebhookReceived throws', async () => {
      const consoleLogSpy = vi
        .spyOn(console, 'log')
        .mockImplementation(() => {});
      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      let queuedWebhook: QueuedWebhook | undefined;

      // Listen for enqueue
      const originalEnqueue = queue.enqueue.bind(queue);
      queue.enqueue = (webhook: QueuedWebhook) => {
        queuedWebhook = webhook;
        originalEnqueue(webhook);
      };

      setWebhookHooks({
        onWebhookReceived: async () => {
          throw new Error('Hook error');
        },
      });

      registry.register('plugin', createTestWebhook());

      const req = createMockRequest('POST', '/_webhooks/plugin/sync', {
        'content-type': 'application/json',
      });
      const res = createMockResponse();

      emitBody(req, '{"test": true}');
      await webhookHandler(req, res);

      // Should still queue the original webhook
      expect(res._statusCode).toBe(202);
      expect(queuedWebhook?.body).toEqual({ test: true });
      expect(consoleErrorSpy).toHaveBeenCalled();

      consoleLogSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    });
  });

  describe('body size limit', () => {
    it('should return 413 for oversized body', async () => {
      registry.register('plugin', createTestWebhook());

      const req = createMockRequest('POST', '/_webhooks/plugin/sync');
      const res = createMockResponse();

      // Add destroy method to mock request
      let destroyed = false;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (req as any).destroy = () => {
        destroyed = true;
      };

      // Create a body larger than 1MB and emit immediately
      const largeBody = Buffer.alloc(1024 * 1024 + 1, 'x');
      setImmediate(() => {
        req.emit('data', largeBody);
        // Don't emit 'end' - the handler should reject before that
      });

      await webhookHandler(req, res);

      expect(res._statusCode).toBe(413);
      const body = JSON.parse(res._body);
      expect(body.error).toBe('Payload too large');
      expect(destroyed).toBe(true);
    });
  });
});
