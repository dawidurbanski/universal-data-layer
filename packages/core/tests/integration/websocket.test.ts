import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { createServer, type Server } from 'node:http';
import WebSocket from 'ws';
import {
  UDLWebSocketServer,
  type ServerMessage,
  type NodeChangeMessage,
} from '@/websocket/server.js';
import { NodeStore } from '@/nodes/store.js';
import { createNode } from '@/nodes/actions/createNode.js';
import { deleteNode } from '@/nodes/actions/deleteNode.js';
import { extendNode } from '@/nodes/actions/extendNode.js';

function waitForMessage(
  ws: WebSocket,
  timeoutMs = 5000
): Promise<ServerMessage> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Timeout waiting for message'));
    }, timeoutMs);

    ws.once('message', (data: Buffer) => {
      clearTimeout(timeout);
      resolve(JSON.parse(data.toString()) as ServerMessage);
    });
  });
}

describe('WebSocket integration', () => {
  let httpServer: Server;
  let wsServer: UDLWebSocketServer;
  let store: NodeStore;
  let serverPort: number;
  let client: WebSocket | null = null;

  beforeAll(async () => {
    // Create HTTP server
    httpServer = createServer();
    await new Promise<void>((resolve) => {
      httpServer.listen(0, () => {
        const address = httpServer.address();
        serverPort =
          typeof address === 'object' && address ? address.port : 4000;
        resolve();
      });
    });

    // Create WebSocket server
    wsServer = new UDLWebSocketServer(httpServer, {
      path: '/ws',
      heartbeatIntervalMs: 60000,
    });
  });

  afterAll(async () => {
    await wsServer.close();
    await new Promise<void>((resolve) => {
      httpServer.close(() => resolve());
    });
  });

  beforeEach(() => {
    store = new NodeStore();
    if (client && client.readyState === WebSocket.OPEN) {
      client.close();
      client = null;
    }
  });

  describe('createNode integration', () => {
    it('broadcasts node:created when creating a new node', async () => {
      client = new WebSocket(`ws://localhost:${serverPort}/ws`);
      await waitForMessage(client); // connected message

      // Create a node using the action
      await createNode(
        {
          internal: {
            id: 'product-1',
            type: 'Product',
            owner: 'test-plugin',
          },
          name: 'Test Product',
          price: 99.99,
        },
        { store }
      );

      const message = (await waitForMessage(client)) as NodeChangeMessage;

      expect(message.type).toBe('node:created');
      expect(message.nodeId).toBe('product-1');
      expect(message.nodeType).toBe('Product');
      expect(message.data).toMatchObject({
        internal: {
          id: 'product-1',
          type: 'Product',
        },
        name: 'Test Product',
        price: 99.99,
      });
    });

    it('broadcasts node:updated when updating an existing node', async () => {
      // Create initial node
      await createNode(
        {
          internal: {
            id: 'product-1',
            type: 'Product',
            owner: 'test-plugin',
          },
          name: 'Original Name',
        },
        { store }
      );

      client = new WebSocket(`ws://localhost:${serverPort}/ws`);
      await waitForMessage(client); // connected message

      // Update the node
      await createNode(
        {
          internal: {
            id: 'product-1',
            type: 'Product',
            owner: 'test-plugin',
          },
          name: 'Updated Name',
        },
        { store }
      );

      const message = (await waitForMessage(client)) as NodeChangeMessage;

      expect(message.type).toBe('node:updated');
      expect(message.nodeId).toBe('product-1');
      expect((message.data as { name: string }).name).toBe('Updated Name');
    });
  });

  describe('deleteNode integration', () => {
    it('broadcasts node:deleted when deleting a node', async () => {
      // Create a node first
      await createNode(
        {
          internal: {
            id: 'product-1',
            type: 'Product',
            owner: 'test-plugin',
          },
          name: 'Test Product',
        },
        { store }
      );

      client = new WebSocket(`ws://localhost:${serverPort}/ws`);
      await waitForMessage(client); // connected message

      // Delete the node
      await deleteNode('product-1', { store });

      const message = (await waitForMessage(client)) as NodeChangeMessage;

      expect(message.type).toBe('node:deleted');
      expect(message.nodeId).toBe('product-1');
      expect(message.nodeType).toBe('Product');
      expect(message.data).toBeNull();
    });
  });

  describe('extendNode integration', () => {
    it('broadcasts node:updated when extending a node', async () => {
      // Create a node first
      await createNode(
        {
          internal: {
            id: 'product-1',
            type: 'Product',
            owner: 'test-plugin',
          },
          name: 'Test Product',
        },
        { store }
      );

      client = new WebSocket(`ws://localhost:${serverPort}/ws`);
      await waitForMessage(client); // connected message
      // We also receive node:created from createNode above before we connected,
      // but since we connected after, we won't receive it.
      // Actually, since the createNode happened before websocket connection,
      // the event was emitted but no client was connected yet.

      // Extend the node
      await extendNode(
        'product-1',
        { featured: true, discount: 10 },
        { store }
      );

      const message = (await waitForMessage(client)) as NodeChangeMessage;

      expect(message.type).toBe('node:updated');
      expect(message.nodeId).toBe('product-1');
      expect(message.data).toMatchObject({
        name: 'Test Product',
        featured: true,
        discount: 10,
      });
    });
  });

  describe('subscription filtering integration', () => {
    it('only receives events for subscribed types', async () => {
      client = new WebSocket(`ws://localhost:${serverPort}/ws`);
      await waitForMessage(client); // connected message

      // Subscribe to only Product types
      client.send(JSON.stringify({ type: 'subscribe', data: ['Product'] }));
      await waitForMessage(client); // subscribed message

      // Create a Collection - should NOT trigger event for this client
      await createNode(
        {
          internal: {
            id: 'collection-1',
            type: 'Collection',
            owner: 'test-plugin',
          },
          name: 'Test Collection',
        },
        { store }
      );

      // Create a Product - SHOULD trigger event
      await createNode(
        {
          internal: {
            id: 'product-1',
            type: 'Product',
            owner: 'test-plugin',
          },
          name: 'Test Product',
        },
        { store }
      );

      const message = (await waitForMessage(client)) as NodeChangeMessage;

      // Should receive Product, not Collection
      expect(message.type).toBe('node:created');
      expect(message.nodeType).toBe('Product');
      expect(message.nodeId).toBe('product-1');
    });

    it('receives all events when subscribed to *', async () => {
      client = new WebSocket(`ws://localhost:${serverPort}/ws`);
      await waitForMessage(client); // connected message

      // Default is *, but let's be explicit
      client.send(JSON.stringify({ type: 'subscribe', data: '*' }));
      await waitForMessage(client); // subscribed message

      // Collect received messages
      const receivedMessages: NodeChangeMessage[] = [];
      const messagePromise = new Promise<void>((resolve) => {
        const handler = (data: Buffer) => {
          const msg = JSON.parse(data.toString()) as ServerMessage;
          if (msg.type === 'node:created') {
            receivedMessages.push(msg as NodeChangeMessage);
            if (receivedMessages.length === 2) {
              client!.off('message', handler);
              resolve();
            }
          }
        };
        client!.on('message', handler);
      });

      // Create different node types
      await createNode(
        {
          internal: {
            id: 'product-1',
            type: 'Product',
            owner: 'test-plugin',
          },
          name: 'Test Product',
        },
        { store }
      );

      await createNode(
        {
          internal: {
            id: 'collection-1',
            type: 'Collection',
            owner: 'test-plugin',
          },
          name: 'Test Collection',
        },
        { store }
      );

      await messagePromise;

      const types = receivedMessages.map((m) => m.nodeType).sort();
      expect(types).toEqual(['Collection', 'Product']);
    });
  });

  describe('multiple clients integration', () => {
    it('broadcasts to multiple clients with different subscriptions', async () => {
      // Client 1: Subscribe to Product
      const client1 = new WebSocket(`ws://localhost:${serverPort}/ws`);
      await waitForMessage(client1); // connected
      client1.send(JSON.stringify({ type: 'subscribe', data: ['Product'] }));
      await waitForMessage(client1); // subscribed

      // Client 2: Subscribe to Collection
      const client2 = new WebSocket(`ws://localhost:${serverPort}/ws`);
      await waitForMessage(client2); // connected
      client2.send(JSON.stringify({ type: 'subscribe', data: ['Collection'] }));
      await waitForMessage(client2); // subscribed

      try {
        // Set up message collectors BEFORE creating nodes to avoid race conditions
        const client1Messages: NodeChangeMessage[] = [];
        const client2Messages: NodeChangeMessage[] = [];

        const client1Promise = new Promise<void>((resolve) => {
          const handler = (data: Buffer) => {
            const msg = JSON.parse(data.toString()) as ServerMessage;
            if (
              msg.type === 'node:created' &&
              (msg as NodeChangeMessage).nodeType === 'Product'
            ) {
              client1Messages.push(msg as NodeChangeMessage);
              client1.off('message', handler);
              resolve();
            }
          };
          client1.on('message', handler);
        });

        const client2Promise = new Promise<void>((resolve) => {
          const handler = (data: Buffer) => {
            const msg = JSON.parse(data.toString()) as ServerMessage;
            if (
              msg.type === 'node:created' &&
              (msg as NodeChangeMessage).nodeType === 'Collection'
            ) {
              client2Messages.push(msg as NodeChangeMessage);
              client2.off('message', handler);
              resolve();
            }
          };
          client2.on('message', handler);
        });

        // Create a Product
        await createNode(
          {
            internal: {
              id: 'product-1',
              type: 'Product',
              owner: 'test-plugin',
            },
            name: 'Test Product',
          },
          { store }
        );

        // Create a Collection
        await createNode(
          {
            internal: {
              id: 'collection-1',
              type: 'Collection',
              owner: 'test-plugin',
            },
            name: 'Test Collection',
          },
          { store }
        );

        // Wait for both clients to receive their messages
        await Promise.all([client1Promise, client2Promise]);

        // Client 1 should only receive Product
        expect(client1Messages).toHaveLength(1);
        expect(client1Messages[0].nodeType).toBe('Product');

        // Client 2 should only receive Collection
        expect(client2Messages).toHaveLength(1);
        expect(client2Messages[0].nodeType).toBe('Collection');
      } finally {
        client1.close();
        client2.close();
      }
    });
  });
});
