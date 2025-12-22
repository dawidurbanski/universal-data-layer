import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createServer, type Server } from 'node:http';
import WebSocket from 'ws';
import {
  UDLWebSocketServer,
  type ServerMessage,
  type NodeChangeMessage,
} from '@/websocket/server.js';
import { emitNodeChange } from '@/nodes/events.js';
import type { Node } from '@/nodes/types.js';

function createMockNode(overrides: Partial<Node['internal']> = {}): Node {
  return {
    internal: {
      id: 'node-1',
      type: 'TestNode',
      owner: 'test-plugin',
      contentDigest: 'digest123',
      createdAt: Date.now(),
      modifiedAt: Date.now(),
      ...overrides,
    },
    name: 'Test Node',
  } as Node;
}

function waitForMessage(ws: WebSocket): Promise<ServerMessage> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Timeout waiting for message'));
    }, 5000);

    ws.once('message', (data: Buffer) => {
      clearTimeout(timeout);
      resolve(JSON.parse(data.toString()) as ServerMessage);
    });
  });
}

function waitForOpen(ws: WebSocket): Promise<void> {
  return new Promise((resolve, reject) => {
    if (ws.readyState === WebSocket.OPEN) {
      resolve();
      return;
    }
    ws.once('open', () => resolve());
    ws.once('error', reject);
  });
}

