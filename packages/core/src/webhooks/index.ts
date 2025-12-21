/**
 * Webhook system for plugin webhook registration.
 *
 * This module provides the infrastructure for plugins to register webhook
 * handlers that receive and process incoming webhook payloads from external
 * data sources like Contentful, Shopify, etc.
 */

// Types
export type {
  WebhookRegistration,
  WebhookHandlerFn,
  WebhookHandlerContext,
  WebhookHandler,
} from './types.js';

// Registry
export {
  WebhookRegistry,
  WebhookRegistrationError,
  defaultWebhookRegistry,
  setDefaultWebhookRegistry,
} from './registry.js';
