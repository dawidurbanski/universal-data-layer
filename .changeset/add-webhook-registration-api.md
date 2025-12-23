---
'universal-data-layer': minor
---

Add plugin webhook handler export API

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
