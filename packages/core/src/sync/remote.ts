import type { NodeStore } from '@/nodes/store.js';
import {
  UDLWebSocketClient,
  type WebSocketClientConfig,
} from '@/websocket/client.js';
import type { SyncResponse } from '@/handlers/sync.js';

/**
 * Local host aliases that all refer to the same machine.
 */
const LOCAL_HOST_ALIASES = new Set(['localhost', '127.0.0.1', '0.0.0.0']);

/**
 * Check if a remote URL points to the current server.
 *
 * This is used to detect when the config file is shared between
 * production and local development. If the remote URL points to
 * ourselves, we should load plugins instead of syncing from remote.
 *
 * @param remoteUrl - The remote UDL URL from config
 * @param localHost - The local server host
 * @param localPort - The local server port
 * @returns true if the remote URL points to this server
 */
export function isSelfUrl(
  remoteUrl: string,
  localHost: string,
  localPort: number
): boolean {
  try {
    const remote = new URL(remoteUrl);
    const remotePort =
      remote.port || (remote.protocol === 'https:' ? '443' : '80');

    // Ports must match
    if (String(localPort) !== String(remotePort)) {
      return false;
    }

    const remoteHost = remote.hostname.toLowerCase();
    const normalizedLocalHost = localHost.toLowerCase();

    // Direct match
    if (remoteHost === normalizedLocalHost) {
      return true;
    }

    // Both are local aliases (localhost, 127.0.0.1, 0.0.0.0)
    if (
      LOCAL_HOST_ALIASES.has(remoteHost) &&
      LOCAL_HOST_ALIASES.has(normalizedLocalHost)
    ) {
      return true;
    }

    return false;
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
 * @returns The WebSocket client if connected, null if connection failed
 */
export async function tryConnectRemoteWebSocket(
  url: string,
  store: NodeStore,
  config?: Partial<Omit<WebSocketClientConfig, 'url'>>
): Promise<UDLWebSocketClient | null> {
  // Convert HTTP URL to WebSocket URL
  const wsUrl = url.replace(/^http/, 'ws') + '/ws';

  const client = new UDLWebSocketClient({
    url: wsUrl,
    ...config,
  });

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

  // Try to connect WebSocket for real-time updates
  const wsClient = await tryConnectRemoteWebSocket(
    config.url,
    store,
    config.websocket
  );

  return wsClient;
}
