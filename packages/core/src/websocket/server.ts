import { WebSocketServer, WebSocket, type ServerOptions } from 'ws';
import type { Server } from 'node:http';
import { nodeEvents, type NodeChangeEvent } from '@/nodes/events.js';
import type { WebSocketConfig } from '@/loader.js';

/**
 * Message types sent from server to client.
 */
export type ServerMessage =
  | NodeChangeMessage
  | SubscribedMessage
  | PongMessage
  | ConnectedMessage;

/**
 * Node change notification sent to subscribed clients.
 */
export interface NodeChangeMessage {
  type: 'node:created' | 'node:updated' | 'node:deleted';
  nodeId: string;
  nodeType: string;
  timestamp: string;
  data: unknown | null;
}

/**
 * Subscription confirmation message.
 */
export interface SubscribedMessage {
  type: 'subscribed';
  data: { types: string[] | '*' };
}

/**
 * Pong response to client ping.
 */
export interface PongMessage {
  type: 'pong';
}

/**
 * Initial connection message.
 */
export interface ConnectedMessage {
  type: 'connected';
  data: { message: string };
}

/**
 * Message types sent from client to server.
 */
export type ClientMessage = SubscribeMessage | PingMessage;

/**
 * Subscribe to specific node types or all types.
 */
export interface SubscribeMessage {
  type: 'subscribe';
  data: string[] | '*';
}

/**
 * Ping message to check connection health.
 */
export interface PingMessage {
  type: 'ping';
}

/**
 * Tracks a client's subscription preferences.
 */
export interface ClientSubscription {
  /** Node types to receive updates for. '*' means all types. */
  types: string[] | '*';
}

/**
 * Extended WebSocket with subscription tracking.
 */
interface TrackedWebSocket extends WebSocket {
  isAlive: boolean;
  subscription: ClientSubscription;
}

/**
 * UDL WebSocket server for real-time node change notifications.
 *
 * Broadcasts node changes to connected clients in real-time.
 * Clients can subscribe to specific node types or all types.
 *
 * @example
 * ```typescript
 * import { UDLWebSocketServer } from 'universal-data-layer';
 *
 * const wsServer = new UDLWebSocketServer(httpServer, { path: '/ws' });
 *
 * // Server automatically broadcasts node changes
 * // Clients connect via: ws://localhost:4000/ws
 * ```
 */
export class UDLWebSocketServer {
  private wss: WebSocketServer;
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private nodeEventHandler: (event: NodeChangeEvent) => void;

  /**
   * Create a new WebSocket server.
   *
   * @param httpServer - HTTP server to attach to (if no port specified)
   * @param config - WebSocket configuration
   */
  constructor(httpServer: Server, config: WebSocketConfig = {}) {
    const { path = '/ws', heartbeatIntervalMs = 30000, port, options } = config;

    // Build WebSocket server options
    const wsOptions: ServerOptions = {
      ...options,
      path,
    };

    if (port !== undefined) {
      // Run on separate port
      wsOptions.port = port;
    } else {
      // Attach to HTTP server
      wsOptions.server = httpServer;
    }

    this.wss = new WebSocketServer(wsOptions);

    // Handle new connections
    this.wss.on('connection', (ws: WebSocket) => {
      this.handleConnection(ws as TrackedWebSocket);
    });

    // Set up heartbeat to keep connections alive
    this.heartbeatInterval = setInterval(() => {
      this.wss.clients.forEach((ws) => {
        const trackedWs = ws as TrackedWebSocket;
        if (!trackedWs.isAlive) {
          // Connection is dead, terminate it
          return trackedWs.terminate();
        }
        trackedWs.isAlive = false;
        trackedWs.ping();
      });
    }, heartbeatIntervalMs);

    // Clean up heartbeat on server close
    this.wss.on('close', () => {
      if (this.heartbeatInterval) {
        clearInterval(this.heartbeatInterval);
        this.heartbeatInterval = null;
      }
    });

    // Subscribe to node events
    this.nodeEventHandler = (event: NodeChangeEvent) => {
      this.broadcastNodeChange(event);
    };
    nodeEvents.on('node:created', this.nodeEventHandler);
    nodeEvents.on('node:updated', this.nodeEventHandler);
    nodeEvents.on('node:deleted', this.nodeEventHandler);
  }

  /**
   * Handle a new WebSocket connection.
   */
  private handleConnection(ws: TrackedWebSocket): void {
    // Initialize tracking
    ws.isAlive = true;
    ws.subscription = { types: '*' }; // Default: subscribe to all types

    // Handle pong responses (for heartbeat)
    ws.on('pong', () => {
      ws.isAlive = true;
    });

    // Handle incoming messages
    ws.on('message', (data: Buffer) => {
      this.handleMessage(ws, data);
    });

    // Send connected message
    this.send(ws, {
      type: 'connected',
      data: { message: 'Connected to UDL WebSocket server' },
    });
  }

  /**
   * Handle an incoming message from a client.
   */
  private handleMessage(ws: TrackedWebSocket, data: Buffer): void {
    try {
      const message = JSON.parse(data.toString()) as ClientMessage;

      switch (message.type) {
        case 'subscribe':
          this.handleSubscribe(ws, message);
          break;
        case 'ping':
          this.send(ws, { type: 'pong' });
          break;
        default:
          // Unknown message type, ignore
          break;
      }
    } catch {
      // Invalid JSON, ignore
    }
  }

  /**
   * Handle a subscribe message from a client.
   */
  private handleSubscribe(
    ws: TrackedWebSocket,
    message: SubscribeMessage
  ): void {
    ws.subscription.types = message.data;
    this.send(ws, {
      type: 'subscribed',
      data: { types: message.data },
    });
  }

  /**
   * Broadcast a node change event to all subscribed clients.
   */
  private broadcastNodeChange(event: NodeChangeEvent): void {
    const message: NodeChangeMessage = {
      type: event.type,
      nodeId: event.nodeId,
      nodeType: event.nodeType,
      timestamp: event.timestamp,
      data: event.node,
    };

    this.wss.clients.forEach((ws) => {
      const trackedWs = ws as TrackedWebSocket;
      if (trackedWs.readyState !== WebSocket.OPEN) {
        return;
      }

      // Check if client is subscribed to this node type
      const { types } = trackedWs.subscription;
      if (types === '*' || types.includes(event.nodeType)) {
        this.send(trackedWs, message);
      }
    });
  }

  /**
   * Send a message to a WebSocket client.
   */
  private send(ws: WebSocket, message: ServerMessage): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  /**
   * Get the number of connected clients.
   */
  getClientCount(): number {
    return this.wss.clients.size;
  }

  /**
   * Close the WebSocket server and clean up resources.
   */
  close(): Promise<void> {
    return new Promise((resolve) => {
      // Unsubscribe from node events
      nodeEvents.off('node:created', this.nodeEventHandler);
      nodeEvents.off('node:updated', this.nodeEventHandler);
      nodeEvents.off('node:deleted', this.nodeEventHandler);

      // Clear heartbeat interval
      if (this.heartbeatInterval) {
        clearInterval(this.heartbeatInterval);
        this.heartbeatInterval = null;
      }

      // Close all client connections
      this.wss.clients.forEach((ws) => {
        ws.close();
      });

      // Close the server
      this.wss.close(() => {
        resolve();
      });
    });
  }
}
