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
  DefaultWebhookPayload,
  DefaultWebhookHandlerConfig,
  PluginDefaultWebhookConfig,
} from './types.js';

// Registry
export {
  WebhookRegistry,
  WebhookRegistrationError,
  defaultWebhookRegistry,
  setDefaultWebhookRegistry,
} from './registry.js';

// Queue
export type {
  QueuedWebhook,
  WebhookBatch,
  WebhookQueueConfig,
  WebhookQueueEvents,
  BatchProcessorFn,
} from './queue.js';

export {
  WebhookQueue,
  defaultWebhookQueue,
  setDefaultWebhookQueue,
} from './queue.js';

// Hooks
export type {
  WebhookReceivedContext,
  WebhookBatchContext,
  OnWebhookReceivedFn,
  OnBeforeWebhookTriggeredFn,
  OnAfterWebhookTriggeredFn,
  WebhookHooksConfig,
} from './hooks.js';

export {
  getWebhookHooks,
  setWebhookHooks,
  resetWebhookHooks,
} from './hooks.js';

// Processor
export {
  initializeWebhookProcessor,
  processWebhookBatch,
} from './processor.js';

// Outbound
export type {
  OutboundWebhookConfig,
  OutboundWebhookPayload,
  OutboundWebhookResult,
} from './outbound.js';

export { OutboundWebhookManager } from './outbound.js';

// Default Handler
export type { DefaultWebhookHandlerOptions } from './default-handler.js';
export {
  createDefaultWebhookHandler,
  DEFAULT_WEBHOOK_PATH,
} from './default-handler.js';

export {
  registerDefaultWebhook,
  registerDefaultWebhooks,
} from './register-default.js';
