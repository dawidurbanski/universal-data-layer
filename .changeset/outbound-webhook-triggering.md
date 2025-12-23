---
'universal-data-layer': minor
---

Add outbound webhook triggering with transformPayload support

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
