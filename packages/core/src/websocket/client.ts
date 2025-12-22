import WebSocket from 'ws';
import type { NodeStore } from '@/nodes/store.js';
import type {
  ServerMessage,
  NodeChangeMessage,
  ClientMessage,
} from './server.js';

/**
 * Configuration for the WebSocket client.
 */
export interface WebSocketClientConfig {
  /** WebSocket URL to connect to (e.g., ws://localhost:4000/ws) */
  url: string;
  /** Reconnect delay in milliseconds after connection loss. Default: 5000 */
  reconnectDelayMs?: number;
  /** Maximum reconnect attempts. Default: Infinity */
  maxReconnectAttempts?: number;
  /** Ping interval in milliseconds. Default: 30000 */
  pingIntervalMs?: number;
}

/**
 * WebSocket client for connecting to a remote UDL server.
 *
 * Receives real-time node change notifications and updates the local store.
 *
 * @example
 * ```typescript
 * const client = new UDLWebSocketClient({
 *   url: 'ws://production-udl.example.com/ws',
 * });
 *
 * await client.connect(localStore);
 * ```
 */
export class UDLWebSocketClient {
  private config: Required<WebSocketClientConfig>;
  private ws: WebSocket | null = null;
  private store: NodeStore | null = null;
  private reconnectAttempts = 0;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private pingInterval: ReturnType<typeof setInterval> | null = null;
  private isClosing = false;

  constructor(config: WebSocketClientConfig) {
    this.config = {
      url: config.url,
      reconnectDelayMs: config.reconnectDelayMs ?? 5000,
      maxReconnectAttempts: config.maxReconnectAttempts ?? Infinity,
      pingIntervalMs: config.pingIntervalMs ?? 30000,
    };
  }

  /**
   * Connect to the remote WebSocket server and start syncing.
   *
   * @param store - Local node store to update with remote changes
   * @returns Promise that resolves when connected, rejects on failure
   */
  connect(store: NodeStore): Promise<void> {
    this.store = store;
    this.isClosing = false;

    return new Promise((resolve, reject) => {
      this.createConnection(resolve, reject);
    });
  }

  /**
   * Create a WebSocket connection.
   */
  private createConnection(
    onConnect?: () => void,
    onError?: (error: Error) => void
  ): void {
    try {
      this.ws = new WebSocket(this.config.url);

      this.ws.on('open', () => {
        console.log(`🔌 Connected to remote UDL: ${this.config.url}`);
        this.reconnectAttempts = 0;

        // Subscribe to all node types
        this.send({ type: 'subscribe', data: '*' });

        // Start ping interval
        this.startPingInterval();

        onConnect?.();
      });

      this.ws.on('message', (data: Buffer) => {
        this.handleMessage(data);
      });

      this.ws.on('close', () => {
        this.stopPingInterval();
        if (!this.isClosing) {
          console.log('🔌 Connection closed, attempting reconnect...');
          this.scheduleReconnect();
        }
      });

      this.ws.on('error', (error) => {
        console.error('🔌 WebSocket error:', error.message);
        if (this.reconnectAttempts === 0 && onError) {
          // First connection attempt failed
          onError(error);
        }
      });
    } catch (error) {
      onError?.(error as Error);
    }
  }

  /**
   * Handle incoming message from server.
   */
  private handleMessage(data: Buffer): void {
    try {
      const message = JSON.parse(data.toString()) as ServerMessage;

      switch (message.type) {
        case 'connected':
          console.log('🔌 Remote UDL:', message.data.message);
          break;

        case 'subscribed':
          console.log('🔌 Subscribed to node types:', message.data.types);
          break;

        case 'pong':
          // Connection is alive
          break;

        case 'node:created':
        case 'node:updated':
          this.handleNodeUpdate(message);
          break;

        case 'node:deleted':
          this.handleNodeDelete(message);
          break;
      }
    } catch {
      // Invalid JSON, ignore
    }
  }

  /**
   * Handle node creation or update from remote.
   */
  private handleNodeUpdate(message: NodeChangeMessage): void {
    if (!this.store || !message.data) return;

    const node = message.data as Record<string, unknown>;

    // Ensure node has required internal structure
    if (!node['internal']) {
      node['internal'] = {
        id: message.nodeId,
        type: message.nodeType,
      };
    }

    // Cast to Node type for store.set
    this.store.set(node as unknown as import('@/nodes/types.js').Node);
    console.log(
      `🔄 Remote ${message.type}: ${message.nodeType}:${message.nodeId}`
    );
  }

  /**
   * Handle node deletion from remote.
   */
  private handleNodeDelete(message: NodeChangeMessage): void {
    if (!this.store) return;

    this.store.delete(message.nodeId);
    console.log(
      `🔄 Remote node:deleted: ${message.nodeType}:${message.nodeId}`
    );
  }

  /**
   * Send a message to the server.
   */
  private send(message: ClientMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  /**
   * Start the ping interval to keep connection alive.
   */
  private startPingInterval(): void {
    this.stopPingInterval();
    this.pingInterval = setInterval(() => {
      this.send({ type: 'ping' });
    }, this.config.pingIntervalMs);
  }

  /**
   * Stop the ping interval.
   */
  private stopPingInterval(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  /**
   * Schedule a reconnection attempt.
   */
  private scheduleReconnect(): void {
    if (this.isClosing) return;
    if (this.reconnectAttempts >= this.config.maxReconnectAttempts) {
      console.error('🔌 Max reconnect attempts reached, giving up');
      return;
    }

    this.reconnectAttempts++;
    console.log(
      `🔌 Reconnecting in ${this.config.reconnectDelayMs}ms (attempt ${this.reconnectAttempts})`
    );

    this.reconnectTimeout = setTimeout(() => {
      this.createConnection();
    }, this.config.reconnectDelayMs);
  }

  /**
   * Close the WebSocket connection.
   */
  close(): void {
    this.isClosing = true;
    this.stopPingInterval();

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    console.log('🔌 WebSocket client closed');
  }

  /**
   * Check if the client is connected.
   */
  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}
