import type { NodeStore } from '@/nodes/store.js';
import { replaceAllCaches } from '@/cache/manager.js';
import {
  UDLWebSocketClient,
  type WebSocketClientConfig,
  type WebhookReceivedEvent,
} from '@/websocket/client.js';
import type { SyncResponse } from '@/handlers/sync.js';

/**
 * Check if a remote UDL server is reachable.
 *
 * This is used to detect whether we should sync from remote or load
 * plugins locally. If the remote is not reachable, we are likely the
 * production server and should load plugins.
 *
 * @param remoteUrl - The remote UDL URL to check
 * @param timeoutMs - Timeout in milliseconds (default: 2000)
 * @returns true if the remote server is reachable
 */
export async function isRemoteReachable(
  remoteUrl: string,
  timeoutMs = 2000
): Promise<boolean> {
  try {
    const healthUrl = new URL('/health', remoteUrl);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(healthUrl.toString(), {
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Configuration for remote sync.
 */
export interface RemoteSyncConfig {
  /** Base URL of the remote UDL server (e.g., https://production-udl.example.com) */
  url: string;
  /** WebSocket configuration overrides */
  websocket?: Partial<Omit<WebSocketClientConfig, 'url'>>;
  /**
   * Callback invoked immediately when a webhook:received message is received.
   * This enables instant processing of webhooks without waiting for batch debounce.
   */
  onWebhookReceived?: (event: WebhookReceivedEvent) => void | Promise<void>;
}

/**
 * Fetch all nodes from a remote UDL server.
 *
 * Uses the /_sync endpoint with epoch time to get all nodes.
 *
 * @param url - Base URL of the remote UDL server
 * @param store - Local node store to populate
 */
export async function fetchRemoteNodes(
  url: string,
  store: NodeStore
): Promise<void> {
  const syncUrl = new URL('/_sync', url);
  // Use epoch to get all nodes
  syncUrl.searchParams.set('since', '1970-01-01T00:00:00Z');

  console.log(`📡 Fetching nodes from remote UDL: ${url}`);

  const response = await fetch(syncUrl.toString());

  if (!response.ok) {
    throw new Error(
      `Failed to fetch from remote UDL: ${response.status} ${response.statusText}`
    );
  }

  const data = (await response.json()) as SyncResponse;

  // Populate the local store
  let count = 0;
  for (const node of data.updated) {
    store.set(node);
    count++;
  }

  console.log(`📡 Loaded ${count} nodes from remote UDL`);
}

/**
 * Try to connect to the remote UDL WebSocket server.
 *
 * This will only succeed if the remote server has WebSocket enabled.
 * Fails gracefully if WebSocket is not available.
 *
 * @param url - Base URL of the remote UDL server
 * @param store - Local node store to update with changes
 * @param config - Optional WebSocket configuration overrides
 * @param onWebhookReceived - Optional callback for instant webhook processing
 * @returns The WebSocket client if connected, null if connection failed
 */
export async function tryConnectRemoteWebSocket(
  url: string,
  store: NodeStore,
  config?: Partial<Omit<WebSocketClientConfig, 'url'>>,
  onWebhookReceived?: (event: WebhookReceivedEvent) => void | Promise<void>
): Promise<UDLWebSocketClient | null> {
  // Convert HTTP URL to WebSocket URL
  const wsUrl = url.replace(/^http/, 'ws') + '/ws';

  const clientConfig: WebSocketClientConfig = {
    url: wsUrl,
    ...config,
  };
  if (onWebhookReceived) {
    clientConfig.onWebhookReceived = onWebhookReceived;
  }
  const client = new UDLWebSocketClient(clientConfig);

  try {
    await client.connect(store);
    return client;
  } catch {
    // WebSocket not available on remote server
    console.log(
      `📡 Remote WebSocket not available (this is fine if remote has websockets disabled)`
    );
    return null;
  }
}

/**
 * Initialize sync from a remote UDL server.
 *
 * 1. Fetches all nodes from the remote server
 * 2. Attempts to connect to WebSocket for real-time updates
 *
 * @param config - Remote sync configuration
 * @param store - Local node store
 * @returns WebSocket client if connected, null otherwise
 */
export async function initRemoteSync(
  config: RemoteSyncConfig,
  store: NodeStore
): Promise<UDLWebSocketClient | null> {
  // Fetch initial data
  await fetchRemoteNodes(config.url, store);

  // Save fetched nodes to cache for offline support and faster restarts
  // Replace entirely since remote is authoritative
  await replaceAllCaches(store);

  // Try to connect WebSocket for real-time updates
  const wsClient = await tryConnectRemoteWebSocket(
    config.url,
    store,
    config.websocket,
    config.onWebhookReceived
  );

  if (wsClient && config.onWebhookReceived) {
    console.log('📡 Instant webhook relay enabled for local processing');
  }

  return wsClient;
}
