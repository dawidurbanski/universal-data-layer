import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import type { IncomingMessage, ServerResponse } from 'node:http';
import {
  isWebhookRequest,
  parseWebhookUrl,
  webhookHandler,
  WEBHOOK_PATH_PREFIX,
} from '@/handlers/webhook.js';
import {
  WebhookRegistry,
  setDefaultWebhookRegistry,
  type WebhookRegistration,
  type WebhookHandlerContext,
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

// Sample webhook handler for testing
function createTestWebhook(
  path: string,
  options: {
    handler?: WebhookRegistration['handler'];
    verifySignature?: WebhookRegistration['verifySignature'];
  } = {}
): WebhookRegistration {
  const webhook: WebhookRegistration = {
    path,
    handler:
      options.handler ||
      (async (_req, res, _context) => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ received: true }));
      }),
  };
  if (options.verifySignature) {
    webhook.verifySignature = options.verifySignature;
  }
  return webhook;
}

describe('isWebhookRequest', () => {
  it('should return true for valid webhook URLs', () => {
    expect(isWebhookRequest('/_webhooks/plugin/path')).toBe(true);
    expect(isWebhookRequest('/_webhooks/contentful/entry-update')).toBe(true);
    expect(isWebhookRequest('/_webhooks/my-plugin/sync')).toBe(true);
  });

  it('should return false for non-webhook URLs', () => {
    expect(isWebhookRequest('/graphql')).toBe(false);
    expect(isWebhookRequest('/health')).toBe(false);
    expect(isWebhookRequest('/ready')).toBe(false);
    expect(isWebhookRequest('/webhooks/plugin/path')).toBe(false);
    expect(isWebhookRequest('/_webhook/plugin/path')).toBe(false);
    expect(isWebhookRequest('/')).toBe(false);
  });

  it('should handle edge cases', () => {
    expect(isWebhookRequest('')).toBe(false);
    expect(isWebhookRequest('/_webhooks/')).toBe(true);
    expect(isWebhookRequest('/_webhooks')).toBe(false);
  });
});

describe('parseWebhookUrl', () => {
  it('should parse valid webhook URLs', () => {
    expect(parseWebhookUrl('/_webhooks/plugin/path')).toEqual({
      pluginName: 'plugin',
      webhookPath: 'path',
    });

    expect(parseWebhookUrl('/_webhooks/contentful/entry-update')).toEqual({
      pluginName: 'contentful',
      webhookPath: 'entry-update',
    });

    expect(parseWebhookUrl('/_webhooks/my-plugin/sync')).toEqual({
      pluginName: 'my-plugin',
      webhookPath: 'sync',
    });
  });

  it('should handle multi-segment paths', () => {
    expect(parseWebhookUrl('/_webhooks/plugin/path/subpath')).toEqual({
      pluginName: 'plugin',
      webhookPath: 'path/subpath',
    });
  });

  it('should handle query strings', () => {
    expect(parseWebhookUrl('/_webhooks/plugin/path?foo=bar')).toEqual({
      pluginName: 'plugin',
      webhookPath: 'path',
    });
  });

  it('should return null for invalid URLs', () => {
    expect(parseWebhookUrl('/graphql')).toBeNull();
    expect(parseWebhookUrl('/_webhooks/')).toBeNull();
    expect(parseWebhookUrl('/_webhooks/plugin')).toBeNull();
    expect(parseWebhookUrl('/_webhooks/plugin/')).toBeNull();
  });
});

describe('WEBHOOK_PATH_PREFIX', () => {
  it('should be /_webhooks/', () => {
    expect(WEBHOOK_PATH_PREFIX).toBe('/_webhooks/');
  });
});

