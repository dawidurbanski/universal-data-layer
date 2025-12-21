---
'universal-data-layer': minor
---

Add webhook queue with debouncing and lifecycle hooks

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
