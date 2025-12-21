/**
 * Webhook Lifecycle Hooks
 *
 * Provides extension points for running custom logic at various stages
 * of webhook processing. Useful for:
 * - Transforming incoming webhook payloads
 * - Invalidating CMS/CDN caches before processing
 * - Triggering rebuilds after batch processing
 */

import type { NodeStore } from '@/nodes/store.js';
import type { QueuedWebhook, WebhookBatch } from './queue.js';

/**
 * Context passed to the onWebhookReceived hook.
 */
export interface WebhookReceivedContext {
  /** The incoming webhook data */
  webhook: QueuedWebhook;
  /** Access to the node store */
  store: NodeStore;
}

/**
 * Context passed to batch lifecycle hooks.
 */
export interface WebhookBatchContext {
  /** The batch of webhooks being processed */
  batch: WebhookBatch;
  /** Access to the node store */
  store: NodeStore;
}

/**
 * Called when a webhook is received, before it's added to the queue.
 * Can transform the webhook data or return null to skip processing.
 *
 * @example
 * ```typescript
 * onWebhookReceived: async ({ webhook }) => {
 *   // Skip draft content
 *   if (!webhook.body?.sys?.publishedAt) {
 *     return null;
 *   }
 *   // Transform the webhook
 *   return {
 *     ...webhook,
 *     body: normalizePayload(webhook.body),
 *   };
 * }
 * ```
 */
export type OnWebhookReceivedFn = (
  context: WebhookReceivedContext
) => QueuedWebhook | null | Promise<QueuedWebhook | null>;

/**
 * Called before the debounced batch processing begins.
 * Useful for cache invalidation, pre-processing, etc.
 *
 * @example
 * ```typescript
 * onBeforeWebhookTriggered: async ({ batch }) => {
 *   // Invalidate CDN cache before processing
 *   await fetch('https://cdn.example.com/purge', {
 *     method: 'POST',
 *     body: JSON.stringify({ paths: extractPaths(batch) }),
 *   });
 * }
 * ```
 */
export type OnBeforeWebhookTriggeredFn = (
  context: WebhookBatchContext
) => void | Promise<void>;

/**
 * Called after batch processing completes successfully.
 * Useful for triggering rebuilds, sending notifications, etc.
 *
 * @example
 * ```typescript
 * onAfterWebhookTriggered: async ({ batch }) => {
 *   // Trigger a rebuild
 *   await fetch('https://build.example.com/trigger', {
 *     method: 'POST',
 *   });
 * }
 * ```
 */
export type OnAfterWebhookTriggeredFn = (
  context: WebhookBatchContext
) => void | Promise<void>;

/**
 * Configuration for webhook lifecycle hooks.
 *
 * @example
 * ```typescript
 * // In udl.config.ts
 * export const { config } = defineConfig({
 *   remote: {
 *     webhooks: {
 *       debounceMs: 5000,
 *       hooks: {
 *         onWebhookReceived: async ({ webhook }) => {
 *           // Skip drafts
 *           if (!webhook.body?.published) return null;
 *           return webhook;
 *         },
 *         onBeforeWebhookTriggered: async ({ batch }) => {
 *           console.log(`Processing ${batch.webhooks.length} webhooks...`);
 *           await invalidateCache();
 *         },
 *         onAfterWebhookTriggered: async ({ batch }) => {
 *           await triggerRebuild();
 *         },
 *       },
 *     },
 *   },
 * });
 * ```
 */
export interface WebhookHooksConfig {
  /**
   * Called when each webhook is received, before queuing.
   * Return transformed webhook, or null to skip this webhook entirely.
   * Useful for normalizing webhook shapes from different sources.
   */
  onWebhookReceived?: OnWebhookReceivedFn;

  /**
   * Called before batch processing starts (after debounce period).
   * Use for cache invalidation, pre-processing, etc.
   */
  onBeforeWebhookTriggered?: OnBeforeWebhookTriggeredFn;

  /**
   * Called after batch processing completes successfully.
   * Use for triggering rebuilds, notifications, etc.
   */
  onAfterWebhookTriggered?: OnAfterWebhookTriggeredFn;
}

/**
 * Default webhook hooks (no-op).
 */
let webhookHooks: WebhookHooksConfig = {};

/**
 * Get the current webhook hooks configuration.
 */
export function getWebhookHooks(): WebhookHooksConfig {
  return webhookHooks;
}

/**
 * Set the webhook hooks configuration.
 * Called during server startup with hooks from config.
 *
 * @param hooks - The hooks configuration to use
 */
export function setWebhookHooks(hooks: WebhookHooksConfig): void {
  webhookHooks = hooks;
}

/**
 * Reset webhook hooks to defaults.
 * Useful for testing.
 */
export function resetWebhookHooks(): void {
  webhookHooks = {};
}
