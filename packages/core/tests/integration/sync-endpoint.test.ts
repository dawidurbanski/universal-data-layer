import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import http, { createServer, type Server } from 'node:http';
import { syncHandler } from '@/handlers/sync.js';
import { setDefaultStore, NodeStore } from '@/nodes/index.js';
import { setDefaultDeletionLog, DeletionLog } from '@/sync/index.js';
import type { Node } from '@/nodes/types.js';

function makeRequest(
  server: Server,
  path: string,
  method: string = 'GET'
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

    const req = http.request(
      {
        hostname: 'localhost',
        port: address.port,
        path,
        method,
      },
      (res: {
        statusCode: number;
        headers: Record<string, string>;
        on: (event: string, callback: (data?: Buffer) => void) => void;
      }) => {
        let body = '';
        res.on('data', (chunk: Buffer) => {
          body += chunk.toString();
        });
        res.on('end', () => {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers as Record<string, string>,
            body,
          });
        });
      }
    );
    req.on('error', reject);
    req.end();
  });
}

function createTestNode(overrides: {
  id: string;
  type: string;
  modifiedAt: number;
}): Node {
  return {
    internal: {
      id: overrides.id,
      type: overrides.type,
      contentDigest: 'digest-' + overrides.id,
      owner: 'test-plugin',
      createdAt: overrides.modifiedAt,
      modifiedAt: overrides.modifiedAt,
    },
    name: 'Test ' + overrides.id,
  } as Node;
}

describe('sync endpoint integration', () => {
  let server: Server;
  let store: NodeStore;
  let deletionLog: DeletionLog;

  beforeAll(() => {
    server = createServer((req, res) => {
      // Add CORS headers
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

      if (req.url?.startsWith('/_sync')) {
        return syncHandler(req, res);
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

  beforeEach(() => {
    store = new NodeStore();
    setDefaultStore(store);

    deletionLog = new DeletionLog();
    setDefaultDeletionLog(deletionLog);
  });

  describe('/_sync endpoint', () => {
    it('should return 200 with JSON response', async () => {
      const response = await makeRequest(
        server,
        '/_sync?since=2024-01-01T00:00:00Z'
      );

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toBe('application/json');

      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('updated');
      expect(body).toHaveProperty('deleted');
      expect(body).toHaveProperty('serverTime');
      expect(body).toHaveProperty('hasMore');
    });

    it('should include CORS headers', async () => {
      const response = await makeRequest(
        server,
        '/_sync?since=2024-01-01T00:00:00Z'
      );

      expect(response.headers['access-control-allow-origin']).toBe('*');
      expect(response.headers['access-control-allow-methods']).toBe(
        'GET, POST, OPTIONS'
      );
    });

    it('should return updated nodes after timestamp', async () => {
      // Add a node modified after 2024-01-01
      store.set(
        createTestNode({
          id: 'product-1',
          type: 'Product',
          modifiedAt: new Date('2024-06-01T00:00:00Z').getTime(),
        })
      );

      const response = await makeRequest(
        server,
        '/_sync?since=2024-01-01T00:00:00Z'
      );

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.updated).toHaveLength(1);
      expect(body.updated[0].internal.id).toBe('product-1');
    });

    it('should return deleted nodes after timestamp', async () => {
      // Record a deletion
      deletionLog.recordDeletion({
        internal: {
          id: 'deleted-product-1',
          type: 'Product',
          owner: 'test-plugin',
        },
      });

      const response = await makeRequest(
        server,
        '/_sync?since=2024-01-01T00:00:00Z'
      );

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.deleted).toHaveLength(1);
      expect(body.deleted[0].nodeId).toBe('deleted-product-1');
      expect(body.deleted[0].nodeType).toBe('Product');
    });

    it('should filter by types parameter', async () => {
      store.set(
        createTestNode({
          id: 'product-1',
          type: 'Product',
          modifiedAt: new Date('2024-06-01T00:00:00Z').getTime(),
        })
      );
      store.set(
        createTestNode({
          id: 'collection-1',
          type: 'Collection',
          modifiedAt: new Date('2024-06-01T00:00:00Z').getTime(),
        })
      );

      const response = await makeRequest(
        server,
        '/_sync?since=2024-01-01T00:00:00Z&types=Product'
      );

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.updated).toHaveLength(1);
      expect(body.updated[0].internal.type).toBe('Product');
    });

    it('should return 400 when since parameter is missing', async () => {
      const response = await makeRequest(server, '/_sync');

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Missing required parameter: since');
    });

    it('should return 400 for invalid date format', async () => {
      const response = await makeRequest(server, '/_sync?since=invalid');

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Invalid date format for since parameter');
    });

    it('should return 405 for POST request', async () => {
      const response = await makeRequest(
        server,
        '/_sync?since=2024-01-01T00:00:00Z',
        'POST'
      );

      expect(response.statusCode).toBe(405);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Method not allowed');
    });

    it('should return valid ISO 8601 serverTime', async () => {
      const response = await makeRequest(
        server,
        '/_sync?since=2024-01-01T00:00:00Z'
      );

      const body = JSON.parse(response.body);
      const timestamp = new Date(body.serverTime);
      expect(timestamp.toISOString()).toBe(body.serverTime);
    });

    it('should use serverTime for subsequent sync calls', async () => {
      // First sync
      const response1 = await makeRequest(
        server,
        '/_sync?since=2024-01-01T00:00:00Z'
      );
      const body1 = JSON.parse(response1.body);
      const serverTime = body1.serverTime;

      // Add a new node after first sync (add 1ms to ensure it's after serverTime)
      const serverTimeMs = new Date(serverTime).getTime();
      store.set(
        createTestNode({
          id: 'new-product',
          type: 'Product',
          modifiedAt: serverTimeMs + 1,
        })
      );

      // Second sync using serverTime from first response
      const response2 = await makeRequest(
        server,
        `/_sync?since=${encodeURIComponent(serverTime)}`
      );
      const body2 = JSON.parse(response2.body);

      expect(body2.updated).toHaveLength(1);
      expect(body2.updated[0].internal.id).toBe('new-product');
    });
  });
});