describe('webhookHandler', () => {
  let registry: WebhookRegistry;

  beforeEach(() => {
    registry = new WebhookRegistry();
    setDefaultWebhookRegistry(registry);
  });

  describe('HTTP method validation', () => {
    it('should return 405 for GET requests', async () => {
      const req = createMockRequest('GET', '/_webhooks/plugin/path');
      const res = createMockResponse();

      await webhookHandler(req, res);

      expect(res._statusCode).toBe(405);
      const body = JSON.parse(res._body);
      expect(body.error).toBe('Method not allowed');
    });

    it('should return 405 for PUT requests', async () => {
      const req = createMockRequest('PUT', '/_webhooks/plugin/path');
      const res = createMockResponse();

      await webhookHandler(req, res);

      expect(res._statusCode).toBe(405);
    });

    it('should return 405 for DELETE requests', async () => {
      const req = createMockRequest('DELETE', '/_webhooks/plugin/path');
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
      expect(body.error).toBe('Invalid webhook URL format');
    });

    it('should return 404 when no handler is registered', async () => {
      const req = createMockRequest('POST', '/_webhooks/unknown-plugin/path');
      const res = createMockResponse();

      emitBody(req, '{}');
      await webhookHandler(req, res);

      expect(res._statusCode).toBe(404);
      const body = JSON.parse(res._body);
      expect(body.error).toBe('Webhook handler not found');
    });

    it('should return 404 for wrong plugin name', async () => {
      registry.register('plugin-a', createTestWebhook('path'));

      const req = createMockRequest('POST', '/_webhooks/plugin-b/path');
      const res = createMockResponse();

      emitBody(req, '{}');
      await webhookHandler(req, res);

      expect(res._statusCode).toBe(404);
    });

    it('should return 404 for wrong path', async () => {
      registry.register('plugin', createTestWebhook('path-a'));

      const req = createMockRequest('POST', '/_webhooks/plugin/path-b');
      const res = createMockResponse();

      emitBody(req, '{}');
      await webhookHandler(req, res);

      expect(res._statusCode).toBe(404);
    });
  });

  describe('signature verification', () => {
    it('should return 401 when verifySignature returns false', async () => {
      const consoleWarnSpy = vi
        .spyOn(console, 'warn')
        .mockImplementation(() => {});

      registry.register(
        'plugin',
        createTestWebhook('path', {
          verifySignature: () => false,
        })
      );

      const req = createMockRequest('POST', '/_webhooks/plugin/path');
      const res = createMockResponse();

      emitBody(req, '{}');
      await webhookHandler(req, res);

      expect(res._statusCode).toBe(401);
      const body = JSON.parse(res._body);
      expect(body.error).toBe('Invalid signature');
      expect(consoleWarnSpy).toHaveBeenCalled();

      consoleWarnSpy.mockRestore();
    });

    it('should return 401 when verifySignature throws', async () => {
      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      registry.register(
        'plugin',
        createTestWebhook('path', {
          verifySignature: () => {
            throw new Error('Signature error');
          },
        })
      );

      const req = createMockRequest('POST', '/_webhooks/plugin/path');
      const res = createMockResponse();

      emitBody(req, '{}');
      await webhookHandler(req, res);

      expect(res._statusCode).toBe(401);
      const body = JSON.parse(res._body);
      expect(body.error).toBe('Signature verification failed');

      consoleErrorSpy.mockRestore();
    });

    it('should call handler when verifySignature returns true', async () => {
      const consoleLogSpy = vi
        .spyOn(console, 'log')
        .mockImplementation(() => {});
      const handlerCalled = vi.fn();

      registry.register(
        'plugin',
        createTestWebhook('path', {
          verifySignature: () => true,
          handler: async (_req, res, _context) => {
            handlerCalled();
            res.writeHead(200);
            res.end('OK');
          },
        })
      );

      const req = createMockRequest('POST', '/_webhooks/plugin/path');
      const res = createMockResponse();

      emitBody(req, '{}');
      await webhookHandler(req, res);

      expect(res._statusCode).toBe(200);
      expect(handlerCalled).toHaveBeenCalled();

      consoleLogSpy.mockRestore();
    });

    it('should support async verifySignature', async () => {
      const consoleLogSpy = vi
        .spyOn(console, 'log')
        .mockImplementation(() => {});

      registry.register(
        'plugin',
        createTestWebhook('path', {
          verifySignature: async () => {
            await new Promise((resolve) => setTimeout(resolve, 10));
            return true;
          },
        })
      );

      const req = createMockRequest('POST', '/_webhooks/plugin/path');
      const res = createMockResponse();

      emitBody(req, '{}');
      await webhookHandler(req, res);

      expect(res._statusCode).toBe(200);

      consoleLogSpy.mockRestore();
    });

    it('should skip verification if no verifySignature defined', async () => {
      const consoleLogSpy = vi
        .spyOn(console, 'log')
        .mockImplementation(() => {});

      registry.register('plugin', createTestWebhook('path'));

      const req = createMockRequest('POST', '/_webhooks/plugin/path');
      const res = createMockResponse();

      emitBody(req, '{}');
      await webhookHandler(req, res);

      expect(res._statusCode).toBe(200);

      consoleLogSpy.mockRestore();
    });
  });

  describe('JSON body parsing', () => {
    it('should return 400 for invalid JSON with application/json content-type', async () => {
      registry.register('plugin', createTestWebhook('path'));

      const req = createMockRequest('POST', '/_webhooks/plugin/path', {
        'content-type': 'application/json',
      });
      const res = createMockResponse();

      emitBody(req, 'invalid json {{{');
      await webhookHandler(req, res);

      expect(res._statusCode).toBe(400);
      const body = JSON.parse(res._body);
      expect(body.error).toBe('Invalid JSON body');
    });

    it('should parse valid JSON body', async () => {
      const consoleLogSpy = vi
        .spyOn(console, 'log')
        .mockImplementation(() => {});
      let receivedContext: WebhookHandlerContext | undefined;

      registry.register(
        'plugin',
        createTestWebhook('path', {
          handler: async (_req, res, context) => {
            receivedContext = context;
            res.writeHead(200);
            res.end('OK');
          },
        })
      );

      const req = createMockRequest('POST', '/_webhooks/plugin/path', {
        'content-type': 'application/json',
      });
      const res = createMockResponse();

      const payload = { type: 'entry.publish', data: { id: '123' } };
      emitBody(req, JSON.stringify(payload));
      await webhookHandler(req, res);

      expect(res._statusCode).toBe(200);
      expect(receivedContext?.body).toEqual(payload);

      consoleLogSpy.mockRestore();
    });

    it('should pass undefined body for non-JSON content types', async () => {
      const consoleLogSpy = vi
        .spyOn(console, 'log')
        .mockImplementation(() => {});
      let receivedContext: WebhookHandlerContext | undefined;

      registry.register(
        'plugin',
        createTestWebhook('path', {
          handler: async (_req, res, context) => {
            receivedContext = context;
            res.writeHead(200);
            res.end('OK');
          },
        })
      );

      const req = createMockRequest('POST', '/_webhooks/plugin/path', {
        'content-type': 'text/plain',
      });
      const res = createMockResponse();

      emitBody(req, 'plain text body');
      await webhookHandler(req, res);

      expect(res._statusCode).toBe(200);
      expect(receivedContext?.body).toBeUndefined();

      consoleLogSpy.mockRestore();
    });

    it('should always pass rawBody buffer', async () => {
      const consoleLogSpy = vi
        .spyOn(console, 'log')
        .mockImplementation(() => {});
      let receivedContext: WebhookHandlerContext | undefined;

      registry.register(
        'plugin',
        createTestWebhook('path', {
          handler: async (_req, res, context) => {
            receivedContext = context;
            res.writeHead(200);
            res.end('OK');
          },
        })
      );

      const req = createMockRequest('POST', '/_webhooks/plugin/path');
      const res = createMockResponse();

      const bodyText = 'raw body content';
      emitBody(req, bodyText);
      await webhookHandler(req, res);

      expect(res._statusCode).toBe(200);
      expect(receivedContext?.rawBody).toBeInstanceOf(Buffer);
      expect(receivedContext?.rawBody.toString()).toBe(bodyText);

      consoleLogSpy.mockRestore();
    });
  });

  describe('handler execution', () => {
    it('should call handler with correct context', async () => {
      const consoleLogSpy = vi
        .spyOn(console, 'log')
        .mockImplementation(() => {});
      let receivedContext: WebhookHandlerContext | undefined;

      registry.register(
        'test-plugin',
        createTestWebhook('update', {
          handler: async (_req, res, context) => {
            receivedContext = context;
            res.writeHead(200);
            res.end('OK');
          },
        })
      );

      const req = createMockRequest('POST', '/_webhooks/test-plugin/update', {
        'content-type': 'application/json',
      });
      const res = createMockResponse();

      emitBody(req, '{"test": true}');
      await webhookHandler(req, res);

      expect(receivedContext).toBeDefined();
      expect(receivedContext?.store).toBeDefined();
      expect(receivedContext?.actions).toBeDefined();
      expect(receivedContext?.actions.createNode).toBeDefined();
      expect(receivedContext?.actions.deleteNode).toBeDefined();
      expect(receivedContext?.rawBody).toBeInstanceOf(Buffer);
      expect(receivedContext?.body).toEqual({ test: true });

      consoleLogSpy.mockRestore();
    });

    it('should return 500 when handler throws', async () => {
      const consoleLogSpy = vi
        .spyOn(console, 'log')
        .mockImplementation(() => {});
      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      registry.register(
        'plugin',
        createTestWebhook('path', {
          handler: async () => {
            throw new Error('Handler error');
          },
        })
      );

      const req = createMockRequest('POST', '/_webhooks/plugin/path');
      const res = createMockResponse();

      emitBody(req, '{}');
      await webhookHandler(req, res);

      expect(res._statusCode).toBe(500);
      const body = JSON.parse(res._body);
      expect(body.error).toBe('Internal server error');
      expect(consoleErrorSpy).toHaveBeenCalled();

      consoleLogSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    });

    it('should not send error response if headers already sent', async () => {
      const consoleLogSpy = vi
        .spyOn(console, 'log')
        .mockImplementation(() => {});
      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      registry.register(
        'plugin',
        createTestWebhook('path', {
          handler: async (_req, res) => {
            res.writeHead(202);
            res.end('Accepted');
            throw new Error('Post-response error');
          },
        })
      );

      const req = createMockRequest('POST', '/_webhooks/plugin/path');
      const res = createMockResponse();

      emitBody(req, '{}');
      await webhookHandler(req, res);

      // Should keep the 202 status, not override with 500
      expect(res._statusCode).toBe(202);
      expect(res._body).toBe('Accepted');

      consoleLogSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    });

    it('should allow handler to set custom response', async () => {
      const consoleLogSpy = vi
        .spyOn(console, 'log')
        .mockImplementation(() => {});

      registry.register(
        'plugin',
        createTestWebhook('path', {
          handler: async (_req, res) => {
            res.writeHead(201, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ status: 'created' }));
          },
        })
      );

      const req = createMockRequest('POST', '/_webhooks/plugin/path');
      const res = createMockResponse();

      emitBody(req, '{}');
      await webhookHandler(req, res);

      expect(res._statusCode).toBe(201);
      const body = JSON.parse(res._body);
      expect(body.status).toBe('created');

      consoleLogSpy.mockRestore();
    });

    it('should log webhook received message', async () => {
      const consoleLogSpy = vi
        .spyOn(console, 'log')
        .mockImplementation(() => {});

      registry.register('my-plugin', createTestWebhook('my-path'));

      const req = createMockRequest('POST', '/_webhooks/my-plugin/my-path');
      const res = createMockResponse();

      emitBody(req, '{}');
      await webhookHandler(req, res);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        'Webhook received: my-plugin/my-path'
      );

      consoleLogSpy.mockRestore();
    });
  });

  describe('body size limit', () => {
    it('should return 413 for oversized body', async () => {
      registry.register('plugin', createTestWebhook('path'));

      const req = createMockRequest('POST', '/_webhooks/plugin/path');
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
