---
'universal-data-layer': minor
---

feat(core): add remote sync for syncing data from production UDL server

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
