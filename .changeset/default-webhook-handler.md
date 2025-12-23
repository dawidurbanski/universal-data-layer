---
'universal-data-layer': minor
---

Add default webhook handler for standardized CRUD operations

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
