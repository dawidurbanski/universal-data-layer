import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import WebSocket from 'ws';
import { UDLWebSocketClient } from '@/websocket/client.js';
import type { NodeStore } from '@/nodes/store.js';

// WebSocket ready state constants
const WS_OPEN = 1;
const WS_CLOSED = 3;

// Mock the ws module
vi.mock('ws', () => {
  const MockWebSocket = vi.fn() as ReturnType<typeof vi.fn> & {
    OPEN: number;
    CLOSED: number;
  };
  MockWebSocket.OPEN = 1;
  MockWebSocket.CLOSED = 3;
  return {
    default: MockWebSocket,
  };
});

// Helper to create a mock WebSocket instance
function createMockWs() {
  const handlers: Record<string, ((...args: unknown[]) => void)[]> = {};
  return {
    on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
      if (!handlers[event]) handlers[event] = [];
      handlers[event].push(handler);
    }),
    send: vi.fn(),
    close: vi.fn(),
    readyState: WS_OPEN as number,
    emit: (event: string, ...args: unknown[]) => {
      handlers[event]?.forEach((h) => h(...args));
    },
    handlers,
  };
}

// Helper to create a mock store
function createMockStore(): NodeStore {
  return {
    set: vi.fn(),
    get: vi.fn(),
    delete: vi.fn(),
    getByType: vi.fn(),
    getAll: vi.fn(),
    clear: vi.fn(),
    size: 0,
    types: vi.fn().mockReturnValue([]),
    onChange: vi.fn(),
  } as unknown as NodeStore;
}

