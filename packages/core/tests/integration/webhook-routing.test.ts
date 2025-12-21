import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import http, {
  createServer,
  type Server,
  type IncomingMessage,
} from 'node:http';
import { isWebhookRequest, webhookHandler } from '@/handlers/webhook.js';
import {
  WebhookRegistry,
  setDefaultWebhookRegistry,
  WebhookQueue,
  setDefaultWebhookQueue,
  resetWebhookHooks,
  processWebhookBatch,
  type WebhookRegistration,
  type WebhookHandlerContext,
} from '@/webhooks/index.js';
import { NodeStore } from '@/nodes/store.js';
import { setDefaultStore } from '@/nodes/defaultStore.js';

function makeRequest(
  server: Server,
  path: string,
  options: {
    method?: string;
    body?: string;
    headers?: Record<string, string>;
  } = {}
): Promise<{
  statusCode: number;
  headers: Record<string, string>;
  body: string;
}> {
  return new Promise((resolve, reject) => {
    const address = server.address();
    if (!address || typeof address === 'string') {
      reject(new Error('Server address not available'));
      return;
    }

    const { method = 'POST', body, headers = {} } = options;

    const req = http.request(
      {
        hostname: 'localhost',
        port: address.port,
        path,
        method,
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
      },
      (res: IncomingMessage) => {
        let responseBody = '';
        res.on('data', (chunk: Buffer) => {
          responseBody += chunk.toString();
        });
        res.on('end', () => {
          resolve({
            statusCode: res.statusCode ?? 0,
            headers: res.headers as Record<string, string>,
            body: responseBody,
          });
        });
      }
    );
    req.on('error', reject);
    if (body) {
      req.write(body);
    }
    req.end();
  });
}

