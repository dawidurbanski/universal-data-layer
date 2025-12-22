export {
  UDLWebSocketServer,
  type ServerMessage,
  type NodeChangeMessage,
  type SubscribedMessage,
  type PongMessage,
  type ConnectedMessage,
  type ClientMessage,
  type SubscribeMessage,
  type PingMessage,
  type ClientSubscription,
} from './server.js';

export { UDLWebSocketClient, type WebSocketClientConfig } from './client.js';

import { UDLWebSocketServer } from './server.js';

/**
 * Singleton WebSocket server instance.
 * Set via `setDefaultWebSocketServer` during server startup.
 */
let _defaultWebSocketServer: UDLWebSocketServer | null = null;

/**
 * Get the default WebSocket server instance.
 * Returns null if WebSocket server is not enabled.
 */
export function getDefaultWebSocketServer(): UDLWebSocketServer | null {
  return _defaultWebSocketServer;
}

/**
 * Set the default WebSocket server instance.
 * Called during server startup when WebSocket is enabled.
 *
 * @internal
 */
export function setDefaultWebSocketServer(
  server: UDLWebSocketServer | null
): void {
  _defaultWebSocketServer = server;
}
