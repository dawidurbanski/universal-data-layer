---
'universal-data-layer': minor
---

Add plugin webhook registration API

Extends `SourceNodesContext` with `registerWebhook` function, allowing plugins to register webhook handlers that will receive and process incoming webhook payloads from external data sources.

**Usage in plugins:**

```typescript
export async function sourceNodes({ actions, registerWebhook }) {
  // Source initial data...

  registerWebhook({
    path: 'entry-update',
    handler: async (req, res, context) => {
      const { body, actions } = context;
      await actions.createNode(transformEntry(body), { ... });
      res.writeHead(200);
      res.end();
    },
    verifySignature: (req, body) => {
      return verifyHmac(body, req.headers['x-signature'], secret);
    },
  });
}
```

**New exports:**

- `WebhookRegistry` - Central registry for webhook handlers
- `WebhookRegistrationError` - Error thrown on invalid registration
- `defaultWebhookRegistry` - Default singleton instance
- `WebhookRegistration`, `WebhookHandler`, `WebhookHandlerFn`, `WebhookHandlerContext` types