describe('UDLWebSocketClient', () => {
  let mockWs: ReturnType<typeof createMockWs>;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.useFakeTimers();
    mockWs = createMockWs();
    (WebSocket as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      () => mockWs
    );
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('constructor', () => {
    it('should set default config values', () => {
      const client = new UDLWebSocketClient({ url: 'ws://localhost:4000/ws' });
      // Access private config for testing - we verify behavior through other tests
      expect(client).toBeDefined();
    });

    it('should accept custom config values', () => {
      const client = new UDLWebSocketClient({
        url: 'ws://localhost:4000/ws',
        reconnectDelayMs: 1000,
        maxReconnectAttempts: 3,
        pingIntervalMs: 10000,
      });
      expect(client).toBeDefined();
    });
  });

  describe('connect', () => {
    it('should create a WebSocket connection and resolve on open', async () => {
      const client = new UDLWebSocketClient({ url: 'ws://localhost:4000/ws' });
      const store = createMockStore();

      const connectPromise = client.connect(store);

      // Trigger open event
      mockWs.emit('open');

      await connectPromise;

      expect(WebSocket).toHaveBeenCalledWith('ws://localhost:4000/ws');
      expect(mockWs.send).toHaveBeenCalledWith(
        JSON.stringify({ type: 'subscribe', data: '*' })
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        '🔌 Connected to remote UDL: ws://localhost:4000/ws'
      );
    });

    it('should reject on initial connection error', async () => {
      const client = new UDLWebSocketClient({ url: 'ws://localhost:4000/ws' });
      const store = createMockStore();

      const connectPromise = client.connect(store);

      // Trigger error event
      const error = new Error('Connection refused');
      mockWs.emit('error', error);

      await expect(connectPromise).rejects.toThrow('Connection refused');
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '🔌 WebSocket error:',
        'Connection refused'
      );
    });

    it('should reject when WebSocket constructor throws', async () => {
      (WebSocket as unknown as ReturnType<typeof vi.fn>).mockImplementation(
        () => {
          throw new Error('WebSocket not supported');
        }
      );

      const client = new UDLWebSocketClient({ url: 'ws://localhost:4000/ws' });
      const store = createMockStore();

      await expect(client.connect(store)).rejects.toThrow(
        'WebSocket not supported'
      );
    });
  });

  describe('message handling', () => {
    it('should handle connected message', async () => {
      const client = new UDLWebSocketClient({ url: 'ws://localhost:4000/ws' });
      const store = createMockStore();

      const connectPromise = client.connect(store);
      mockWs.emit('open');
      await connectPromise;

      const message = {
        type: 'connected',
        data: { message: 'Welcome to UDL' },
      };
      mockWs.emit('message', Buffer.from(JSON.stringify(message)));

      expect(consoleLogSpy).toHaveBeenCalledWith(
        '🔌 Remote UDL:',
        'Welcome to UDL'
      );
    });

    it('should handle subscribed message', async () => {
      const client = new UDLWebSocketClient({ url: 'ws://localhost:4000/ws' });
      const store = createMockStore();

      const connectPromise = client.connect(store);
      mockWs.emit('open');
      await connectPromise;

      const message = {
        type: 'subscribed',
        data: { types: ['Product', 'Category'] },
      };
      mockWs.emit('message', Buffer.from(JSON.stringify(message)));

      expect(consoleLogSpy).toHaveBeenCalledWith(
        '🔌 Subscribed to node types:',
        ['Product', 'Category']
      );
    });

    it('should handle pong message silently', async () => {
      const client = new UDLWebSocketClient({ url: 'ws://localhost:4000/ws' });
      const store = createMockStore();

      const connectPromise = client.connect(store);
      mockWs.emit('open');
      await connectPromise;

      consoleLogSpy.mockClear();

      const message = { type: 'pong' };
      mockWs.emit('message', Buffer.from(JSON.stringify(message)));

      // pong should not log anything
      expect(consoleLogSpy).not.toHaveBeenCalled();
    });

    it('should handle node:created message', async () => {
      const client = new UDLWebSocketClient({ url: 'ws://localhost:4000/ws' });
      const store = createMockStore();

      const connectPromise = client.connect(store);
      mockWs.emit('open');
      await connectPromise;

      const message = {
        type: 'node:created',
        nodeId: 'prod-1',
        nodeType: 'Product',
        data: { id: 'prod-1', name: 'Test Product' },
      };
      mockWs.emit('message', Buffer.from(JSON.stringify(message)));

      expect(store.set).toHaveBeenCalledWith({
        id: 'prod-1',
        name: 'Test Product',
        internal: { id: 'prod-1', type: 'Product' },
      });
      expect(consoleLogSpy).toHaveBeenCalledWith(
        '🔄 Remote node:created: Product:prod-1'
      );
    });

    it('should handle node:updated message', async () => {
      const client = new UDLWebSocketClient({ url: 'ws://localhost:4000/ws' });
      const store = createMockStore();

      const connectPromise = client.connect(store);
      mockWs.emit('open');
      await connectPromise;

      const message = {
        type: 'node:updated',
        nodeId: 'prod-1',
        nodeType: 'Product',
        data: { id: 'prod-1', name: 'Updated Product' },
      };
      mockWs.emit('message', Buffer.from(JSON.stringify(message)));

      expect(store.set).toHaveBeenCalledWith({
        id: 'prod-1',
        name: 'Updated Product',
        internal: { id: 'prod-1', type: 'Product' },
      });
      expect(consoleLogSpy).toHaveBeenCalledWith(
        '🔄 Remote node:updated: Product:prod-1'
      );
    });

    it('should preserve existing internal field on node update', async () => {
      const client = new UDLWebSocketClient({ url: 'ws://localhost:4000/ws' });
      const store = createMockStore();

      const connectPromise = client.connect(store);
      mockWs.emit('open');
      await connectPromise;

      const message = {
        type: 'node:created',
        nodeId: 'prod-1',
        nodeType: 'Product',
        data: {
          id: 'prod-1',
          name: 'Test Product',
          internal: { id: 'prod-1', type: 'Product', extra: 'data' },
        },
      };
      mockWs.emit('message', Buffer.from(JSON.stringify(message)));

      expect(store.set).toHaveBeenCalledWith({
        id: 'prod-1',
        name: 'Test Product',
        internal: { id: 'prod-1', type: 'Product', extra: 'data' },
      });
    });

    it('should handle node:deleted message', async () => {
      const client = new UDLWebSocketClient({ url: 'ws://localhost:4000/ws' });
      const store = createMockStore();

      const connectPromise = client.connect(store);
      mockWs.emit('open');
      await connectPromise;

      const message = {
        type: 'node:deleted',
        nodeId: 'prod-1',
        nodeType: 'Product',
      };
      mockWs.emit('message', Buffer.from(JSON.stringify(message)));

      expect(store.delete).toHaveBeenCalledWith('prod-1');
      expect(consoleLogSpy).toHaveBeenCalledWith(
        '🔄 Remote node:deleted: Product:prod-1'
      );
    });

    it('should ignore invalid JSON messages', async () => {
      const client = new UDLWebSocketClient({ url: 'ws://localhost:4000/ws' });
      const store = createMockStore();

      const connectPromise = client.connect(store);
      mockWs.emit('open');
      await connectPromise;

      consoleLogSpy.mockClear();

      // Send invalid JSON
      mockWs.emit('message', Buffer.from('not valid json'));

      // Should not throw and should not call store methods
      expect(store.set).not.toHaveBeenCalled();
      expect(store.delete).not.toHaveBeenCalled();
    });

    it('should not update store when data is missing on node:created', async () => {
      const client = new UDLWebSocketClient({ url: 'ws://localhost:4000/ws' });
      const store = createMockStore();

      const connectPromise = client.connect(store);
      mockWs.emit('open');
      await connectPromise;

      const message = {
        type: 'node:created',
        nodeId: 'prod-1',
        nodeType: 'Product',
        // data is missing
      };
      mockWs.emit('message', Buffer.from(JSON.stringify(message)));

      expect(store.set).not.toHaveBeenCalled();
    });
  });

  describe('connection close and reconnect', () => {
    it('should attempt reconnect on connection close', async () => {
      const client = new UDLWebSocketClient({
        url: 'ws://localhost:4000/ws',
        reconnectDelayMs: 1000,
      });
      const store = createMockStore();

      const connectPromise = client.connect(store);
      mockWs.emit('open');
      await connectPromise;

      // Simulate connection close
      mockWs.emit('close');

      expect(consoleLogSpy).toHaveBeenCalledWith(
        '🔌 Connection closed, attempting reconnect...'
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        '🔌 Reconnecting in 1000ms (attempt 1)'
      );

      // Fast-forward time to trigger reconnect
      vi.advanceTimersByTime(1000);

      // Should create a new WebSocket
      expect(WebSocket).toHaveBeenCalledTimes(2);
    });

    it('should not reconnect if client is closing', async () => {
      const client = new UDLWebSocketClient({
        url: 'ws://localhost:4000/ws',
        reconnectDelayMs: 1000,
      });
      const store = createMockStore();

      const connectPromise = client.connect(store);
      mockWs.emit('open');
      await connectPromise;

      // Close the client
      client.close();

      // Reset mock to track new calls
      (WebSocket as unknown as ReturnType<typeof vi.fn>).mockClear();

      // Simulate connection close (should not reconnect)
      mockWs.emit('close');

      vi.advanceTimersByTime(5000);

      // Should not create a new WebSocket
      expect(WebSocket).not.toHaveBeenCalled();
    });

    it('should stop reconnecting after max attempts', async () => {
      const client = new UDLWebSocketClient({
        url: 'ws://localhost:4000/ws',
        reconnectDelayMs: 100,
        maxReconnectAttempts: 2,
      });
      const store = createMockStore();

      const connectPromise = client.connect(store);
      mockWs.emit('open');
      await connectPromise;

      // First close
      mockWs.emit('close');
      expect(consoleLogSpy).toHaveBeenCalledWith(
        '🔌 Reconnecting in 100ms (attempt 1)'
      );

      // Create new mock for reconnect
      const mockWs2 = createMockWs();
      (WebSocket as unknown as ReturnType<typeof vi.fn>).mockImplementation(
        () => mockWs2
      );

      vi.advanceTimersByTime(100);

      // Second close
      mockWs2.emit('close');
      expect(consoleLogSpy).toHaveBeenCalledWith(
        '🔌 Reconnecting in 100ms (attempt 2)'
      );

      // Create new mock for second reconnect
      const mockWs3 = createMockWs();
      (WebSocket as unknown as ReturnType<typeof vi.fn>).mockImplementation(
        () => mockWs3
      );

      vi.advanceTimersByTime(100);

      // Third close - should hit max attempts
      mockWs3.emit('close');
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '🔌 Max reconnect attempts reached, giving up'
      );
    });

    it('should not call onError on subsequent connection errors', async () => {
      const client = new UDLWebSocketClient({
        url: 'ws://localhost:4000/ws',
        reconnectDelayMs: 100,
        maxReconnectAttempts: 5,
      });
      const store = createMockStore();

      const connectPromise = client.connect(store);
      mockWs.emit('open');
      await connectPromise;

      // Simulate connection close to trigger reconnect
      mockWs.emit('close');

      // Create new mock for reconnect
      const mockWs2 = createMockWs();
      (WebSocket as unknown as ReturnType<typeof vi.fn>).mockImplementation(
        () => mockWs2
      );

      vi.advanceTimersByTime(100);

      // Error on reconnect attempt - should not reject (reconnectAttempts > 0)
      const error = new Error('Reconnect failed');
      mockWs2.emit('error', error);

      // Should log but not throw
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '🔌 WebSocket error:',
        'Reconnect failed'
      );
    });
  });

  describe('ping interval', () => {
    it('should send ping at configured interval', async () => {
      const client = new UDLWebSocketClient({
        url: 'ws://localhost:4000/ws',
        pingIntervalMs: 1000,
      });
      const store = createMockStore();

      const connectPromise = client.connect(store);
      mockWs.emit('open');
      await connectPromise;

      // Clear previous send calls (subscribe)
      mockWs.send.mockClear();

      // Advance time to trigger ping
      vi.advanceTimersByTime(1000);

      expect(mockWs.send).toHaveBeenCalledWith(
        JSON.stringify({ type: 'ping' })
      );

      // Another ping
      vi.advanceTimersByTime(1000);
      expect(mockWs.send).toHaveBeenCalledTimes(2);
    });

    it('should stop ping interval on close', async () => {
      const client = new UDLWebSocketClient({
        url: 'ws://localhost:4000/ws',
        pingIntervalMs: 1000,
      });
      const store = createMockStore();

      const connectPromise = client.connect(store);
      mockWs.emit('open');
      await connectPromise;

      mockWs.send.mockClear();

      // Close the client
      client.close();

      // Advance time - should not send ping
      vi.advanceTimersByTime(2000);

      expect(mockWs.send).not.toHaveBeenCalled();
    });
  });

  describe('send', () => {
    it('should not send when WebSocket is not open', async () => {
      const client = new UDLWebSocketClient({ url: 'ws://localhost:4000/ws' });
      const store = createMockStore();

      const connectPromise = client.connect(store);
      mockWs.emit('open');
      await connectPromise;

      // Set WebSocket to closed state
      mockWs.readyState = WS_CLOSED;
      mockWs.send.mockClear();

      // Try to trigger a send via ping
      vi.advanceTimersByTime(30000);

      expect(mockWs.send).not.toHaveBeenCalled();
    });
  });

  describe('close', () => {
    it('should close WebSocket and clear all timers', async () => {
      const client = new UDLWebSocketClient({
        url: 'ws://localhost:4000/ws',
        reconnectDelayMs: 1000,
      });
      const store = createMockStore();

      const connectPromise = client.connect(store);
      mockWs.emit('open');
      await connectPromise;

      client.close();

      expect(mockWs.close).toHaveBeenCalled();
      expect(consoleLogSpy).toHaveBeenCalledWith('🔌 WebSocket client closed');
    });

    it('should clear reconnect timeout if pending', async () => {
      const client = new UDLWebSocketClient({
        url: 'ws://localhost:4000/ws',
        reconnectDelayMs: 5000,
      });
      const store = createMockStore();

      const connectPromise = client.connect(store);
      mockWs.emit('open');
      await connectPromise;

      // Trigger close to schedule reconnect
      mockWs.emit('close');

      // Reset mock before calling client.close()
      (WebSocket as unknown as ReturnType<typeof vi.fn>).mockClear();

      // Close client before reconnect timer fires
      client.close();

      // Advance past reconnect delay
      vi.advanceTimersByTime(10000);

      // Should not have created a new WebSocket
      expect(WebSocket).not.toHaveBeenCalled();
    });

    it('should handle close when ws is null', () => {
      const client = new UDLWebSocketClient({ url: 'ws://localhost:4000/ws' });

      // Close without ever connecting
      client.close();

      expect(consoleLogSpy).toHaveBeenCalledWith('🔌 WebSocket client closed');
    });
  });

  describe('isConnected', () => {
    it('should return true when WebSocket is open', async () => {
      const client = new UDLWebSocketClient({ url: 'ws://localhost:4000/ws' });
      const store = createMockStore();

      const connectPromise = client.connect(store);
      mockWs.emit('open');
      await connectPromise;

      expect(client.isConnected()).toBe(true);
    });

    it('should return false when WebSocket is closed', async () => {
      const client = new UDLWebSocketClient({ url: 'ws://localhost:4000/ws' });
      const store = createMockStore();

      const connectPromise = client.connect(store);
      mockWs.emit('open');
      await connectPromise;

      mockWs.readyState = WS_CLOSED;

      expect(client.isConnected()).toBe(false);
    });

    it('should return false when not connected', () => {
      const client = new UDLWebSocketClient({ url: 'ws://localhost:4000/ws' });

      expect(client.isConnected()).toBe(false);
    });
  });

  describe('scheduleReconnect when isClosing', () => {
    it('should not schedule reconnect when isClosing is true (direct call)', async () => {
      const client = new UDLWebSocketClient({
        url: 'ws://localhost:4000/ws',
        reconnectDelayMs: 100,
      });
      const store = createMockStore();

      const connectPromise = client.connect(store);
      mockWs.emit('open');
      await connectPromise;

      // Set isClosing to true directly to test the early return in scheduleReconnect
      (client as unknown as { isClosing: boolean }).isClosing = true;

      // Reset mocks
      (WebSocket as unknown as ReturnType<typeof vi.fn>).mockClear();
      consoleLogSpy.mockClear();

      // Call scheduleReconnect directly
      (
        client as unknown as { scheduleReconnect: () => void }
      ).scheduleReconnect();

      // Should not log reconnect attempt
      expect(consoleLogSpy).not.toHaveBeenCalledWith(
        expect.stringContaining('Reconnecting')
      );

      // Advance timers - should not reconnect
      vi.advanceTimersByTime(5000);

      expect(WebSocket).not.toHaveBeenCalled();
    });
  });

  describe('handleNodeDelete when store is null', () => {
    it('should not delete when store is null', async () => {
      const client = new UDLWebSocketClient({ url: 'ws://localhost:4000/ws' });
      const store = createMockStore();

      const connectPromise = client.connect(store);
      mockWs.emit('open');
      await connectPromise;

      // Set store to null via private access to test the early return branch
      (client as unknown as { store: NodeStore | null }).store = null;

      const message = {
        type: 'node:deleted',
        nodeId: 'prod-1',
        nodeType: 'Product',
      };
      mockWs.emit('message', Buffer.from(JSON.stringify(message)));

      // store.delete should not be called since store is null
      expect(store.delete).not.toHaveBeenCalled();
    });
  });

  describe('stopPingInterval when pingInterval is null', () => {
    it('should handle stopPingInterval when interval is already null', () => {
      const client = new UDLWebSocketClient({ url: 'ws://localhost:4000/ws' });

      // Close without connecting - pingInterval is null
      client.close();

      // Should not throw
      expect(consoleLogSpy).toHaveBeenCalledWith('🔌 WebSocket client closed');
    });
  });
});