describe('webhook routing integration', () => {
  let server: Server;
  let registry: WebhookRegistry;
  let store: NodeStore;

  beforeAll(() => {
    server = createServer((req, res) => {
      // Add CORS headers
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

      // Handle preflight
      if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
      }

      if (req.url && isWebhookRequest(req.url)) {
        void webhookHandler(req, res);
        return;
      }

      res.writeHead(404);
      res.end('Not found');
    });

    return new Promise<void>((resolve) => {
      server.listen(0, () => resolve());
    });
  });

  afterAll(() => {
    return new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  });

  let queue: WebhookQueue;

  beforeEach(() => {
    registry = new WebhookRegistry();
    setDefaultWebhookRegistry(registry);
    store = new NodeStore();
    setDefaultStore(store);
    // Create queue with batch processor that processes immediately
    queue = new WebhookQueue({
      debounceMs: 0, // No debounce for tests
      batchProcessor: processWebhookBatch,
    });
    setDefaultWebhookQueue(queue);
    resetWebhookHooks();
  });

  describe('webhook endpoint routing', () => {
    it('should return 404 for unregistered webhook', async () => {
      const response = await makeRequest(server, '/_webhooks/unknown/path', {
        body: '{}',
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Webhook handler not found');
    });

    it('should route to correct handler based on plugin and path', async () => {
      let handlerCalled = false;
      let receivedBody: unknown;

      const webhook: WebhookRegistration = {
        path: 'entry-update',
        handler: async (_req, res, context) => {
          handlerCalled = true;
          receivedBody = context.body;
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ received: true }));
        },
      };

      registry.register('contentful', webhook);

      const payload = { type: 'entry.publish', entryId: '123' };
      const response = await makeRequest(
        server,
        '/_webhooks/contentful/entry-update',
        {
          body: JSON.stringify(payload),
        }
      );

      // Webhook is queued with 202 response
      expect(response.statusCode).toBe(202);

      // Flush queue to process the webhook
      await queue.flush();

      expect(handlerCalled).toBe(true);
      expect(receivedBody).toEqual(payload);
    });

    it('should include CORS headers in webhook responses', async () => {
      registry.register('plugin', {
        path: 'test',
        handler: async (_req, res) => {
          res.writeHead(200);
          res.end('OK');
        },
      });

      const response = await makeRequest(server, '/_webhooks/plugin/test', {
        body: '{}',
      });

      // CORS headers are set by server, not webhook handler
      expect(response.headers['access-control-allow-origin']).toBe('*');
      // Webhook returns 202 for queued processing
      expect(response.statusCode).toBe(202);
    });

    it('should return 405 for GET requests to webhook endpoints', async () => {
      registry.register('plugin', {
        path: 'test',
        handler: async (_req, res) => {
          res.writeHead(200);
          res.end('OK');
        },
      });

      const response = await makeRequest(server, '/_webhooks/plugin/test', {
        method: 'GET',
      });

      expect(response.statusCode).toBe(405);
    });
  });

  describe('webhook handler receives correct context', () => {
    it('should provide store and actions in context', async () => {
      let receivedContext: WebhookHandlerContext | undefined;

      registry.register('test-plugin', {
        path: 'sync',
        handler: async (_req, res, context) => {
          receivedContext = context;
          res.writeHead(200);
          res.end('OK');
        },
      });

      await makeRequest(server, '/_webhooks/test-plugin/sync', {
        body: '{}',
      });

      // Flush queue to process webhook
      await queue.flush();

      expect(receivedContext).toBeDefined();
      expect(receivedContext?.store).toBe(store);
      expect(receivedContext?.actions).toBeDefined();
      expect(typeof receivedContext?.actions.createNode).toBe('function');
      expect(typeof receivedContext?.actions.deleteNode).toBe('function');
      expect(typeof receivedContext?.actions.getNode).toBe('function');
    });

    it('should provide rawBody buffer in context', async () => {
      let receivedRawBody: Buffer | undefined;

      registry.register('plugin', {
        path: 'test',
        handler: async (_req, res, context) => {
          receivedRawBody = context.rawBody;
          res.writeHead(200);
          res.end('OK');
        },
      });

      const payload = { test: 'data' };
      await makeRequest(server, '/_webhooks/plugin/test', {
        body: JSON.stringify(payload),
      });

      // Flush queue to process webhook
      await queue.flush();

      expect(receivedRawBody).toBeInstanceOf(Buffer);
      expect(receivedRawBody?.toString()).toBe(JSON.stringify(payload));
    });
  });

  describe('node creation from webhook', () => {
    it('should allow creating nodes via webhook handler', async () => {
      registry.register('cms-plugin', {
        path: 'content-update',
        handler: async (_req, res, context) => {
          const { body, actions } = context;
          const payload = body as { contentId: string; title: string };

          await actions.createNode({
            internal: {
              id: payload.contentId,
              type: 'ContentEntry',
              owner: 'cms-plugin',
            },
            title: payload.title,
          });

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ created: true }));
        },
      });

      const payload = { contentId: 'entry-123', title: 'Test Entry' };
      const response = await makeRequest(
        server,
        '/_webhooks/cms-plugin/content-update',
        {
          body: JSON.stringify(payload),
        }
      );

      // Webhook is queued
      expect(response.statusCode).toBe(202);

      // Flush queue to process webhook
      await queue.flush();

      // Verify node was created in store
      const nodes = store.getAll();
      expect(nodes.length).toBe(1);

      const node = nodes[0];
      expect(node).toBeDefined();
      expect(node!.internal.id).toBe('entry-123');
      expect(node!.internal.type).toBe('ContentEntry');
      expect((node as unknown as { title: string }).title).toBe('Test Entry');
    });

    it('should allow deleting nodes via webhook handler', async () => {
      // First create a node
      store.set({
        internal: {
          id: 'node-to-delete',
          type: 'TestNode',
          contentDigest: 'abc123',
          owner: 'test',
          createdAt: Date.now(),
          modifiedAt: Date.now(),
        },
      });

      registry.register('plugin', {
        path: 'delete',
        handler: async (_req, res, context) => {
          const { body, actions } = context;
          const payload = body as { nodeId: string };

          await actions.deleteNode(payload.nodeId);

          res.writeHead(200);
          res.end('OK');
        },
      });

      await makeRequest(server, '/_webhooks/plugin/delete', {
        body: JSON.stringify({ nodeId: 'node-to-delete' }),
      });

      // Flush queue to process webhook
      await queue.flush();

      // Verify node was deleted
      expect(store.get('node-to-delete')).toBeUndefined();
    });
  });

  describe('signature verification', () => {
    it('should return 401 when signature verification fails', async () => {
      registry.register('secure-plugin', {
        path: 'secure-hook',
        handler: async (_req, res) => {
          res.writeHead(200);
          res.end('OK');
        },
        verifySignature: (_req, _body) => {
          return false; // Always fail
        },
      });

      const response = await makeRequest(
        server,
        '/_webhooks/secure-plugin/secure-hook',
        {
          body: '{}',
        }
      );

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Invalid signature');
    });

    it('should queue webhook when signature is valid', async () => {
      let handlerCalled = false;

      registry.register('secure-plugin', {
        path: 'secure-hook',
        handler: async (_req, res) => {
          handlerCalled = true;
          res.writeHead(200);
          res.end('OK');
        },
        verifySignature: (req, _body) => {
          // Check for expected header
          return req.headers['x-webhook-signature'] === 'valid-signature';
        },
      });

      const response = await makeRequest(
        server,
        '/_webhooks/secure-plugin/secure-hook',
        {
          body: '{}',
          headers: {
            'x-webhook-signature': 'valid-signature',
          },
        }
      );

      // Webhook is queued
      expect(response.statusCode).toBe(202);

      // Flush queue to process webhook
      await queue.flush();

      expect(handlerCalled).toBe(true);
    });
  });

  describe('error handling', () => {
    it('should return 400 for invalid JSON body', async () => {
      registry.register('plugin', {
        path: 'test',
        handler: async (_req, res) => {
          res.writeHead(200);
          res.end('OK');
        },
      });

      const response = await makeRequest(server, '/_webhooks/plugin/test', {
        body: 'not valid json {{{',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Invalid JSON body');
    });

    it('should queue webhook even if handler will throw (error happens during batch processing)', async () => {
      registry.register('plugin', {
        path: 'error',
        handler: async () => {
          throw new Error('Something went wrong');
        },
      });

      const response = await makeRequest(server, '/_webhooks/plugin/error', {
        body: '{}',
      });

      // Webhook is queued with 202 - error happens later during batch processing
      expect(response.statusCode).toBe(202);
      const body = JSON.parse(response.body);
      expect(body.queued).toBe(true);

      // Error is logged during batch processing, not returned to caller
      // This is expected behavior for async batch processing
    });
  });

  describe('multiple plugins', () => {
    it('should route webhooks to correct plugin handlers', async () => {
      const calls: string[] = [];

      registry.register('plugin-a', {
        path: 'update',
        handler: async (_req, res) => {
          calls.push('plugin-a');
          res.writeHead(200);
          res.end('A');
        },
      });

      registry.register('plugin-b', {
        path: 'update',
        handler: async (_req, res) => {
          calls.push('plugin-b');
          res.writeHead(200);
          res.end('B');
        },
      });

      // Call plugin-a
      await makeRequest(server, '/_webhooks/plugin-a/update', { body: '{}' });
      await queue.flush();
      expect(calls).toEqual(['plugin-a']);

      // Call plugin-b
      await makeRequest(server, '/_webhooks/plugin-b/update', { body: '{}' });
      await queue.flush();
      expect(calls).toEqual(['plugin-a', 'plugin-b']);
    });
  });
});
