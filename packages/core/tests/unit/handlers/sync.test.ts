import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { syncHandler } from '@/handlers/sync.js';
import { setDefaultStore, NodeStore } from '@/nodes/index.js';
import { setDefaultDeletionLog, DeletionLog } from '@/sync/index.js';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Node } from '@/nodes/types.js';

function createMockRequest(
  method: string = 'GET',
  url: string = '/_sync?since=2024-01-01T00:00:00Z'
): IncomingMessage {
  return {
    method,
    url,
    headers: {
      host: 'localhost:4000',
    },
  } as IncomingMessage;
}

function createMockResponse(): ServerResponse & {
  _statusCode: number;
  _headers: Record<string, string>;
  _body: string;
} {
  const res = {
    _statusCode: 0,
    _headers: {} as Record<string, string>,
    _body: '',
    writeHead(statusCode: number, headers?: Record<string, string>) {
      this._statusCode = statusCode;
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
  };
}

function createTestNode(
  overrides: Partial<Node> & { internal: Partial<Node['internal']> }
): Node {
  const now = Date.now();
  return {
    internal: {
      id: 'test-id',
      type: 'TestType',
      contentDigest: 'digest123',
      owner: 'test-plugin',
      createdAt: now,
      modifiedAt: now,
      ...overrides.internal,
    },
    ...overrides,
  } as Node;
}

describe('syncHandler', () => {
  let store: NodeStore;
  let deletionLog: DeletionLog;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-06-15T12:00:00.000Z'));

    store = new NodeStore();
    setDefaultStore(store);

    deletionLog = new DeletionLog();
    setDefaultDeletionLog(deletionLog);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('valid sync request', () => {
    it('should return 200 with correct response format', () => {
      const req = createMockRequest('GET', '/_sync?since=2024-01-01T00:00:00Z');
      const res = createMockResponse();

      syncHandler(req, res);

      expect(res._statusCode).toBe(200);
      expect(res._headers['Content-Type']).toBe('application/json');

      const body = JSON.parse(res._body);
      expect(body).toHaveProperty('updated');
      expect(body).toHaveProperty('deleted');
      expect(body).toHaveProperty('serverTime');
      expect(body).toHaveProperty('hasMore');
      expect(Array.isArray(body.updated)).toBe(true);
      expect(Array.isArray(body.deleted)).toBe(true);
      expect(body.hasMore).toBe(false);
    });

    it('should return updated nodes after timestamp', () => {
      // Node modified after the since timestamp
      const node = createTestNode({
        internal: {
          id: 'node-1',
          type: 'Product',
          modifiedAt: new Date('2024-06-01T00:00:00Z').getTime(),
        },
      });
      store.set(node);

      const req = createMockRequest('GET', '/_sync?since=2024-01-01T00:00:00Z');
      const res = createMockResponse();

      syncHandler(req, res);

      const body = JSON.parse(res._body);
      expect(body.updated).toHaveLength(1);
      expect(body.updated[0].internal.id).toBe('node-1');
    });

    it('should not return nodes before timestamp', () => {
      // Node modified before the since timestamp
      const node = createTestNode({
        internal: {
          id: 'node-1',
          type: 'Product',
          modifiedAt: new Date('2023-06-01T00:00:00Z').getTime(),
        },
      });
      store.set(node);

      const req = createMockRequest('GET', '/_sync?since=2024-01-01T00:00:00Z');
      const res = createMockResponse();

      syncHandler(req, res);

      const body = JSON.parse(res._body);
      expect(body.updated).toHaveLength(0);
    });

    it('should return deleted nodes after timestamp', () => {
      const mockNode = {
        internal: {
          id: 'deleted-node-1',
          type: 'Product',
          owner: 'test-plugin',
        },
      };
      deletionLog.recordDeletion(mockNode);

      const req = createMockRequest('GET', '/_sync?since=2024-01-01T00:00:00Z');
      const res = createMockResponse();

      syncHandler(req, res);

      const body = JSON.parse(res._body);
      expect(body.deleted).toHaveLength(1);
      expect(body.deleted[0].nodeId).toBe('deleted-node-1');
      expect(body.deleted[0].nodeType).toBe('Product');
      expect(body.deleted[0].deletedAt).toBeDefined();
    });

    it('should include serverTime in response', () => {
      const req = createMockRequest('GET', '/_sync?since=2024-01-01T00:00:00Z');
      const res = createMockResponse();

      syncHandler(req, res);

      const body = JSON.parse(res._body);
      expect(body.serverTime).toBe('2024-06-15T12:00:00.000Z');
    });

    it('should return valid ISO 8601 serverTime', () => {
      const req = createMockRequest('GET', '/_sync?since=2024-01-01T00:00:00Z');
      const res = createMockResponse();

      syncHandler(req, res);

      const body = JSON.parse(res._body);
      const timestamp = new Date(body.serverTime);
      expect(timestamp.toISOString()).toBe(body.serverTime);
    });
  });

  describe('parameter validation', () => {
    it('should return 400 when since parameter is missing', () => {
      const req = createMockRequest('GET', '/_sync');
      const res = createMockResponse();

      syncHandler(req, res);

      expect(res._statusCode).toBe(400);
      const body = JSON.parse(res._body);
      expect(body.error).toBe('Missing required parameter: since');
    });

    it('should return 400 for invalid date format', () => {
      const req = createMockRequest('GET', '/_sync?since=invalid-date');
      const res = createMockResponse();

      syncHandler(req, res);

      expect(res._statusCode).toBe(400);
      const body = JSON.parse(res._body);
      expect(body.error).toBe('Invalid date format for since parameter');
    });

    it('should return 400 for empty since value', () => {
      const req = createMockRequest('GET', '/_sync?since=');
      const res = createMockResponse();

      syncHandler(req, res);

      expect(res._statusCode).toBe(400);
      const body = JSON.parse(res._body);
      expect(body.error).toBe('Missing required parameter: since');
    });
  });

  describe('type filtering', () => {
    beforeEach(() => {
      // Add nodes of different types
      store.set(
        createTestNode({
          internal: {
            id: 'product-1',
            type: 'Product',
            modifiedAt: new Date('2024-06-01T00:00:00Z').getTime(),
          },
        })
      );
      store.set(
        createTestNode({
          internal: {
            id: 'collection-1',
            type: 'Collection',
            modifiedAt: new Date('2024-06-01T00:00:00Z').getTime(),
          },
        })
      );
      store.set(
        createTestNode({
          internal: {
            id: 'category-1',
            type: 'Category',
            modifiedAt: new Date('2024-06-01T00:00:00Z').getTime(),
          },
        })
      );

      // Add deletions of different types
      deletionLog.recordDeletion({
        internal: { id: 'deleted-product', type: 'Product', owner: 'test' },
      });
      deletionLog.recordDeletion({
        internal: {
          id: 'deleted-collection',
          type: 'Collection',
          owner: 'test',
        },
      });
    });

    it('should filter updated nodes by single type', () => {
      const req = createMockRequest(
        'GET',
        '/_sync?since=2024-01-01T00:00:00Z&types=Product'
      );
      const res = createMockResponse();

      syncHandler(req, res);

      const body = JSON.parse(res._body);
      expect(body.updated).toHaveLength(1);
      expect(body.updated[0].internal.type).toBe('Product');
    });

    it('should filter updated nodes by multiple types', () => {
      const req = createMockRequest(
        'GET',
        '/_sync?since=2024-01-01T00:00:00Z&types=Product,Collection'
      );
      const res = createMockResponse();

      syncHandler(req, res);

      const body = JSON.parse(res._body);
      expect(body.updated).toHaveLength(2);
      const types = body.updated.map((n: Node) => n.internal.type);
      expect(types).toContain('Product');
      expect(types).toContain('Collection');
    });

    it('should filter deleted nodes by type', () => {
      const req = createMockRequest(
        'GET',
        '/_sync?since=2024-01-01T00:00:00Z&types=Product'
      );
      const res = createMockResponse();

      syncHandler(req, res);

      const body = JSON.parse(res._body);
      expect(body.deleted).toHaveLength(1);
      expect(body.deleted[0].nodeType).toBe('Product');
    });

    it('should handle types with spaces after comma', () => {
      const req = createMockRequest(
        'GET',
        '/_sync?since=2024-01-01T00:00:00Z&types=Product, Collection'
      );
      const res = createMockResponse();

      syncHandler(req, res);

      const body = JSON.parse(res._body);
      expect(body.updated).toHaveLength(2);
    });
  });

  describe('method validation', () => {
    it('should return 405 for POST request', () => {
      const req = createMockRequest(
        'POST',
        '/_sync?since=2024-01-01T00:00:00Z'
      );
      const res = createMockResponse();

      syncHandler(req, res);

      expect(res._statusCode).toBe(405);
      const body = JSON.parse(res._body);
      expect(body.error).toBe('Method not allowed');
    });

    it('should return 405 for PUT request', () => {
      const req = createMockRequest('PUT', '/_sync?since=2024-01-01T00:00:00Z');
      const res = createMockResponse();

      syncHandler(req, res);

      expect(res._statusCode).toBe(405);
    });

    it('should return 405 for DELETE request', () => {
      const req = createMockRequest(
        'DELETE',
        '/_sync?since=2024-01-01T00:00:00Z'
      );
      const res = createMockResponse();

      syncHandler(req, res);

      expect(res._statusCode).toBe(405);
    });
  });

  describe('edge cases', () => {
    it('should return empty arrays when store is empty', () => {
      const req = createMockRequest('GET', '/_sync?since=2024-01-01T00:00:00Z');
      const res = createMockResponse();

      syncHandler(req, res);

      const body = JSON.parse(res._body);
      expect(body.updated).toHaveLength(0);
      expect(body.deleted).toHaveLength(0);
    });

    it('should return empty deleted array when deletion log is empty', () => {
      store.set(
        createTestNode({
          internal: {
            id: 'node-1',
            type: 'Product',
            modifiedAt: new Date('2024-06-01T00:00:00Z').getTime(),
          },
        })
      );

      const req = createMockRequest('GET', '/_sync?since=2024-01-01T00:00:00Z');
      const res = createMockResponse();

      syncHandler(req, res);

      const body = JSON.parse(res._body);
      expect(body.updated).toHaveLength(1);
      expect(body.deleted).toHaveLength(0);
    });

    it('should exclude nodes at exactly the since timestamp', () => {
      const exactTimestamp = new Date('2024-01-01T00:00:00Z').getTime();
      store.set(
        createTestNode({
          internal: {
            id: 'node-1',
            type: 'Product',
            modifiedAt: exactTimestamp,
          },
        })
      );

      const req = createMockRequest('GET', '/_sync?since=2024-01-01T00:00:00Z');
      const res = createMockResponse();

      syncHandler(req, res);

      const body = JSON.parse(res._body);
      expect(body.updated).toHaveLength(0);
    });

    it('should include nodes 1ms after the since timestamp', () => {
      const justAfterTimestamp = new Date('2024-01-01T00:00:00.001Z').getTime();
      store.set(
        createTestNode({
          internal: {
            id: 'node-1',
            type: 'Product',
            modifiedAt: justAfterTimestamp,
          },
        })
      );

      const req = createMockRequest('GET', '/_sync?since=2024-01-01T00:00:00Z');
      const res = createMockResponse();

      syncHandler(req, res);

      const body = JSON.parse(res._body);
      expect(body.updated).toHaveLength(1);
    });

    it('should handle nodes without modifiedAt', () => {
      const nodeWithoutModifiedAt = {
        internal: {
          id: 'node-1',
          type: 'Product',
          contentDigest: 'digest',
          owner: 'test',
          createdAt: Date.now(),
          modifiedAt: undefined,
        },
      } as unknown as Node;
      store.set(nodeWithoutModifiedAt);

      const req = createMockRequest('GET', '/_sync?since=2024-01-01T00:00:00Z');
      const res = createMockResponse();

      syncHandler(req, res);

      const body = JSON.parse(res._body);
      expect(body.updated).toHaveLength(0);
    });

    it('should return empty updated when no nodes match timestamp filter', () => {
      // All nodes before since timestamp
      store.set(
        createTestNode({
          internal: {
            id: 'node-1',
            type: 'Product',
            modifiedAt: new Date('2023-01-01T00:00:00Z').getTime(),
          },
        })
      );
      store.set(
        createTestNode({
          internal: {
            id: 'node-2',
            type: 'Collection',
            modifiedAt: new Date('2023-06-01T00:00:00Z').getTime(),
          },
        })
      );

      const req = createMockRequest('GET', '/_sync?since=2024-01-01T00:00:00Z');
      const res = createMockResponse();

      syncHandler(req, res);

      const body = JSON.parse(res._body);
      expect(body.updated).toHaveLength(0);
    });

    it('should handle type filter with non-existent types', () => {
      store.set(
        createTestNode({
          internal: {
            id: 'node-1',
            type: 'Product',
            modifiedAt: new Date('2024-06-01T00:00:00Z').getTime(),
          },
        })
      );

      const req = createMockRequest(
        'GET',
        '/_sync?since=2024-01-01T00:00:00Z&types=NonExistent'
      );
      const res = createMockResponse();

      syncHandler(req, res);

      const body = JSON.parse(res._body);
      expect(body.updated).toHaveLength(0);
      expect(body.deleted).toHaveLength(0);
    });
  });
});
