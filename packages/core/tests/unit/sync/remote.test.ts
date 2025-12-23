import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  isRemoteReachable,
  fetchRemoteNodes,
  tryConnectRemoteWebSocket,
  initRemoteSync,
} from '@/sync/remote.js';
import type { NodeStore } from '@/nodes/store.js';
import { UDLWebSocketClient } from '@/websocket/client.js';

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// Mock UDLWebSocketClient
vi.mock('@/websocket/client.js', () => ({
  UDLWebSocketClient: vi.fn(),
}));

// Mock cache manager functions to avoid store.getAll() issues
vi.mock('@/cache/manager.js', () => ({
  replaceAllCaches: vi.fn().mockResolvedValue(undefined),
}));

// Mock console.log to avoid noise in tests
vi.spyOn(console, 'log').mockImplementation(() => {});

describe('remote sync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('isRemoteReachable', () => {
    it('returns true when remote server responds with ok status', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true });

      const result = await isRemoteReachable('http://localhost:4000');

      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:4000/health',
        expect.objectContaining({
          signal: expect.any(AbortSignal),
        })
      );
    });

    it('returns false when remote server responds with non-ok status', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false });

      const result = await isRemoteReachable('http://localhost:4000');

      expect(result).toBe(false);
    });

    it('returns false when fetch throws an error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await isRemoteReachable('http://localhost:4000');

      expect(result).toBe(false);
    });

    it('returns false when request is aborted', async () => {
      // Mock fetch to check if signal is passed and simulate abort
      mockFetch.mockImplementationOnce(
        (_url: string, _options: { signal: AbortSignal }) => {
          // Simulate the abort controller being triggered
          return Promise.reject(new DOMException('Aborted', 'AbortError'));
        }
      );

      const result = await isRemoteReachable('http://localhost:4000', 100);
      expect(result).toBe(false);
    });

    it('uses custom timeout when provided', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true });

      await isRemoteReachable('http://localhost:4000', 5000);

      expect(mockFetch).toHaveBeenCalled();
    });

    it('constructs correct health URL from base URL', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true });

      await isRemoteReachable('https://example.com:8080');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://example.com:8080/health',
        expect.any(Object)
      );
    });
  });

  describe('fetchRemoteNodes', () => {
    it('fetches nodes from /_sync endpoint and populates store', async () => {
      const mockNodes = [
        { id: 'node1', type: 'TestType', data: 'test1' },
        { id: 'node2', type: 'TestType', data: 'test2' },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ updated: mockNodes, deleted: [] }),
      });

      const mockStore = {
        set: vi.fn(),
      } as unknown as NodeStore;

      await fetchRemoteNodes('http://localhost:4000', mockStore);

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:4000/_sync?since=1970-01-01T00%3A00%3A00Z'
      );
      expect(mockStore.set).toHaveBeenCalledTimes(2);
      expect(mockStore.set).toHaveBeenCalledWith(mockNodes[0]);
      expect(mockStore.set).toHaveBeenCalledWith(mockNodes[1]);
    });

    it('throws error when response is not ok', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      const mockStore = {
        set: vi.fn(),
      } as unknown as NodeStore;

      await expect(
        fetchRemoteNodes('http://localhost:4000', mockStore)
      ).rejects.toThrow(
        'Failed to fetch from remote UDL: 500 Internal Server Error'
      );
    });

    it('handles empty node list', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ updated: [], deleted: [] }),
      });

      const mockStore = {
        set: vi.fn(),
      } as unknown as NodeStore;

      await fetchRemoteNodes('http://localhost:4000', mockStore);

      expect(mockStore.set).not.toHaveBeenCalled();
    });
  });

  describe('tryConnectRemoteWebSocket', () => {
    it('returns WebSocket client when connection succeeds', async () => {
      const mockConnect = vi.fn().mockResolvedValue(undefined);
      const mockClientInstance = { connect: mockConnect };

      vi.mocked(UDLWebSocketClient).mockImplementation(
        () => mockClientInstance as unknown as UDLWebSocketClient
      );

      const mockStore = {} as NodeStore;

      const result = await tryConnectRemoteWebSocket(
        'http://localhost:4000',
        mockStore
      );

      expect(result).toBe(mockClientInstance);
      expect(UDLWebSocketClient).toHaveBeenCalledWith({
        url: 'ws://localhost:4000/ws',
      });
      expect(mockConnect).toHaveBeenCalledWith(mockStore);
    });

    it('returns null when connection fails', async () => {
      const mockConnect = vi
        .fn()
        .mockRejectedValue(new Error('Connection failed'));
      const mockClientInstance = { connect: mockConnect };

      vi.mocked(UDLWebSocketClient).mockImplementation(
        () => mockClientInstance as unknown as UDLWebSocketClient
      );

      const mockStore = {} as NodeStore;

      const result = await tryConnectRemoteWebSocket(
        'http://localhost:4000',
        mockStore
      );

      expect(result).toBeNull();
    });

    it('converts https URL to wss', async () => {
      const mockConnect = vi.fn().mockResolvedValue(undefined);
      const mockClientInstance = { connect: mockConnect };

      vi.mocked(UDLWebSocketClient).mockImplementation(
        () => mockClientInstance as unknown as UDLWebSocketClient
      );

      const mockStore = {} as NodeStore;

      await tryConnectRemoteWebSocket('https://example.com', mockStore);

      expect(UDLWebSocketClient).toHaveBeenCalledWith({
        url: 'wss://example.com/ws',
      });
    });

    it('passes additional config options to WebSocket client', async () => {
      const mockConnect = vi.fn().mockResolvedValue(undefined);
      const mockClientInstance = { connect: mockConnect };

      vi.mocked(UDLWebSocketClient).mockImplementation(
        () => mockClientInstance as unknown as UDLWebSocketClient
      );

      const mockStore = {} as NodeStore;
      const wsConfig = { reconnectDelayMs: 5000, maxReconnectAttempts: 3 };

      await tryConnectRemoteWebSocket(
        'http://localhost:4000',
        mockStore,
        wsConfig
      );

      expect(UDLWebSocketClient).toHaveBeenCalledWith({
        url: 'ws://localhost:4000/ws',
        reconnectDelayMs: 5000,
        maxReconnectAttempts: 3,
      });
    });

    it('passes onWebhookReceived callback to WebSocket client', async () => {
      const mockConnect = vi.fn().mockResolvedValue(undefined);
      const mockClientInstance = { connect: mockConnect };

      vi.mocked(UDLWebSocketClient).mockImplementation(
        () => mockClientInstance as unknown as UDLWebSocketClient
      );

      const mockStore = {} as NodeStore;
      const onWebhookReceived = vi.fn();

      await tryConnectRemoteWebSocket(
        'http://localhost:4000',
        mockStore,
        undefined,
        onWebhookReceived
      );

      expect(UDLWebSocketClient).toHaveBeenCalledWith({
        url: 'ws://localhost:4000/ws',
        onWebhookReceived,
      });
    });

    it('does not include onWebhookReceived when not provided', async () => {
      const mockConnect = vi.fn().mockResolvedValue(undefined);
      const mockClientInstance = { connect: mockConnect };

      vi.mocked(UDLWebSocketClient).mockImplementation(
        () => mockClientInstance as unknown as UDLWebSocketClient
      );

      const mockStore = {} as NodeStore;

      await tryConnectRemoteWebSocket(
        'http://localhost:4000',
        mockStore,
        undefined,
        undefined
      );

      expect(UDLWebSocketClient).toHaveBeenCalledWith({
        url: 'ws://localhost:4000/ws',
      });
    });
  });

  describe('initRemoteSync', () => {
    it('fetches nodes and connects to WebSocket', async () => {
      // Mock fetchRemoteNodes
      const mockNodes = [{ id: 'node1', type: 'TestType', data: 'test1' }];
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ updated: mockNodes, deleted: [] }),
      });

      // Mock WebSocket connection
      const mockConnect = vi.fn().mockResolvedValue(undefined);
      const mockClientInstance = { connect: mockConnect };
      vi.mocked(UDLWebSocketClient).mockImplementation(
        () => mockClientInstance as unknown as UDLWebSocketClient
      );

      const mockStore = {
        set: vi.fn(),
      } as unknown as NodeStore;

      const result = await initRemoteSync(
        { url: 'http://localhost:4000' },
        mockStore
      );

      expect(mockStore.set).toHaveBeenCalledWith(mockNodes[0]);
      expect(result).toBe(mockClientInstance);
    });

    it('returns null when WebSocket connection fails', async () => {
      // Mock fetchRemoteNodes
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ updated: [], deleted: [] }),
      });

      // Mock WebSocket connection failure
      const mockConnect = vi
        .fn()
        .mockRejectedValue(new Error('Connection failed'));
      const mockClientInstance = { connect: mockConnect };
      vi.mocked(UDLWebSocketClient).mockImplementation(
        () => mockClientInstance as unknown as UDLWebSocketClient
      );

      const mockStore = {
        set: vi.fn(),
      } as unknown as NodeStore;

      const result = await initRemoteSync(
        { url: 'http://localhost:4000' },
        mockStore
      );

      expect(result).toBeNull();
    });

    it('passes websocket config to tryConnectRemoteWebSocket', async () => {
      // Mock fetchRemoteNodes
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ updated: [], deleted: [] }),
      });

      // Mock WebSocket connection
      const mockConnect = vi.fn().mockResolvedValue(undefined);
      const mockClientInstance = { connect: mockConnect };
      vi.mocked(UDLWebSocketClient).mockImplementation(
        () => mockClientInstance as unknown as UDLWebSocketClient
      );

      const mockStore = {
        set: vi.fn(),
      } as unknown as NodeStore;

      await initRemoteSync(
        {
          url: 'http://localhost:4000',
          websocket: { reconnectDelayMs: 3000 },
        },
        mockStore
      );

      expect(UDLWebSocketClient).toHaveBeenCalledWith({
        url: 'ws://localhost:4000/ws',
        reconnectDelayMs: 3000,
      });
    });

    it('logs instant webhook relay when wsClient and onWebhookReceived are both present', async () => {
      // Mock fetchRemoteNodes
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ updated: [], deleted: [] }),
      });

      // Mock WebSocket connection success
      const mockConnect = vi.fn().mockResolvedValue(undefined);
      const mockClientInstance = { connect: mockConnect };
      vi.mocked(UDLWebSocketClient).mockImplementation(
        () => mockClientInstance as unknown as UDLWebSocketClient
      );

      const mockStore = {
        set: vi.fn(),
      } as unknown as NodeStore;

      const onWebhookReceived = vi.fn();
      const consoleLogSpy = vi.spyOn(console, 'log');

      await initRemoteSync(
        {
          url: 'http://localhost:4000',
          onWebhookReceived,
        },
        mockStore
      );

      expect(consoleLogSpy).toHaveBeenCalledWith(
        '📡 Instant webhook relay enabled for local processing'
      );
    });

    it('does not log instant webhook relay when wsClient is null', async () => {
      // Mock fetchRemoteNodes
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ updated: [], deleted: [] }),
      });

      // Mock WebSocket connection failure
      const mockConnect = vi
        .fn()
        .mockRejectedValue(new Error('Connection failed'));
      const mockClientInstance = { connect: mockConnect };
      vi.mocked(UDLWebSocketClient).mockImplementation(
        () => mockClientInstance as unknown as UDLWebSocketClient
      );

      const mockStore = {
        set: vi.fn(),
      } as unknown as NodeStore;

      const onWebhookReceived = vi.fn();
      const consoleLogSpy = vi.spyOn(console, 'log');
      consoleLogSpy.mockClear();

      await initRemoteSync(
        {
          url: 'http://localhost:4000',
          onWebhookReceived,
        },
        mockStore
      );

      // Should not log the instant webhook relay message
      expect(consoleLogSpy).not.toHaveBeenCalledWith(
        '📡 Instant webhook relay enabled for local processing'
      );
    });

    it('does not log instant webhook relay when onWebhookReceived is not provided', async () => {
      // Mock fetchRemoteNodes
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ updated: [], deleted: [] }),
      });

      // Mock WebSocket connection success
      const mockConnect = vi.fn().mockResolvedValue(undefined);
      const mockClientInstance = { connect: mockConnect };
      vi.mocked(UDLWebSocketClient).mockImplementation(
        () => mockClientInstance as unknown as UDLWebSocketClient
      );

      const mockStore = {
        set: vi.fn(),
      } as unknown as NodeStore;

      const consoleLogSpy = vi.spyOn(console, 'log');
      consoleLogSpy.mockClear();

      await initRemoteSync(
        {
          url: 'http://localhost:4000',
        },
        mockStore
      );

      // Should not log the instant webhook relay message
      expect(consoleLogSpy).not.toHaveBeenCalledWith(
        '📡 Instant webhook relay enabled for local processing'
      );
    });
  });
});
