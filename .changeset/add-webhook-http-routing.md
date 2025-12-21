---
'universal-data-layer': minor
---

Add webhook HTTP routing for incoming webhooks

Routes incoming webhook requests to the appropriate plugin handler based on the URL path `POST /_webhooks/{pluginName}/{path}`.

**Features:**

- Routes webhooks to correct handler based on plugin name and path
- Validates HTTP method (only POST allowed)
- Collects raw request body for signature verification
- Parses JSON body when content-type is `application/json`
- Provides `WebhookHandlerContext` with store, actions, rawBody, and body
- Enforces 1MB body size limit to prevent abuse
- Returns appropriate HTTP status codes (405, 404, 401, 400, 500)
- Logs webhook activity for debugging

**URL Format:**

```
POST /_webhooks/{plugin-name}/{webhook-path}

Examples:
POST /_webhooks/contentful/entry-update
POST /_webhooks/shopify/product-update
POST /_webhooks/custom-plugin/sync
```

**New exports:**

- `isWebhookRequest` - Check if URL is a webhook request
- `parseWebhookUrl` - Parse plugin name and path from URL
- `webhookHandler` - HTTP handler for webhook requests
- `WEBHOOK_PATH_PREFIX` - URL prefix constant (`/_webhooks/`)
