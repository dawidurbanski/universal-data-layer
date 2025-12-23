---
'universal-data-layer': minor
---

Add webhook HTTP routing with convention-based URL pattern

Routes incoming webhook requests to the appropriate plugin handler using a fixed URL pattern `POST /_webhooks/{pluginName}/sync`.

**Features:**

- Convention-based routing: all webhooks use the `/sync` path
- Routes webhooks to correct handler based on plugin name
- Validates HTTP method (only POST allowed)
- Collects raw request body for handler processing
- Parses JSON body when content-type is `application/json`
- Provides `WebhookHandlerContext` with store, actions, rawBody, and body
- Enforces 1MB body size limit to prevent abuse
- Returns appropriate HTTP status codes (405, 404, 400, 413)
- Queues webhooks for batch processing with debounce

**URL Format:**

```
POST /_webhooks/{plugin-name}/sync

Examples:
POST /_webhooks/contentful/sync
POST /_webhooks/shopify/sync
POST /_webhooks/my-plugin/sync
```

**Exports:**

- `isWebhookRequest` - Check if URL is a webhook request
- `getPluginFromWebhookUrl` - Extract plugin name from webhook URL
- `webhookHandler` - HTTP handler for webhook requests
- `WEBHOOK_PATH_PREFIX` - URL prefix constant (`/_webhooks/`)
