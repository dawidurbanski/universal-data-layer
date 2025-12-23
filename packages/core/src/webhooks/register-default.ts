/**
 * Default Webhook Registration Utility
 *
 * Automatically registers default webhook handlers for plugins.
 * Convention-based: every plugin gets /_webhooks/{plugin-name}/sync
 */

import type { WebhookRegistry } from './registry.js';
import type { PluginWebhookHandler, WebhookHandlerFn } from './types.js';
import {
  createDefaultWebhookHandler,
  DEFAULT_WEBHOOK_PATH,
} from './default-handler.js';

/**
 * Register a default webhook handler for a plugin.
 *
 * This function registers a standardized webhook handler at the
 * convention-based path: /_webhooks/{plugin-name}/sync
 *
 * Features:
 * - Zero configuration required
 * - Won't overwrite existing custom handlers
 * - Uses plugin's idField for node lookups if provided
 *
 * @param registry - The webhook registry to register with
 * @param pluginName - The plugin name to register for
 * @param pluginIdField - The plugin's configured idField (from plugin's udl.config)
 * @returns true if registered, false if skipped (handler already exists)
 *
 * @example
 * ```typescript
 * registerDefaultWebhook(registry, 'contentful', 'contentfulId');
 * // Registers: /_webhooks/contentful/sync
 * ```
 */
export function registerDefaultWebhook(
  registry: WebhookRegistry,
  pluginName: string,
  pluginIdField?: string
): boolean {
  // Check if handler already exists (don't overwrite custom handlers)
  if (registry.has(pluginName)) {
    console.log(
      `📌 Plugin ${pluginName} already has handler, skipping default registration`
    );
    return false;
  }

  // Register the default handler using the plugin's idField
  registry.register(pluginName, {
    handler: createDefaultWebhookHandler(
      pluginName,
      pluginIdField ? { idField: pluginIdField } : {}
    ),
    description: `Default UDL sync handler for ${pluginName}${pluginIdField ? ` (idField: ${pluginIdField})` : ''}`,
  });

  const lookupInfo = pluginIdField ? ` (idField: ${pluginIdField})` : '';
  console.log(
    `📬 Default webhook registered: /_webhooks/${pluginName}/${DEFAULT_WEBHOOK_PATH}${lookupInfo}`
  );
  return true;
}

/**
 * Register a custom plugin webhook handler.
 *
 * Wraps the plugin's `registerWebhookHandler` export and registers it
 * at the convention-based path: /_webhooks/{plugin-name}/sync
 *
 * @param registry - The webhook registry to register with
 * @param pluginName - The plugin name to register for
 * @param customHandler - The plugin's registerWebhookHandler export
 * @returns true (always registers, replaces default)
 *
 * @example
 * ```typescript
 * registerPluginWebhookHandler(registry, 'contentful', module.registerWebhookHandler);
 * // Registers: /_webhooks/contentful/sync with custom handler
 * ```
 */
export function registerPluginWebhookHandler(
  registry: WebhookRegistry,
  pluginName: string,
  customHandler: PluginWebhookHandler
): boolean {
  // Wrap the plugin's handler to match WebhookHandlerFn signature
  const wrappedHandler: WebhookHandlerFn = async (req, res, context) => {
    await customHandler({
      req,
      res,
      actions: context.actions,
      store: context.store,
      body: context.body,
      rawBody: context.rawBody,
    });
  };

  // Register the custom handler
  registry.register(pluginName, {
    handler: wrappedHandler,
    description: `Custom webhook handler for ${pluginName}`,
  });

  console.log(
    `📬 Custom webhook registered: /_webhooks/${pluginName}/${DEFAULT_WEBHOOK_PATH}`
  );
  return true;
}
