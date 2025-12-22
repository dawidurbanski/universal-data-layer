import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  nodeEvents,
  emitNodeChange,
  type NodeChangeEvent,
} from '@/nodes/events.js';
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

describe('nodeEvents', () => {
  let listeners: Array<(event: NodeChangeEvent) => void> = [];

  afterEach(() => {
    // Clean up all listeners
    for (const listener of listeners) {
      nodeEvents.off('node:created', listener);
      nodeEvents.off('node:updated', listener);
      nodeEvents.off('node:deleted', listener);
    }
    listeners = [];
  });

  describe('emitNodeChange', () => {
    it('emits node:created events', () => {
      const handler = vi.fn();
      listeners.push(handler);
      nodeEvents.on('node:created', handler);

      const node = createMockNode({ id: 'product-1', type: 'Product' });
      const event: NodeChangeEvent = {
        type: 'node:created',
        nodeId: 'product-1',
        nodeType: 'Product',
        node,
        timestamp: '2024-06-15T12:00:00.000Z',
      };

      emitNodeChange(event);

      expect(handler).toHaveBeenCalledOnce();
      expect(handler).toHaveBeenCalledWith(event);
    });

    it('emits node:updated events', () => {
      const handler = vi.fn();
      listeners.push(handler);
      nodeEvents.on('node:updated', handler);

      const node = createMockNode({ id: 'product-1', type: 'Product' });
      const event: NodeChangeEvent = {
        type: 'node:updated',
        nodeId: 'product-1',
        nodeType: 'Product',
        node,
        timestamp: '2024-06-15T12:00:00.000Z',
      };

      emitNodeChange(event);

      expect(handler).toHaveBeenCalledOnce();
      expect(handler).toHaveBeenCalledWith(event);
    });

    it('emits node:deleted events with null node', () => {
      const handler = vi.fn();
      listeners.push(handler);
      nodeEvents.on('node:deleted', handler);

      const event: NodeChangeEvent = {
        type: 'node:deleted',
        nodeId: 'product-1',
        nodeType: 'Product',
        node: null,
        timestamp: '2024-06-15T12:00:00.000Z',
      };

      emitNodeChange(event);

      expect(handler).toHaveBeenCalledOnce();
      expect(handler).toHaveBeenCalledWith(event);
    });

    it('only emits to listeners of the specific event type', () => {
      const createdHandler = vi.fn();
      const updatedHandler = vi.fn();
      const deletedHandler = vi.fn();

      listeners.push(createdHandler, updatedHandler, deletedHandler);
      nodeEvents.on('node:created', createdHandler);
      nodeEvents.on('node:updated', updatedHandler);
      nodeEvents.on('node:deleted', deletedHandler);

      const node = createMockNode();
      emitNodeChange({
        type: 'node:updated',
        nodeId: 'node-1',
        nodeType: 'TestNode',
        node,
        timestamp: '2024-06-15T12:00:00.000Z',
      });

      expect(createdHandler).not.toHaveBeenCalled();
      expect(updatedHandler).toHaveBeenCalledOnce();
      expect(deletedHandler).not.toHaveBeenCalled();
    });

    it('supports multiple listeners for the same event', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      listeners.push(handler1, handler2);
      nodeEvents.on('node:created', handler1);
      nodeEvents.on('node:created', handler2);

      const node = createMockNode();
      emitNodeChange({
        type: 'node:created',
        nodeId: 'node-1',
        nodeType: 'TestNode',
        node,
        timestamp: '2024-06-15T12:00:00.000Z',
      });

      expect(handler1).toHaveBeenCalledOnce();
      expect(handler2).toHaveBeenCalledOnce();
    });
  });

  describe('nodeEvents.off', () => {
    it('removes a listener', () => {
      const handler = vi.fn();
      listeners.push(handler);
      nodeEvents.on('node:created', handler);

      // Remove the listener
      nodeEvents.off('node:created', handler);

      emitNodeChange({
        type: 'node:created',
        nodeId: 'node-1',
        nodeType: 'TestNode',
        node: createMockNode(),
        timestamp: '2024-06-15T12:00:00.000Z',
      });

      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('nodeEvents.once', () => {
    it('listener is called only once', () => {
      const handler = vi.fn();
      nodeEvents.once('node:created', handler);

      const node = createMockNode();
      emitNodeChange({
        type: 'node:created',
        nodeId: 'node-1',
        nodeType: 'TestNode',
        node,
        timestamp: '2024-06-15T12:00:00.000Z',
      });

      emitNodeChange({
        type: 'node:created',
        nodeId: 'node-2',
        nodeType: 'TestNode',
        node,
        timestamp: '2024-06-15T12:00:00.000Z',
      });

      expect(handler).toHaveBeenCalledOnce();
    });
  });

  describe('event payload', () => {
    it('includes all required fields', () => {
      const handler = vi.fn();
      listeners.push(handler);
      nodeEvents.on('node:created', handler);

      const node = createMockNode({ id: 'test-123', type: 'Product' });
      const timestamp = '2024-06-15T12:00:00.000Z';

      emitNodeChange({
        type: 'node:created',
        nodeId: 'test-123',
        nodeType: 'Product',
        node,
        timestamp,
      });

      const receivedEvent = handler.mock.calls[0][0] as NodeChangeEvent;
      expect(receivedEvent.type).toBe('node:created');
      expect(receivedEvent.nodeId).toBe('test-123');
      expect(receivedEvent.nodeType).toBe('Product');
      expect(receivedEvent.node).toBe(node);
      expect(receivedEvent.timestamp).toBe(timestamp);
    });
  });
});
