import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  createDefaultWebhookHandler,
  DEFAULT_WEBHOOK_PATH,
} from '@/webhooks/default-handler.js';
import { NodeStore } from '@/nodes/store.js';
import { createNodeActions } from '@/nodes/actions/index.js';
import type { WebhookHandlerContext } from '@/webhooks/types.js';
import type { ServerResponse } from 'node:http';
import type { Node } from '@/nodes/types.js';

describe('DEFAULT_WEBHOOK_PATH', () => {
  it('should be "sync"', () => {
    expect(DEFAULT_WEBHOOK_PATH).toBe('sync');
  });
});

describe('createDefaultWebhookHandler', () => {
  let store: NodeStore;
  let handler: ReturnType<typeof createDefaultWebhookHandler>;

  function createMockContext(body: unknown): WebhookHandlerContext {
    const actions = createNodeActions({ store, owner: 'test-plugin' });
    return {
      store,
      actions,
      rawBody: Buffer.from(JSON.stringify(body)),
      body,
    };
  }

  function createMockResponse(): ServerResponse & {
    getStatusCode: () => number;
    getBody: () => string;
    getHeaders: () => Record<string, string>;
  } {
    let statusCode = 200;
    let responseBody = '';
    const headers: Record<string, string> = {};

    return {
      writeHead(code: number, headersArg?: Record<string, string>) {
        statusCode = code;
        if (headersArg) {
          Object.assign(headers, headersArg);
        }
        return this;
      },
      end(body?: string) {
        responseBody = body || '';
      },
      getStatusCode: () => statusCode,
      getBody: () => responseBody,
      getHeaders: () => headers,
    } as unknown as ServerResponse & {
      getStatusCode: () => number;
      getBody: () => string;
      getHeaders: () => Record<string, string>;
    };
  }

  beforeEach(() => {
    store = new NodeStore();
    handler = createDefaultWebhookHandler('test-plugin');
  });

  describe('upsert operation', () => {
    it('should create a new node', async () => {
      const context = createMockContext({
        operation: 'upsert',
        nodeId: 'product-1',
        nodeType: 'Product',
        data: { title: 'Test Product', price: 99 },
      });
      const res = createMockResponse();

      await handler(null as never, res, context);

      expect(res.getStatusCode()).toBe(200);
      expect(JSON.parse(res.getBody())).toMatchObject({
        upserted: true,
        nodeId: 'product-1',
      });

      const node = store.get('product-1');
      expect(node).toBeDefined();
      expect(node!.internal.type).toBe('Product');
      expect(node!.internal.owner).toBe('test-plugin');
      expect((node as unknown as Record<string, unknown>)['title']).toBe(
        'Test Product'
      );
      expect((node as unknown as Record<string, unknown>)['price']).toBe(99);
    });

    it('should update an existing node', async () => {
      // First create
      await handler(
        null as never,
        createMockResponse(),
        createMockContext({
          operation: 'upsert',
          nodeId: 'product-1',
          nodeType: 'Product',
          data: { title: 'Original' },
        })
      );

      // Then update
      const res = createMockResponse();
      await handler(
        null as never,
        res,
        createMockContext({
          operation: 'upsert',
          nodeId: 'product-1',
          nodeType: 'Product',
          data: { title: 'Updated' },
        })
      );

      expect(res.getStatusCode()).toBe(200);
      const node = store.get('product-1');
      expect((node as unknown as Record<string, unknown>)['title']).toBe(
        'Updated'
      );
    });
  });

  describe('create operation', () => {
    it('should create a new node', async () => {
      const res = createMockResponse();
      await handler(
        null as never,
        res,
        createMockContext({
          operation: 'create',
          nodeId: 'article-1',
          nodeType: 'Article',
          data: { title: 'New Article' },
        })
      );

      expect(res.getStatusCode()).toBe(201);
      expect(JSON.parse(res.getBody())).toMatchObject({
        created: true,
        nodeId: 'article-1',
      });
      expect(store.get('article-1')).toBeDefined();
    });

    it('should return 409 if node already exists', async () => {
      // Create first
      await handler(
        null as never,
        createMockResponse(),
        createMockContext({
          operation: 'create',
          nodeId: 'article-1',
          nodeType: 'Article',
          data: { title: 'First' },
        })
      );

      // Try to create again
      const res = createMockResponse();
      await handler(
        null as never,
        res,
        createMockContext({
          operation: 'create',
          nodeId: 'article-1',
          nodeType: 'Article',
          data: { title: 'Second' },
        })
      );

      expect(res.getStatusCode()).toBe(409);
      expect(JSON.parse(res.getBody())).toEqual({
        error: 'Node already exists',
        nodeId: 'article-1',
      });
    });
  });

  describe('update operation', () => {
    it('should update an existing node', async () => {
      // First create
      await handler(
        null as never,
        createMockResponse(),
        createMockContext({
          operation: 'upsert',
          nodeId: 'item-1',
          nodeType: 'Item',
          data: { name: 'Original' },
        })
      );

      // Then update
      const res = createMockResponse();
      await handler(
        null as never,
        res,
        createMockContext({
          operation: 'update',
          nodeId: 'item-1',
          nodeType: 'Item',
          data: { name: 'Updated' },
        })
      );

      expect(res.getStatusCode()).toBe(200);
      expect(JSON.parse(res.getBody())).toMatchObject({
        updated: true,
        nodeId: 'item-1',
      });
      const node = store.get('item-1');
      expect((node as unknown as Record<string, unknown>)['name']).toBe(
        'Updated'
      );
    });

    it('should return 404 if node does not exist', async () => {
      const res = createMockResponse();
      await handler(
        null as never,
        res,
        createMockContext({
          operation: 'update',
          nodeId: 'nonexistent',
          nodeType: 'Item',
          data: { name: 'Test' },
        })
      );

      expect(res.getStatusCode()).toBe(404);
      expect(JSON.parse(res.getBody())).toMatchObject({
        error: 'Node not found',
        nodeId: 'nonexistent',
      });
    });
  });

  describe('delete operation', () => {
    it('should delete an existing node', async () => {
      // First create
      await handler(
        null as never,
        createMockResponse(),
        createMockContext({
          operation: 'upsert',
          nodeId: 'delete-me',
          nodeType: 'Test',
          data: { foo: 'bar' },
        })
      );

      expect(store.get('delete-me')).toBeDefined();

      // Then delete
      const res = createMockResponse();
      await handler(
        null as never,
        res,
        createMockContext({
          operation: 'delete',
          nodeId: 'delete-me',
          nodeType: 'Test',
        })
      );

      expect(res.getStatusCode()).toBe(200);
      expect(JSON.parse(res.getBody())).toMatchObject({
        deleted: true,
        nodeId: 'delete-me',
      });
      expect(store.get('delete-me')).toBeUndefined();
    });

    it('should return 404 if node does not exist', async () => {
      const res = createMockResponse();
      await handler(
        null as never,
        res,
        createMockContext({
          operation: 'delete',
          nodeId: 'nonexistent',
          nodeType: 'Test',
        })
      );

      expect(res.getStatusCode()).toBe(404);
      expect(JSON.parse(res.getBody())).toMatchObject({
        error: 'Node not found',
        nodeId: 'nonexistent',
      });
    });
  });

  describe('payload validation', () => {
    it('should reject null body', async () => {
      const res = createMockResponse();
      await handler(null as never, res, {
        ...createMockContext({}),
        body: null,
      });

      expect(res.getStatusCode()).toBe(400);
      expect(JSON.parse(res.getBody()).error).toBe('Invalid payload');
    });

    it('should reject invalid operation', async () => {
      const res = createMockResponse();
      await handler(
        null as never,
        res,
        createMockContext({
          operation: 'invalid',
          nodeId: 'test',
          nodeType: 'Test',
        })
      );

      expect(res.getStatusCode()).toBe(400);
    });

    it('should reject missing nodeId', async () => {
      const res = createMockResponse();
      await handler(
        null as never,
        res,
        createMockContext({
          operation: 'upsert',
          nodeType: 'Test',
          data: {},
        })
      );

      expect(res.getStatusCode()).toBe(400);
    });

    it('should reject empty nodeId', async () => {
      const res = createMockResponse();
      await handler(
        null as never,
        res,
        createMockContext({
          operation: 'upsert',
          nodeId: '',
          nodeType: 'Test',
          data: {},
        })
      );

      expect(res.getStatusCode()).toBe(400);
    });

    it('should reject missing nodeType', async () => {
      const res = createMockResponse();
      await handler(
        null as never,
        res,
        createMockContext({
          operation: 'upsert',
          nodeId: 'test',
          data: {},
        })
      );

      expect(res.getStatusCode()).toBe(400);
    });

    it('should reject missing data for create', async () => {
      const res = createMockResponse();
      await handler(
        null as never,
        res,
        createMockContext({
          operation: 'create',
          nodeId: 'test',
          nodeType: 'Test',
        })
      );

      expect(res.getStatusCode()).toBe(400);
    });

    it('should reject missing data for upsert', async () => {
      const res = createMockResponse();
      await handler(
        null as never,
        res,
        createMockContext({
          operation: 'upsert',
          nodeId: 'test',
          nodeType: 'Test',
        })
      );

      expect(res.getStatusCode()).toBe(400);
    });

    it('should allow missing data for delete', async () => {
      // First create a node
      await handler(
        null as never,
        createMockResponse(),
        createMockContext({
          operation: 'upsert',
          nodeId: 'to-delete',
          nodeType: 'Test',
          data: {},
        })
      );

      // Then delete without data
      const res = createMockResponse();
      await handler(
        null as never,
        res,
        createMockContext({
          operation: 'delete',
          nodeId: 'to-delete',
          nodeType: 'Test',
        })
      );

      expect(res.getStatusCode()).toBe(200);
    });
  });

  describe('error handling', () => {
    it('should handle internal errors gracefully', async () => {
      const context = createMockContext({
        operation: 'upsert',
        nodeId: 'test',
        nodeType: 'Test',
        data: { foo: 'bar' },
      });

      // Mock createNode to throw
      context.actions.createNode = vi
        .fn()
        .mockRejectedValue(new Error('DB error'));

      const res = createMockResponse();
      await handler(null as never, res, context);

      expect(res.getStatusCode()).toBe(500);
      expect(JSON.parse(res.getBody())).toEqual({
        error: 'Internal server error',
        message: 'DB error',
      });
    });
  });

  describe('pluginName as owner', () => {
    it('should use pluginName as node owner', async () => {
      const customHandler = createDefaultWebhookHandler('my-custom-plugin');

      const customStore = new NodeStore();
      const actions = createNodeActions({
        store: customStore,
        owner: 'my-custom-plugin',
      });

      await customHandler(null as never, createMockResponse(), {
        store: customStore,
        actions,
        rawBody: Buffer.from('{}'),
        body: {
          operation: 'upsert',
          nodeId: 'node-1',
          nodeType: 'Test',
          data: {},
        },
      });

      const node = customStore.get('node-1');
      expect(node!.internal.owner).toBe('my-custom-plugin');
    });
  });

  describe('idField option', () => {
    it('should find nodes by custom field for update', async () => {
      const customStore = new NodeStore();
      const actions = createNodeActions({
        store: customStore,
        owner: 'test-plugin',
      });

      // Register index for idField
      customStore.registerIndex('Todo', 'externalId');

      // Pre-create a node with an internal ID different from external ID
      // Note: externalId stored as string since webhook sends strings
      customStore.set({
        internal: {
          id: 'Todo-123', // Internal ID
          type: 'Todo',
          owner: 'test-plugin',
          contentDigest: 'abc',
          createdAt: Date.now(),
          modifiedAt: Date.now(),
        },
        externalId: '123', // Stored as string to match webhook lookup
        title: 'Original Title',
      } as Node);

      // Create handler with idField
      const lookupHandler = createDefaultWebhookHandler('test-plugin', {
        idField: 'externalId',
      });

      const res = createMockResponse();
      await lookupHandler(null as never, res, {
        store: customStore,
        actions,
        rawBody: Buffer.from('{}'),
        body: {
          operation: 'update',
          nodeId: '123', // Using external ID (string)
          nodeType: 'Todo',
          data: { externalId: '123', title: 'Updated Title' },
        },
      });

      expect(res.getStatusCode()).toBe(200);
      expect(JSON.parse(res.getBody())).toMatchObject({
        updated: true,
        nodeId: '123',
        internalId: 'Todo-123',
      });

      // Check that the node was updated
      const node = customStore.get('Todo-123');
      expect((node as unknown as Record<string, unknown>)['title']).toBe(
        'Updated Title'
      );
    });

    it('should find nodes by custom field for delete', async () => {
      const customStore = new NodeStore();
      const actions = createNodeActions({
        store: customStore,
        owner: 'test-plugin',
      });

      // Register index for idField
      customStore.registerIndex('Todo', 'externalId');

      // Pre-create a node (externalId as string to match webhook lookup)
      customStore.set({
        internal: {
          id: 'Todo-456',
          type: 'Todo',
          owner: 'test-plugin',
          contentDigest: 'xyz',
          createdAt: Date.now(),
          modifiedAt: Date.now(),
        },
        externalId: '456',
        title: 'To Delete',
      } as Node);

      const lookupHandler = createDefaultWebhookHandler('test-plugin', {
        idField: 'externalId',
      });

      const res = createMockResponse();
      await lookupHandler(null as never, res, {
        store: customStore,
        actions,
        rawBody: Buffer.from('{}'),
        body: {
          operation: 'delete',
          nodeId: '456', // Using external ID (string)
          nodeType: 'Todo',
        },
      });

      expect(res.getStatusCode()).toBe(200);
      expect(JSON.parse(res.getBody())).toMatchObject({
        deleted: true,
        nodeId: '456',
        internalId: 'Todo-456',
      });

      // Verify node was deleted
      expect(customStore.get('Todo-456')).toBeUndefined();
    });

    it('should create nodes with generated internal ID when using idField', async () => {
      const customStore = new NodeStore();
      const actions = createNodeActions({
        store: customStore,
        owner: 'test-plugin',
      });

      // Register index for idField
      customStore.registerIndex('Product', 'externalId');

      const lookupHandler = createDefaultWebhookHandler('test-plugin', {
        idField: 'externalId',
      });

      const res = createMockResponse();
      await lookupHandler(null as never, res, {
        store: customStore,
        actions,
        rawBody: Buffer.from('{}'),
        body: {
          operation: 'create',
          nodeId: '789', // External ID (string)
          nodeType: 'Product',
          data: { externalId: '789', name: 'New Product' },
        },
      });

      expect(res.getStatusCode()).toBe(201);
      const responseBody = JSON.parse(res.getBody());
      expect(responseBody).toMatchObject({
        created: true,
        nodeId: '789',
      });

      // Internal ID is generated using createNodeId (SHA-256 hash)
      expect(responseBody.internalId).toBeDefined();
      expect(typeof responseBody.internalId).toBe('string');

      // Node should exist with the generated internal ID
      const node = customStore.get(responseBody.internalId);
      expect(node).toBeDefined();
      expect((node as unknown as Record<string, unknown>)['name']).toBe(
        'New Product'
      );
    });

    it('should find nodes when externalId is numeric but nodeId is string', async () => {
      const customStore = new NodeStore();
      const actions = createNodeActions({
        store: customStore,
        owner: 'test-plugin',
      });

      // Register index for idField
      customStore.registerIndex('Todo', 'externalId');

      // Pre-create a node with NUMERIC externalId (common in databases)
      customStore.set({
        internal: {
          id: 'Todo-internal-123',
          type: 'Todo',
          owner: 'test-plugin',
          contentDigest: 'abc',
          createdAt: Date.now(),
          modifiedAt: Date.now(),
        },
        externalId: 42, // Stored as NUMBER
        title: 'Original Title',
      } as Node);

      const lookupHandler = createDefaultWebhookHandler('test-plugin', {
        idField: 'externalId',
      });

      const res = createMockResponse();
      await lookupHandler(null as never, res, {
        store: customStore,
        actions,
        rawBody: Buffer.from('{}'),
        body: {
          operation: 'update',
          nodeId: '42', // Sent as STRING (JSON always sends strings)
          nodeType: 'Todo',
          data: { externalId: 42, title: 'Updated Title' },
        },
      });

      expect(res.getStatusCode()).toBe(200);
      expect(JSON.parse(res.getBody())).toMatchObject({
        updated: true,
        nodeId: '42',
        internalId: 'Todo-internal-123',
      });

      // Check that the node was updated
      const node = customStore.get('Todo-internal-123');
      expect((node as unknown as Record<string, unknown>)['title']).toBe(
        'Updated Title'
      );
    });

    it('should upsert existing nodes found by idField', async () => {
      const customStore = new NodeStore();
      const actions = createNodeActions({
        store: customStore,
        owner: 'test-plugin',
      });

      // Register index
      customStore.registerIndex('Item', 'itemCode');

      // Pre-create a node
      customStore.set({
        internal: {
          id: 'Item-ABC',
          type: 'Item',
          owner: 'test-plugin',
          contentDigest: 'orig',
          createdAt: Date.now(),
          modifiedAt: Date.now(),
        },
        itemCode: 'ABC',
        value: 100,
      } as Node);

      const lookupHandler = createDefaultWebhookHandler('test-plugin', {
        idField: 'itemCode',
      });

      const res = createMockResponse();
      await lookupHandler(null as never, res, {
        store: customStore,
        actions,
        rawBody: Buffer.from('{}'),
        body: {
          operation: 'upsert',
          nodeId: 'ABC', // Using itemCode
          nodeType: 'Item',
          data: { itemCode: 'ABC', value: 200 },
        },
      });

      expect(res.getStatusCode()).toBe(200);
      expect(JSON.parse(res.getBody())).toMatchObject({
        upserted: true,
        nodeId: 'ABC',
        internalId: 'Item-ABC',
        wasUpdate: true,
      });

      // Check that the existing node was updated
      const node = customStore.get('Item-ABC');
      expect((node as unknown as Record<string, unknown>)['value']).toBe(200);
    });

    it('should fallback to linear scan for nodes not in index with string nodeId', async () => {
      const customStore = new NodeStore();
      const actions = createNodeActions({
        store: customStore,
        owner: 'test-plugin',
      });

      // Pre-create a node
      customStore.set({
        internal: {
          id: 'Legacy-123',
          type: 'Legacy',
          owner: 'test-plugin',
          contentDigest: 'legacy',
          createdAt: Date.now(),
          modifiedAt: Date.now(),
        },
        legacyId: 'legacy-abc', // String value
        title: 'Legacy Node',
      } as Node);
      customStore.registerIndex('Legacy', 'legacyId');

      // Mock getByField to simulate index miss (forces linear scan)
      const originalGetByField = customStore.getByField.bind(customStore);
      customStore.getByField = vi.fn().mockReturnValue(undefined);

      const lookupHandler = createDefaultWebhookHandler('test-plugin', {
        idField: 'legacyId',
      });

      const res = createMockResponse();
      await lookupHandler(null as never, res, {
        store: customStore,
        actions,
        rawBody: Buffer.from('{}'),
        body: {
          operation: 'update',
          nodeId: 'legacy-abc', // String lookup
          nodeType: 'Legacy',
          data: { legacyId: 'legacy-abc', title: 'Updated Legacy' },
        },
      });

      expect(res.getStatusCode()).toBe(200);
      expect(JSON.parse(res.getBody())).toMatchObject({
        updated: true,
        nodeId: 'legacy-abc',
        internalId: 'Legacy-123',
      });

      // Restore original
      customStore.getByField = originalGetByField;
    });

    it('should fallback to linear scan for nodes not in index with numeric nodeId', async () => {
      const customStore = new NodeStore();
      const actions = createNodeActions({
        store: customStore,
        owner: 'test-plugin',
      });

      // Pre-create a node with numeric field value
      customStore.set({
        internal: {
          id: 'Numeric-999',
          type: 'Numeric',
          owner: 'test-plugin',
          contentDigest: 'num',
          createdAt: Date.now(),
          modifiedAt: Date.now(),
        },
        numId: 999, // Numeric value
        title: 'Numeric Node',
      } as Node);
      customStore.registerIndex('Numeric', 'numId');

      // Mock getByField to simulate index miss (forces linear scan for numeric comparison)
      customStore.getByField = vi.fn().mockReturnValue(undefined);

      const lookupHandler = createDefaultWebhookHandler('test-plugin', {
        idField: 'numId',
      });

      const res = createMockResponse();
      await lookupHandler(null as never, res, {
        store: customStore,
        actions,
        rawBody: Buffer.from('{}'),
        body: {
          operation: 'update',
          nodeId: '999', // String from JSON that looks numeric
          nodeType: 'Numeric',
          data: { numId: 999, title: 'Updated Numeric' },
        },
      });

      expect(res.getStatusCode()).toBe(200);
      expect(JSON.parse(res.getBody())).toMatchObject({
        updated: true,
        nodeId: '999',
        internalId: 'Numeric-999',
      });
    });
  });

  describe('delete failure handling', () => {
    it('should return 500 if deleteNode fails unexpectedly', async () => {
      const customStore = new NodeStore();
      const actions = createNodeActions({
        store: customStore,
        owner: 'test-plugin',
      });

      // Pre-create a node
      customStore.set({
        internal: {
          id: 'fail-delete',
          type: 'Test',
          owner: 'test-plugin',
          contentDigest: 'abc',
          createdAt: Date.now(),
          modifiedAt: Date.now(),
        },
        title: 'Will fail delete',
      } as Node);

      // Mock deleteNode to return false (simulating a rare failure)
      actions.deleteNode = vi.fn().mockResolvedValue(false);

      const testHandler = createDefaultWebhookHandler('test-plugin');

      const res = createMockResponse();
      await testHandler(null as never, res, {
        store: customStore,
        actions,
        rawBody: Buffer.from('{}'),
        body: {
          operation: 'delete',
          nodeId: 'fail-delete',
          nodeType: 'Test',
        },
      });

      expect(res.getStatusCode()).toBe(500);
      expect(JSON.parse(res.getBody())).toMatchObject({
        error: 'Delete failed',
        nodeId: 'fail-delete',
        internalId: 'fail-delete',
      });
    });
  });

  describe('error handling', () => {
    it('should handle non-Error throws gracefully', async () => {
      const context = createMockContext({
        operation: 'upsert',
        nodeId: 'test',
        nodeType: 'Test',
        data: { foo: 'bar' },
      });

      // Mock createNode to throw a non-Error value
      context.actions.createNode = vi.fn().mockRejectedValue('string error');

      const res = createMockResponse();
      await handler(null as never, res, context);

      expect(res.getStatusCode()).toBe(500);
      expect(JSON.parse(res.getBody())).toEqual({
        error: 'Internal server error',
        message: 'Unknown error',
      });
    });
  });
});
