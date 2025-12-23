# universal-data-layer

## 2.0.0

### Minor Changes

- [#70](https://github.com/dawidurbanski/universal-data-layer/pull/70) [`dfc7d90`](https://github.com/dawidurbanski/universal-data-layer/commit/dfc7d9054b761b951995dc5ceba467c2aa560d1a) Thanks [@dawidurbanski](https://github.com/dawidurbanski)! - Add health check endpoints for production deployments

  Introduces `/health` and `/ready` endpoints to support container orchestration (Kubernetes, Docker Swarm), load balancers, and deployment verification.

  **Endpoints:**
  - `GET /health` - Liveness probe, returns 200 when server is running
  - `GET /ready` - Readiness probe, returns 200 when fully initialized, 503 during startup

  **Response format:**

  ```json
  // /health
  { "status": "ok", "timestamp": "2025-12-21T10:30:00Z" }

  // /ready (when ready)
  { "status": "ready", "timestamp": "2025-12-21T10:30:00Z", "checks": { "graphql": true, "nodeStore": true } }

  // /ready (during startup)
  { "status": "initializing", "timestamp": "2025-12-21T10:30:00Z", "checks": { "graphql": false, "nodeStore": false } }
  ```

- [#70](https://github.com/dawidurbanski/universal-data-layer/pull/70) [`6430a55`](https://github.com/dawidurbanski/universal-data-layer/commit/6430a55a4f1054fd0397f8ec1e21cf6a4e359e81) Thanks [@dawidurbanski](https://github.com/dawidurbanski)! - Add webhook HTTP routing with convention-based URL pattern

  Routes incoming webhook requests to the appropriate plugin handler using a fixed URL pattern `POST /_webhooks/{pluginName}/sync`.

  **Features:**
  - Convention-based routing: all webhooks use the `/sync` path
  - Routes webhooks to correct handler based on plugin name
  - Validates HTTP method (only POST allowed)
  - Collects raw request body for handler processing
  - Parses JSON body when content-type is `application/json`
  - Provides `WebhookHandlerContext` with store, actions, rawBody, and body
  - Enforces 1MB body size limit to prevent abuse
  - Returns appropriate HTTP status codes (405, 404, 400, 413)
  - Queues webhooks for batch processing with debounce

  **URL Format:**

  ```
  POST /_webhooks/{plugin-name}/sync

  Examples:
  POST /_webhooks/contentful/sync
  POST /_webhooks/shopify/sync
  POST /_webhooks/my-plugin/sync
  ```

  **Exports:**
  - `isWebhookRequest` - Check if URL is a webhook request
  - `getPluginFromWebhookUrl` - Extract plugin name from webhook URL
  - `webhookHandler` - HTTP handler for webhook requests
  - `WEBHOOK_PATH_PREFIX` - URL prefix constant (`/_webhooks/`)

- [#70](https://github.com/dawidurbanski/universal-data-layer/pull/70) [`b376bed`](https://github.com/dawidurbanski/universal-data-layer/commit/b376bed4ad8398de74dcbc4fa05a960412f820af) Thanks [@dawidurbanski](https://github.com/dawidurbanski)! - Add plugin webhook handler export API

  Plugins can now export a `registerWebhookHandler` function to handle webhooks with custom logic. When exported, it replaces the default CRUD handler for the plugin's `/_webhooks/{plugin-name}/sync` endpoint.

  **Usage in plugins:**

  ```typescript
  // Plugin's udl.config.ts
  import { defineConfig } from 'universal-data-layer';

  export const config = defineConfig({
    name: 'my-cms-plugin',
    type: 'source',
  });

  // Custom webhook handler replaces the default
  export async function registerWebhookHandler({ req, res, actions, body, store, rawBody }) {
    // Verify signature using your CMS's method
    const signature = req.headers['x-webhook-signature'];
    if (!verifySignature(rawBody, signature)) {
      res.writeHead(401);
      res.end('Invalid signature');
      return;
    }

    // Handle different event types
    const eventType = req.headers['x-webhook-type'];

    if (eventType === 'entry.publish') {
      await actions.createNode(transformEntry(body), { ... });
    } else if (eventType === 'entry.delete') {
      await actions.deleteNode(body.sys.id);
    }

    res.writeHead(200);
    res.end();
  }
  ```

  **Key benefits:**
  - Clear separation: `sourceNodes` for sourcing, `registerWebhookHandler` for webhooks
  - Convention-based URL: always `/_webhooks/{plugin-name}/sync`
  - Plugin controls its own routing and signature verification internally
  - Replaces default handler - no confusion about which handler runs

  **Handler context:**

  The handler receives a flattened context object:

  ```typescript
  interface PluginWebhookHandlerContext {
    req: IncomingMessage; // The incoming HTTP request
    res: ServerResponse; // The server response
    actions: NodeActions; // Node CRUD operations
    store: NodeStore; // Access to all nodes
    body: unknown; // Parsed JSON body
    rawBody: Buffer; // Raw body for signature verification
  }
  ```

  **New exports:**
  - `PluginWebhookHandler` - Type for the handler function
  - `PluginWebhookHandlerContext` - Type for the handler context
  - `registerPluginWebhookHandler` - Internal utility for registering custom handlers

- [#70](https://github.com/dawidurbanski/universal-data-layer/pull/70) [`5ff7110`](https://github.com/dawidurbanski/universal-data-layer/commit/5ff7110e4e80e0c6d84d7924b078200e69d07949) Thanks [@dawidurbanski](https://github.com/dawidurbanski)! - Add centralized cache manager for plugin cache coordination

  Introduces a `CacheManager` module that provides a central point for coordinating plugin cache updates. This enables webhook handlers and remote sync to persist changes to disk after store modifications.

  **Features:**
  - `registerPluginCache(pluginName, cache)`: Register a plugin's cache storage
  - `initPluginCache(pluginName, cacheLocation, customCache?)`: Initialize and register a cache
  - `savePluginCache(pluginName, store?)`: Save a specific plugin's nodes to cache
  - `saveAffectedPlugins(affectedPlugins, store?)`: Save caches for multiple plugins
  - `replaceAllCaches(store?)`: Replace all plugin caches (for remote sync)
  - `setStore(store)`: Set the node store reference for cache operations

  **Integration:**
  - Loader now uses cache manager for plugin cache operations
  - Webhook batch processing automatically saves affected plugin caches
  - Remote sync persists fetched nodes to cache for offline support

  **New exports:**

  ```typescript
  import {
    setStore,
    getStore,
    registerPluginCache,
    initPluginCache,
    savePluginCache,
    saveAffectedPlugins,
    replaceAllCaches,
    clearAllCaches,
    resetCacheManager,
  } from 'universal-data-layer';
  ```

- [#70](https://github.com/dawidurbanski/universal-data-layer/pull/70) [`2e01999`](https://github.com/dawidurbanski/universal-data-layer/commit/2e0199904518814cd899385ec29dbf8b002cb06b) Thanks [@dawidurbanski](https://github.com/dawidurbanski)! - Add default webhook handler for standardized CRUD operations

  This release introduces a default webhook handler that provides a standardized way to create, update, and delete nodes via webhooks. Every loaded plugin automatically gets a webhook endpoint registered with zero configuration required.

  **Features:**
  - Automatic registration of `/_webhooks/{plugin-name}/sync` endpoint for every plugin
  - Standardized payload format for `create`, `update`, `delete`, and `upsert` operations
  - Support for custom `idField` to look up nodes by external identifiers
  - Won't overwrite custom handlers if plugin registers its own

  **Zero Configuration:**

  ```typescript
  // No config needed - default webhooks just work
  // Every plugin gets: /_webhooks/{plugin-name}/sync
  export const { config } = defineConfig({
    plugins: ['@universal-data-layer/plugin-source-contentful'],
  });
  ```

  **Payload format:**

  ```typescript
  interface DefaultWebhookPayload {
    operation: 'create' | 'update' | 'delete' | 'upsert';
    nodeId: string; // External ID or internal node ID
    nodeType: string; // Node type (e.g., 'Product', 'Article')
    data?: Record<string, unknown>; // Node data (required for create/update/upsert)
  }
  ```

  **Example requests:**

  ```bash
  # Create a node
  curl -X POST http://localhost:4000/_webhooks/my-plugin/sync \
    -H "Content-Type: application/json" \
    -d '{"operation":"create","nodeId":"123","nodeType":"Product","data":{"name":"Widget"}}'

  # Update a node
  curl -X POST http://localhost:4000/_webhooks/my-plugin/sync \
    -d '{"operation":"update","nodeId":"123","nodeType":"Product","data":{"name":"Updated Widget"}}'

  # Delete a node
  curl -X POST http://localhost:4000/_webhooks/my-plugin/sync \
    -d '{"operation":"delete","nodeId":"123","nodeType":"Product"}'

  # Upsert (create or update)
  curl -X POST http://localhost:4000/_webhooks/my-plugin/sync \
    -d '{"operation":"upsert","nodeId":"123","nodeType":"Product","data":{"name":"Widget"}}'
  ```

  **idField support:**

  When a plugin specifies an `idField` in its config, the default webhook handler looks up existing nodes by that field:

  ```typescript
  // Plugin config
  export const config = defineConfig({
    idField: 'externalId', // Webhook will look up nodes by this field
  });
  ```

- [#70](https://github.com/dawidurbanski/universal-data-layer/pull/70) [`aba060e`](https://github.com/dawidurbanski/universal-data-layer/commit/aba060e79217bd4c2bca8b8a56c7835296c74c02) Thanks [@dawidurbanski](https://github.com/dawidurbanski)! - Add deletion log for partial sync support

  This release introduces a DeletionLog class that tracks node deletions with timestamps, enabling clients to perform partial sync without needing a full refetch.

  **Features:**
  - `DeletionLog` class for tracking deleted nodes
  - `recordDeletion(node)`: Record a node deletion with timestamp
  - `getDeletedSince(timestamp)`: Query deletions after a given time
  - `cleanup()`: Remove entries older than TTL (default: 30 days)
  - Serialization support via `toJSON()` and `fromJSON()` for persistence
  - Configurable TTL (time-to-live) for deletion entries

  **Example usage:**

  ```typescript
  import { DeletionLog } from 'universal-data-layer';

  const log = new DeletionLog(30); // 30 day TTL

  // Record a deletion
  log.recordDeletion(deletedNode);

  // Query deletions since last sync
  const deletedSince = log.getDeletedSince(lastSyncTimestamp);

  // Serialize for persistence
  const data = log.toJSON();

  // Restore from persistence
  const restored = DeletionLog.fromJSON(data);
  ```

- [#70](https://github.com/dawidurbanski/universal-data-layer/pull/70) [`8ec4f2b`](https://github.com/dawidurbanski/universal-data-layer/commit/8ec4f2b4f20825e597c52f1420b7f61a63264d02) Thanks [@dawidurbanski](https://github.com/dawidurbanski)! - feat(core): add graceful shutdown for production deployments
  - Handle SIGTERM and SIGINT signals for graceful shutdown
  - Complete in-flight requests before closing server
  - Return 503 on `/ready` endpoint during shutdown
  - Configurable grace period (default: 30 seconds)
  - Clean up file watchers and resources on shutdown
  - Log shutdown progress to console

- [#70](https://github.com/dawidurbanski/universal-data-layer/pull/70) [`5ff7110`](https://github.com/dawidurbanski/universal-data-layer/commit/5ff7110e4e80e0c6d84d7924b078200e69d07949) Thanks [@dawidurbanski](https://github.com/dawidurbanski)! - Add instant webhook relay for remote sync

  Local UDL instances can now receive and process webhooks instantly via WebSocket relay, eliminating the need to wait for batch debounce on the production server.

  **How it works:**
  1. Production UDL receives a webhook and queues it
  2. Immediately broadcasts `webhook:received` message to WebSocket subscribers
  3. Local UDL instances receive the message and process the webhook locally
  4. Local caches are updated instantly

  **Features:**
  - New `webhook:queued` event on WebhookQueue for instant relay
  - New `webhook:received` WebSocket message type
  - `broadcastWebhookReceived(webhook)` method on UDLWebSocketServer
  - `onWebhookReceived` callback on WebSocketClient and RemoteSyncConfig
  - Local UDL instances can process relayed webhooks using registered handlers
  - Node change events are skipped when handling webhooks locally (avoids double processing)

  **Configuration:**

  The instant relay is automatically enabled when using remote sync. Local instances register webhook handlers by loading plugins with `isLocal: true` option.

  **Message format:**

  ```typescript
  interface WebhookReceivedMessage {
    type: 'webhook:received';
    pluginName: string;
    body: unknown;
    headers: Record<string, string | string[] | undefined>;
    timestamp: string;
  }
  ```

  **Exports:**
  - `WebhookReceivedEvent`: Event data passed to onWebhookReceived callback

- [#70](https://github.com/dawidurbanski/universal-data-layer/pull/70) [`6ffae50`](https://github.com/dawidurbanski/universal-data-layer/commit/6ffae500b103c2a59b68c79bff01d11ac6fce5ef) Thanks [@dawidurbanski](https://github.com/dawidurbanski)! - Add outbound webhook triggering with transformPayload support

  Trigger outbound webhooks after a batch of incoming webhooks has been processed. This enables the "30 webhooks → 1 build" optimization by notifying external systems (e.g., Vercel deploy hooks, CI systems) once after processing a batch rather than for each individual webhook.

  **Features:**
  - `OutboundWebhookManager` class for managing outbound webhook notifications
  - Configurable outbound webhook endpoints via `remote.webhooks.outbound`
  - HTTP method selection (POST or GET, default POST)
  - Retry logic with exponential backoff (default: 3 retries, 1000ms base delay)
  - Custom headers support for authentication
  - Parallel triggering to multiple endpoints using `Promise.allSettled`
  - `transformPayload` callback for customizing the payload per trigger
  - Default payload includes `items` array with webhook details

  **Example configuration:**

  ```typescript
  export const { config } = defineConfig({
    remote: {
      webhooks: {
        debounceMs: 5000,
        outbound: [
          {
            // Vercel just needs an empty POST body
            url: 'https://api.vercel.com/v1/integrations/deploy/...',
            transformPayload: () => ({}),
          },
          {
            // Simple GET ping (no body needed)
            url: 'https://my-cdn.example.com/purge',
            method: 'GET',
            transformPayload: () => ({}),
          },
          {
            // Custom payload for CI system
            url: 'https://my-ci.example.com/webhook',
            transformPayload: ({ items, timestamp }) => ({
              event: 'content-updated',
              changes: items.map((i) => i.body),
              timestamp,
            }),
          },
          {
            // No transform = uses default payload with items
            url: 'https://other.example.com/hook',
            headers: { Authorization: 'Bearer token' },
          },
        ],
      },
    },
  });
  ```

  **transformPayload context:**

  ```typescript
  type TransformPayloadContext = {
    batch: WebhookBatch; // Raw batch data
    event: 'batch-complete'; // Event type
    timestamp: string; // ISO 8601 timestamp
    source: string; // UDL instance ID
    summary: {
      webhookCount: number;
      plugins: string[];
    };
    items: Array<{
      // Individual webhook items
      pluginName: string;
      body: unknown;
      headers: Record<string, string | string[] | undefined>;
      timestamp: number;
    }>;
  };
  ```

  **Default outbound webhook payload:**

  ```json
  {
    "event": "batch-complete",
    "timestamp": "2024-01-15T10:30:00.000Z",
    "summary": {
      "webhookCount": 30,
      "plugins": ["@universal-data-layer/plugin-source-contentful"]
    },
    "source": "UDL",
    "items": [
      { "pluginName": "contentful", "body": { "operation": "upsert", ... } },
      ...
    ]
  }
  ```

  **Exports:**
  - `OutboundWebhookManager` - Class for managing outbound webhooks
  - `OutboundWebhookConfig` - Configuration type for outbound webhooks
  - `OutboundWebhookPayload` - Default payload type
  - `OutboundWebhookResult` - Result type for trigger operations
  - `TransformPayloadContext` - Context type for transformPayload function
  - `TransformPayload` - Type for the transform function
  - `WebhookItem` - Type for individual webhook item info

- [#70](https://github.com/dawidurbanski/universal-data-layer/pull/70) [`051192e`](https://github.com/dawidurbanski/universal-data-layer/commit/051192e17361e0cb9661ce86ee46f938d88b96b6) Thanks [@dawidurbanski](https://github.com/dawidurbanski)! - feat(core): add remote sync for syncing data from production UDL server

  Added `remote.url` config option that allows local UDL servers to sync data from a remote production UDL server instead of sourcing from plugins directly.

  When configured:
  - Fetches all nodes from remote `/_sync` endpoint on startup
  - Automatically connects to remote WebSocket for real-time updates (if enabled on remote)
  - Skips local plugin loading

  New exports:
  - `UDLWebSocketClient` - WebSocket client for connecting to remote UDL
  - `fetchRemoteNodes` - Fetch all nodes from remote server
  - `tryConnectRemoteWebSocket` - Connect to remote WebSocket
  - `initRemoteSync` - Initialize remote sync (fetch + WebSocket)

  Usage:

  ```typescript
  export const config = defineConfig({
    remote: {
      url: 'https://production-udl.example.com',
    },
  });
  ```

- [#70](https://github.com/dawidurbanski/universal-data-layer/pull/70) [`2e01999`](https://github.com/dawidurbanski/universal-data-layer/commit/2e0199904518814cd899385ec29dbf8b002cb06b) Thanks [@dawidurbanski](https://github.com/dawidurbanski)! - Add sync query API for partial updates

  This release introduces a `GET /_sync` endpoint that enables clients to fetch only the nodes that have changed since their last sync. This enables efficient incremental synchronization without requiring a full data refetch.

  **Features:**
  - `GET /_sync?since={timestamp}` endpoint for querying changes
  - Returns updated nodes and deleted node IDs since the given timestamp
  - Optional type filtering via `types` query parameter
  - Server timestamp included for use in subsequent sync calls
  - Integrates with DeletionLog for tracking deleted nodes

  **Response format:**

  ```typescript
  interface SyncResponse {
    updated: Node[]; // Nodes modified after timestamp
    deleted: DeletionLogEntry[]; // Nodes deleted after timestamp
    serverTime: string; // ISO 8601 timestamp for next sync
    hasMore: boolean; // Reserved for future pagination
  }
  ```

  **Example usage:**

  ```typescript
  // Initial sync - get all changes since epoch
  const response = await fetch(
    'http://localhost:4000/_sync?since=1970-01-01T00:00:00Z'
  );
  const { updated, deleted, serverTime } = await response.json();

  // Store serverTime for next sync
  localStorage.setItem('lastSync', serverTime);

  // Subsequent sync - get only recent changes
  const lastSync = localStorage.getItem('lastSync');
  const response = await fetch(`http://localhost:4000/_sync?since=${lastSync}`);
  ```

  **Type filtering:**

  ```
  GET /_sync?since=2024-01-01T00:00:00Z&types=Product,Collection
  ```

  Only returns changes for the specified node types.

- [#70](https://github.com/dawidurbanski/universal-data-layer/pull/70) [`0ea71da`](https://github.com/dawidurbanski/universal-data-layer/commit/0ea71da18234161ce8a09fdefcbae8731d7dba8c) Thanks [@dawidurbanski](https://github.com/dawidurbanski)! - # Add `updateStrategy` config option for sync-based source plugins

  Plugins can now specify how incremental updates from webhooks should be handled:
  - `'webhook'` (default): Process webhook payload directly via `registerWebhookHandler` or the default CRUD handler
  - `'sync'`: Treat webhooks as notifications only and re-run `sourceNodes` to fetch changes via the plugin's sync API

  This enables plugins with native sync APIs (like Contentful) to reuse their existing `sourceNodes` logic for incremental updates, eliminating the need to maintain separate webhook transformation code.

  ## Usage

  ```typescript
  // For sources with sync APIs (like Contentful)
  export const config = defineConfig({
    name: 'my-source-plugin',
    updateStrategy: 'sync',
  });
  ```

  When webhooks arrive for a plugin with `updateStrategy: 'sync'`:
  1. Webhooks are batched as usual (debounced)
  2. After the batch, `sourceNodes` is called once per affected plugin
  3. The plugin's delta sync fetches only changed data
  4. Cache is saved after sync completes

  The Contentful plugin now uses `updateStrategy: 'sync'` by default, leveraging the Contentful Sync API for efficient incremental updates.

- [#70](https://github.com/dawidurbanski/universal-data-layer/pull/70) [`5920046`](https://github.com/dawidurbanski/universal-data-layer/commit/59200465efa9600155f8047157a674303912d547) Thanks [@dawidurbanski](https://github.com/dawidurbanski)! - Add webhook queue with debouncing and lifecycle hooks

  This release introduces a webhook queue system that batches incoming webhooks and processes them after a configurable debounce period. This prevents N rapid webhook events (e.g., 30 Contentful entry publishes) from triggering N separate processing cycles.

  **Features:**
  - Webhook queue with configurable debounce period (`remote.webhooks.debounceMs`, default 5000ms)
  - Maximum queue size before forced processing (`remote.webhooks.maxQueueSize`, default 100)
  - Lifecycle hooks for custom processing:
    - `onWebhookReceived`: Transform or filter webhooks before queuing
    - `onBeforeWebhookTriggered`: Run before batch processing (e.g., invalidate CDN cache)
    - `onAfterWebhookTriggered`: Run after batch processing (e.g., trigger rebuild)
  - Graceful shutdown flushes pending webhooks
  - HTTP response changed from 200 to 202 Accepted (webhook is queued)

  **Example configuration:**

  ```typescript
  export const { config } = defineConfig({
    remote: {
      webhooks: {
        debounceMs: 5000,
        maxQueueSize: 100,
        hooks: {
          onWebhookReceived: async ({ webhook }) => {
            // Skip drafts
            if (!webhook.body?.sys?.publishedAt) return null;
            return webhook;
          },
          onBeforeWebhookTriggered: async ({ batch }) => {
            await invalidateCDNCache();
          },
          onAfterWebhookTriggered: async ({ batch }) => {
            await triggerRebuild();
          },
        },
      },
    },
  });
  ```

  **Breaking Changes:**
  - Webhook HTTP responses now return 202 Accepted instead of 200 OK
  - Webhooks are processed asynchronously after debounce period instead of immediately

- [#70](https://github.com/dawidurbanski/universal-data-layer/pull/70) [`2e01999`](https://github.com/dawidurbanski/universal-data-layer/commit/2e0199904518814cd899385ec29dbf8b002cb06b) Thanks [@dawidurbanski](https://github.com/dawidurbanski)! - Add WebSocket server for real-time node change notifications

  This release introduces an opt-in WebSocket server that broadcasts node changes to connected clients in real-time. This enables local development machines to receive updates immediately when webhooks modify the data layer, eliminating the need for polling.

  **Features:**
  - `UDLWebSocketServer` class for real-time node change broadcasts
  - Broadcasts `node:created`, `node:updated`, `node:deleted` events with full node data
  - Client subscription filtering by node type (or `*` for all types)
  - Heartbeat mechanism for connection health monitoring
  - Configurable via `remote.websockets` in UDL config
  - Support for separate WebSocket port or attachment to HTTP server
  - Pass-through options for advanced `ws` configuration

  **Configuration:**

  ```typescript
  export const { config } = defineConfig({
    remote: {
      websockets: {
        enabled: true,
        path: '/ws', // Default: '/ws'
        port: 4001, // Optional: separate port
        heartbeatIntervalMs: 30000, // Default: 30000
      },
    },
  });
  ```

  **Client usage:**

  ```typescript
  const ws = new WebSocket('ws://localhost:4000/ws');

  ws.onmessage = (event) => {
    const message = JSON.parse(event.data);
    if (message.type === 'node:created') {
      console.log('New node:', message.data);
    }
  };

  // Subscribe to specific types
  ws.send(
    JSON.stringify({ type: 'subscribe', data: ['Product', 'Collection'] })
  );
  ```

  **Message types:**
  - Server → Client: `node:created`, `node:updated`, `node:deleted`, `connected`, `subscribed`, `pong`
  - Client → Server: `subscribe`, `ping`

### Patch Changes

- [#70](https://github.com/dawidurbanski/universal-data-layer/pull/70) [`5ff7110`](https://github.com/dawidurbanski/universal-data-layer/commit/5ff7110e4e80e0c6d84d7924b078200e69d07949) Thanks [@dawidurbanski](https://github.com/dawidurbanski)! - Add UDL_ENDPOINT environment variable support to config

  The `getConfig()` function now checks for the `UDL_ENDPOINT` environment variable when config hasn't been explicitly initialized. This allows the `udl.query()` client to automatically use the correct endpoint in child processes.

  **Features:**
  - `UDL_ENDPOINT_ENV` constant for the environment variable name
  - `DEFAULT_UDL_PORT` constant (4000) for consistent default port
  - `isConfigInitialized()` to check if config was explicitly set
  - `resetConfig()` for testing isolation

  **How it works:**

  When `getConfig()` is called and no config was explicitly set via `createConfig()`, it checks for the `UDL_ENDPOINT` environment variable and uses that endpoint if present.

  This enables scenarios like:
  - Next.js adapter sets `UDL_ENDPOINT` when spawning Next.js
  - `udl.query()` in Next.js code automatically uses the right endpoint

- [#70](https://github.com/dawidurbanski/universal-data-layer/pull/70) [`6fe6408`](https://github.com/dawidurbanski/universal-data-layer/commit/6fe6408bca8f0924670c989318a3564b52257660) Thanks [@dawidurbanski](https://github.com/dawidurbanski)! - refactor: remove hardcoded default port values

  Removed hardcoded default port (4000) from CLI and adapter commands. The port is now only passed when explicitly specified by the user, allowing the config file to determine the default port value instead.

## 1.0.6

### Patch Changes

- [`4ea4d39`](https://github.com/dawidurbanski/universal-data-layer/commit/4ea4d39fecfe5304d6d830ed0d9fc20ea35fafdf) Thanks [@dawidurbanski](https://github.com/dawidurbanski)! - Fix `udl-codegen` CLI to work correctly when run standalone
  - Pass `cacheDir` to `loadPlugins()` so cached nodes are found in the app's `.udl-cache` directory instead of the plugin's node_modules
  - Use full plugin names instead of `basename()` for owner matching, fixing "No nodes found in store" errors
  - Only load manual test configs when running within the UDL monorepo development environment
  - Pass GraphQL schema to `runCodegen()` so extensions like `codegen-typed-queries` work correctly
  - Make reference resolver registration idempotent to prevent errors when plugins are loaded multiple times

## 1.0.5

### Patch Changes

- [`61e1ddd`](https://github.com/dawidurbanski/universal-data-layer/commit/61e1ddd3fc1b824435653f2abc137c43629b276c) Thanks [@dawidurbanski](https://github.com/dawidurbanski)! - Fix config loading errors when importing from universal-data-layer in udl.config.ts:
  - Add default export condition to package.json exports field (fixes ERR_PACKAGE_PATH_NOT_EXPORTED)
  - Remove top-level await from graphql handler using lazy initialization (fixes ERR_REQUIRE_ASYNC_MODULE)

## 1.0.4

### Patch Changes

- [`b8d64cf`](https://github.com/dawidurbanski/universal-data-layer/commit/b8d64cf2229cb460245321d56ba56e1a61ec0587) Thanks [@dawidurbanski](https://github.com/dawidurbanski)! - Fix ERR_PACKAGE_PATH_NOT_EXPORTED error when loading udl.config.ts by adding default export condition to package.json exports field

## 1.0.3

### Patch Changes

- [`245733b`](https://github.com/dawidurbanski/universal-data-layer/commit/245733b48669522c20a5fbc484b2f7a5f88b8eb0) Thanks [@dawidurbanski](https://github.com/dawidurbanski)! - Fix msw import error when running UDL in consuming projects

  Changed msw imports to be dynamic so the package is only loaded when mocks are actually needed. This prevents the "Cannot find package 'msw'" error when running `universal-data-layer` as a dependency, since msw is a devDependency and not installed in consuming projects.

## 1.0.2

### Patch Changes

- [`32b8769`](https://github.com/dawidurbanski/universal-data-layer/commit/32b8769e938db4cd9bba147e133ceb56b080ebb4) Thanks [@dawidurbanski](https://github.com/dawidurbanski)! - Fix manual-tests package dependency version

## 1.0.1

### Patch Changes

- [`5399e18`](https://github.com/dawidurbanski/universal-data-layer/commit/5399e18ec55e8f588159ee276ca8ce321218d210) Thanks [@dawidurbanski](https://github.com/dawidurbanski)! - Exclude test files from npm package distribution

## 1.0.0

### Minor Changes

- [#45](https://github.com/dawidurbanski/universal-data-layer/pull/45) [`6df6943`](https://github.com/dawidurbanski/universal-data-layer/commit/6df69438d06205b6f3e2cfc4a9a4c4a74efbf86c) Thanks [@dawidurbanski](https://github.com/dawidurbanski)! - ### New Package: `@universal-data-layer/codegen-typed-queries`

  Introduces a codegen extension that generates fully typed query functions from GraphQL files.

  **Features:**
  - Automatic TypedDocumentNode generation from `.graphql` files
  - Generates typed wrapper functions with proper input/output types
  - Supports configurable query file patterns and output locations
  - Integrates with the new codegen extension system
  - Comprehensive test coverage

  **Usage:**

  ```typescript
  // udl.config.ts
  import { defineConfig } from 'universal-data-layer';

  export const { config } = defineConfig({
    plugins: ['@universal-data-layer/plugin-source-contentful'],
    codegen: {
      output: './generated',
      extensions: ['@universal-data-layer/codegen-typed-queries'],
    },
  });
  ```

  ### Core Enhancements (`universal-data-layer`)

  **Codegen Extension System:**
  - New pluggable extension architecture for codegen pipeline
  - Extensions can hook into schema generation and add custom output
  - `CodegenExtension` interface for creating custom extensions
  - Extensions receive full schema context and can generate additional files

  **TypedDocumentNode Support:**
  - `query()` function now supports `TypedDocumentNode` for full type inference
  - Automatic input/output type inference from document types
  - Backwards compatible with string queries

  **Pluggable Reference System:**
  - New `ReferenceRegistry` for managing entity references
  - Configurable reference resolvers per content type
  - Supports custom ID extraction and type mapping
  - Field-level reference configuration via `FieldLinkMap`

  **Error Handling Improvements:**
  - `query()` now returns error tuples `[data, error]` instead of throwing
  - Graceful error handling with typed error responses
  - Better developer experience with predictable error patterns

  **Additional Changes:**
  - NVM environment setup in husky hooks for consistent Node.js versions
  - MSW integration for mocking API calls in development
  - Enhanced GraphQL handler with improved type safety

  ### Contentful Plugin Updates (`@universal-data-layer/plugin-source-contentful`)
  - Integration with the new pluggable reference system
  - `FieldLinkMap` support for configuring reference resolution
  - Improved reference handling for linked entries and assets

  ### Next.js Example
  - Complete Next.js 15 example application demonstrating UDL usage
  - Product listing and detail pages with typed queries
  - MSW mocks for local development without Contentful credentials
  - Image slider component with variant selection
  - Tailwind CSS styling

- [#41](https://github.com/dawidurbanski/universal-data-layer/pull/41) [`edb82e0`](https://github.com/dawidurbanski/universal-data-layer/commit/edb82e0b71a2939cd73e5781c4a20f6b8d61bb5d) Thanks [@dawidurbanski](https://github.com/dawidurbanski)! - Implement node creation and manipulation API
  - Add Node and NodeInternal type definitions
  - Implement NodeStore with Map-based storage
  - Add utility functions for content digest and node ID generation
  - Implement createNode function for node management
  - Implement deleteNode function for node removal
  - Add node query functions (getNode, getNodes, getNodesByType)
  - Implement extendNode function for node manipulation
  - Integrate node API with plugin system via sourceNodes hook
  - Add automatic GraphQL schema generation from nodes
  - Add comprehensive unit and integration tests
  - Add manual test feature with demo plugins

### Patch Changes

- [#40](https://github.com/dawidurbanski/universal-data-layer/pull/40) [`6a928ff`](https://github.com/dawidurbanski/universal-data-layer/commit/6a928ff5ec09162186c35f0d417c2768ccf21f1c) Thanks [@dawidurbanski](https://github.com/dawidurbanski)! - Manual testing setup integrated into current dev mode

- [#43](https://github.com/dawidurbanski/universal-data-layer/pull/43) [`e02b3e0`](https://github.com/dawidurbanski/universal-data-layer/commit/e02b3e0cee85bc48c946ce77d6d937dc8a43501d) Thanks [@dawidurbanski](https://github.com/dawidurbanski)! - ### New Contentful Source Plugin (`@universal-data-layer/plugin-source-contentful`)

  Introduces the first official source plugin for the Universal Data Layer, enabling seamless integration with Contentful CMS.

  **Features:**
  - Full Contentful Sync API support with incremental sync for efficient data updates
  - Automatic GraphQL schema generation from Contentful content types
  - Rich text field support with proper typing
  - Asset handling with optional local download capabilities
  - Reference resolution for linked entries and assets
  - Configurable locale support (default: `en-US`)
  - Content type filtering to include/exclude specific types
  - Multiple environment support (master, staging, etc.)
  - Preview API support for draft content
  - Pluggable sync token storage (file-based storage included by default)
  - Comprehensive error handling with typed errors (`ContentfulApiError`, `ContentfulSyncError`, etc.)

  **Configuration options:**
  - `spaceId` / `accessToken` - Contentful credentials
  - `host` - API host (defaults to CDN, can use preview API)
  - `environment` - Contentful environment
  - `nodePrefix` - Prefix for generated GraphQL types
  - `locale` - Locale for field value extraction
  - `downloadAssets` - Enable local asset caching (not implemented yet)
  - `contentTypeFilter` - Filter function for content types
  - `forceFullSync` - Force full re-sync ignoring stored tokens

  ### Core Enhancements (`universal-data-layer`)

  **File-based cache storage:**
  - New `FileCacheStorage` class for persisting node data to disk
  - Versioned cache format with automatic invalidation on version mismatch
  - Handles circular references safely during serialization

  **Environment variable loading:**
  - Automatic `.env` file loading with priority order support
  - Supports `.env.local`, `.env.{NODE_ENV}.local`, `.env.{NODE_ENV}`, and `.env`
  - Configurable override behavior for existing variables

  **Query utilities:**
  - `gql` tagged template literal for GraphQL queries
  - `query()` function with automatic `__typename` injection
  - Reference resolution with `resolveRefs` for denormalized responses
  - `addTypenameToDocument` utility for AST manipulation

  **Additional improvements:**
  - Enhanced GraphQL handler with improved normalization
  - New `resolveRefs` client utility for entity resolution
  - Comprehensive test coverage for query utilities and typename injection

- [#42](https://github.com/dawidurbanski/universal-data-layer/pull/42) [`e1ce532`](https://github.com/dawidurbanski/universal-data-layer/commit/e1ce532e8bd6d195b40376d364670260e093152f) Thanks [@dawidurbanski](https://github.com/dawidurbanski)! - Types and codegen features added.

## 0.1.0

### Minor Changes

- [#15](https://github.com/dawidurbanski/universal-data-layer/pull/15) [`3cd0ded`](https://github.com/dawidurbanski/universal-data-layer/commit/3cd0ded2d3a8517d49215a7e760c2f6a78de6ce6) Thanks [@dawidurbanski](https://github.com/dawidurbanski)! - feat: Add comprehensive release system with semantic versioning
  - Configure changesets for coordinated versioning and changelog generation
  - Set up conventional commits with commitlint for automated versioning
  - Add GitHub Actions CI/CD pipeline with matrix testing (Node 18.x, 20.x, 22.x)
  - Configure vitest with 90% coverage threshold
  - Add automated npm publishing on merge to main
  - Update documentation with release procedures
  - Configure Turbo pipeline for test and release tasks
  - Add test infrastructure to all packages