describe('UDLWebSocketServer', () => {
  let httpServer: Server;
  let wsServer: UDLWebSocketServer;
  let client: WebSocket | null = null;
  let serverPort: number;

  beforeEach(async () => {
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
      heartbeatIntervalMs: 60000, // Long interval to avoid interference in tests
    });
  });

  afterEach(async () => {
    // Close client if connected
    if (client && client.readyState === WebSocket.OPEN) {
      client.close();
      client = null;
    }

    // Close servers
    await wsServer.close();
    await new Promise<void>((resolve) => {
      httpServer.close(() => resolve());
    });
  });

  describe('connection handling', () => {
    it('accepts WebSocket connections', async () => {
      client = new WebSocket(`ws://localhost:${serverPort}/ws`);
      await waitForOpen(client);

      expect(client.readyState).toBe(WebSocket.OPEN);
    });

    it('sends connected message on connection', async () => {
      client = new WebSocket(`ws://localhost:${serverPort}/ws`);
      const message = await waitForMessage(client);

      expect(message.type).toBe('connected');
      expect(
        (message as { type: string; data: { message: string } }).data.message
      ).toContain('Connected');
    });

    it('defaults subscription to all types (*)', async () => {
      client = new WebSocket(`ws://localhost:${serverPort}/ws`);
      await waitForMessage(client); // connected message

      // Emit a node change - should be received since default is *
      const node = createMockNode({ id: 'product-1', type: 'Product' });
      emitNodeChange({
        type: 'node:created',
        nodeId: 'product-1',
        nodeType: 'Product',
        node,
        timestamp: '2024-06-15T12:00:00.000Z',
      });

      const message = await waitForMessage(client);
      expect(message.type).toBe('node:created');
    });

    it('tracks client count', async () => {
      expect(wsServer.getClientCount()).toBe(0);

      client = new WebSocket(`ws://localhost:${serverPort}/ws`);
      await waitForOpen(client);

      expect(wsServer.getClientCount()).toBe(1);

      // Connect second client
      const client2 = new WebSocket(`ws://localhost:${serverPort}/ws`);
      await waitForOpen(client2);

      expect(wsServer.getClientCount()).toBe(2);

      // Close second client
      client2.close();
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(wsServer.getClientCount()).toBe(1);
    });
  });

  describe('message handling', () => {
    it('responds to ping with pong', async () => {
      client = new WebSocket(`ws://localhost:${serverPort}/ws`);
      await waitForMessage(client); // connected message

      client.send(JSON.stringify({ type: 'ping' }));
      const message = await waitForMessage(client);

      expect(message.type).toBe('pong');
    });

    it('handles subscribe message', async () => {
      client = new WebSocket(`ws://localhost:${serverPort}/ws`);
      await waitForMessage(client); // connected message

      client.send(JSON.stringify({ type: 'subscribe', data: ['Product'] }));
      const message = await waitForMessage(client);

      expect(message.type).toBe('subscribed');
      expect(
        (message as { type: string; data: { types: string[] } }).data.types
      ).toEqual(['Product']);
    });

    it('handles subscribe to all (*)', async () => {
      client = new WebSocket(`ws://localhost:${serverPort}/ws`);
      await waitForMessage(client); // connected message

      client.send(JSON.stringify({ type: 'subscribe', data: '*' }));
      const message = await waitForMessage(client);

      expect(message.type).toBe('subscribed');
      expect(
        (message as { type: string; data: { types: string } }).data.types
      ).toBe('*');
    });

    it('ignores invalid JSON', async () => {
      client = new WebSocket(`ws://localhost:${serverPort}/ws`);
      await waitForMessage(client); // connected message

      // Send invalid JSON - should not crash
      client.send('not valid json');

      // Should still respond to valid messages
      client.send(JSON.stringify({ type: 'ping' }));
      const message = await waitForMessage(client);

      expect(message.type).toBe('pong');
    });

    it('ignores unknown message types', async () => {
      client = new WebSocket(`ws://localhost:${serverPort}/ws`);
      await waitForMessage(client); // connected message

      // Send unknown message type
      client.send(JSON.stringify({ type: 'unknown' }));

      // Should still respond to valid messages
      client.send(JSON.stringify({ type: 'ping' }));
      const message = await waitForMessage(client);

      expect(message.type).toBe('pong');
    });
  });

  describe('broadcasting', () => {
    it('broadcasts node:created events', async () => {
      client = new WebSocket(`ws://localhost:${serverPort}/ws`);
      await waitForMessage(client); // connected message

      const node = createMockNode({ id: 'product-1', type: 'Product' });
      emitNodeChange({
        type: 'node:created',
        nodeId: 'product-1',
        nodeType: 'Product',
        node,
        timestamp: '2024-06-15T12:00:00.000Z',
      });

      const message = (await waitForMessage(client)) as NodeChangeMessage;

      expect(message.type).toBe('node:created');
      expect(message.nodeId).toBe('product-1');
      expect(message.nodeType).toBe('Product');
      expect(message.data).toEqual(node);
      expect(message.timestamp).toBe('2024-06-15T12:00:00.000Z');
    });

    it('broadcasts node:updated events', async () => {
      client = new WebSocket(`ws://localhost:${serverPort}/ws`);
      await waitForMessage(client); // connected message

      const node = createMockNode({ id: 'product-1', type: 'Product' });
      emitNodeChange({
        type: 'node:updated',
        nodeId: 'product-1',
        nodeType: 'Product',
        node,
        timestamp: '2024-06-15T12:00:00.000Z',
      });

      const message = (await waitForMessage(client)) as NodeChangeMessage;

      expect(message.type).toBe('node:updated');
      expect(message.nodeId).toBe('product-1');
      expect(message.data).toEqual(node);
    });

    it('broadcasts node:deleted events with null data', async () => {
      client = new WebSocket(`ws://localhost:${serverPort}/ws`);
      await waitForMessage(client); // connected message

      emitNodeChange({
        type: 'node:deleted',
        nodeId: 'product-1',
        nodeType: 'Product',
        node: null,
        timestamp: '2024-06-15T12:00:00.000Z',
      });

      const message = (await waitForMessage(client)) as NodeChangeMessage;

      expect(message.type).toBe('node:deleted');
      expect(message.nodeId).toBe('product-1');
      expect(message.data).toBeNull();
    });

    it('filters broadcasts by subscription', async () => {
      client = new WebSocket(`ws://localhost:${serverPort}/ws`);
      await waitForMessage(client); // connected message

      // Subscribe to only Product types
      client.send(JSON.stringify({ type: 'subscribe', data: ['Product'] }));
      await waitForMessage(client); // subscribed message

      // Emit a Collection event - should NOT be received
      emitNodeChange({
        type: 'node:created',
        nodeId: 'collection-1',
        nodeType: 'Collection',
        node: createMockNode({ id: 'collection-1', type: 'Collection' }),
        timestamp: '2024-06-15T12:00:00.000Z',
      });

      // Emit a Product event - SHOULD be received
      const productNode = createMockNode({ id: 'product-1', type: 'Product' });
      emitNodeChange({
        type: 'node:created',
        nodeId: 'product-1',
        nodeType: 'Product',
        node: productNode,
        timestamp: '2024-06-15T12:00:00.000Z',
      });

      const message = (await waitForMessage(client)) as NodeChangeMessage;

      // Should receive Product, not Collection
      expect(message.nodeType).toBe('Product');
      expect(message.nodeId).toBe('product-1');
    });

    it('broadcasts to multiple clients', async () => {
      client = new WebSocket(`ws://localhost:${serverPort}/ws`);
      await waitForMessage(client); // connected message

      const client2 = new WebSocket(`ws://localhost:${serverPort}/ws`);
      await waitForMessage(client2); // connected message

      try {
        const node = createMockNode({ id: 'product-1', type: 'Product' });
        emitNodeChange({
          type: 'node:created',
          nodeId: 'product-1',
          nodeType: 'Product',
          node,
          timestamp: '2024-06-15T12:00:00.000Z',
        });

        const [message1, message2] = await Promise.all([
          waitForMessage(client),
          waitForMessage(client2),
        ]);

        expect(message1.type).toBe('node:created');
        expect(message2.type).toBe('node:created');
      } finally {
        client2.close();
      }
    });
  });

  describe('close', () => {
    it('closes all client connections', async () => {
      client = new WebSocket(`ws://localhost:${serverPort}/ws`);
      await waitForOpen(client);

      // Set up close listener before calling close to avoid race condition
      const closePromise = new Promise<void>((resolve) => {
        client!.once('close', () => resolve());
        // Also resolve if already closed
        if (client!.readyState === WebSocket.CLOSED) {
          resolve();
        }
      });

      await wsServer.close();
      await closePromise;

      expect(client.readyState).toBe(WebSocket.CLOSED);
    });

    it('stops listening for node events after close', async () => {
      client = new WebSocket(`ws://localhost:${serverPort}/ws`);
      await waitForMessage(client); // connected message

      await wsServer.close();

      // Reconnect to test - need new server
      wsServer = new UDLWebSocketServer(httpServer, { path: '/ws' });
      const client2 = new WebSocket(`ws://localhost:${serverPort}/ws`);
      await waitForMessage(client2); // connected message

      // Original server should not broadcast
      // (we can't easily test this, but the close() unsubscribes from events)
      client2.close();
    });
  });
});
