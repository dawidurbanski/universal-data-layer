---
'universal-data-layer': minor
'@universal-data-layer/plugin-source-contentful': patch
---

# Add `updateStrategy` config option for sync-based source plugins

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
