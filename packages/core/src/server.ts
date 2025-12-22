import { createServer } from 'node:http';
import staticHandler from '@/handlers/static.js';
import graphqlHandler from '@/handlers/graphql.js';
import graphiqlHandler from '@/handlers/graphiql.js';
import { healthHandler, readyHandler } from '@/handlers/health.js';
import { isWebhookRequest, webhookHandler } from '@/handlers/webhook.js';
import { syncHandler } from '@/handlers/sync.js';

const server = createServer((req, res) => {
  // Add CORS headers for all requests
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Health check endpoints (no auth required)
  if (req.url === '/health') {
    return healthHandler(req, res);
  } else if (req.url === '/ready') {
    return readyHandler(req, res);
  }

  // Sync endpoint for partial updates
  if (req.url?.startsWith('/_sync')) {
    return syncHandler(req, res);
  }

  // Webhook endpoints
  if (req.url && isWebhookRequest(req.url)) {
    return webhookHandler(req, res);
  }

  if (req.url === '/graphql') {
    return graphqlHandler(req, res);
  } else if (req.url === '/graphiql') {
    return graphiqlHandler(res);
  }

  return staticHandler(req, res);
});

export default server;
