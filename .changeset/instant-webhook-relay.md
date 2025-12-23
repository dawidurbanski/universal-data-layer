---
'universal-data-layer': minor
---

Add instant webhook relay for remote sync

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
