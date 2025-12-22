---
'universal-data-layer': minor
---

Add default webhook handler for standardized CRUD operations

This release introduces a default webhook handler that provides a standardized way to create, update, and delete nodes via webhooks. This eliminates the need for plugins to implement their own webhook handlers for basic CRUD operations.

**Features:**

- Automatic registration of `/sync` webhook endpoint for each loaded plugin
- Standardized payload format for `create`, `update`, `delete`, and `upsert` operations
- Support for custom `idField` to look up nodes by external identifiers
- Configurable per-plugin path overrides or disabling
- Integration with plugin loading for automatic setup

**Configuration:**

```typescript
export const { config } = defineConfig({
  defaultWebhook: {
    enabled: true,
    path: 'sync', // Default endpoint path
    plugins: {
      // Customize path for specific plugin
      contentful: { path: 'content-sync' },
      // Disable for a specific plugin
      'legacy-plugin': false,
    },
  },
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

When a plugin specifies an `idField` in its config, the default webhook handler can look up existing nodes by that field:

```typescript
// Plugin config
export const config = defineConfig({
  idField: 'externalId', // Webhook will look up nodes by this field
});
```
