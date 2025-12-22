---
'universal-data-layer': minor
---

Add WebSocket server for real-time node change notifications

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
ws.send(JSON.stringify({ type: 'subscribe', data: ['Product', 'Collection'] }));
```

**Message types:**

- Server → Client: `node:created`, `node:updated`, `node:deleted`, `connected`, `subscribed`, `pong`
- Client → Server: `subscribe`, `ping`
