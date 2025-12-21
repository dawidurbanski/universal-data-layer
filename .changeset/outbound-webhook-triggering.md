---
'universal-data-layer': minor
---

Add outbound webhook triggering after batch processing

This release adds the ability to trigger outbound webhooks after a batch of incoming webhooks has been processed. This enables the "30 webhooks → 1 build" optimization by notifying external systems (e.g., Vercel deploy hooks, CI systems) once after processing a batch rather than for each individual webhook.

**Features:**

- `OutboundWebhookManager` class for managing outbound webhook notifications
- Configurable outbound webhook endpoints via `remote.webhooks.trigger`
- Retry logic with exponential backoff (default: 3 retries, 1000ms base delay)
- Custom headers support for authentication
- Parallel triggering to multiple endpoints using `Promise.allSettled`
- Payload includes batch summary: webhook count, plugins, timestamp, source

**Example configuration:**

```typescript
export const { config } = defineConfig({
  remote: {
    webhooks: {
      debounceMs: 5000,
      trigger: [
        {
          url: 'https://api.vercel.com/v1/integrations/deploy/...',
          headers: { Authorization: 'Bearer token' },
          retries: 3,
          retryDelayMs: 1000,
        },
        {
          url: 'https://my-ci.example.com/webhook',
        },
      ],
    },
  },
});
```

**Outbound webhook payload:**

```json
{
  "event": "batch-complete",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "summary": {
    "webhookCount": 30,
    "plugins": ["@universal-data-layer/plugin-source-contentful"]
  },
  "source": "default"
}
```
