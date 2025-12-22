/**
 * Default Webhook Registration Utility
 *
 * Provides functions to automatically register default webhook handlers
 * for plugins based on configuration.
 */

import type { WebhookRegistry } from './registry.js';
import type { DefaultWebhookHandlerConfig } from './types.js';
import {
  createDefaultWebhookHandler,
  DEFAULT_WEBHOOK_PATH,
} from './default-handler.js';

/**
 * Register a default webhook handler for a plugin if enabled in configuration.
 *
 * This function checks the `defaultWebhook` configuration and registers
 * a standardized webhook handler for the specified plugin. It respects:
 * - Global enable/disable setting
 * - Per-plugin enable/disable setting
 * - Custom paths (global and per-plugin)
 * - Existing custom handlers (won't overwrite)
 * - Plugin's idField for node lookups
 *
 * @param registry - The webhook registry to register with
 * @param pluginName - The plugin name to register for
 * @param config - The default webhook configuration
 * @param pluginIdField - The plugin's configured idField (from plugin's udl.config)
 * @returns The path that was registered, or null if not registered
 *
 * @example
 * ```typescript
 * const path = registerDefaultWebhook(registry, 'contentful', {
 *   enabled: true,
 *   path: 'sync',
 * }, 'contentfulId');
 * // path = 'sync' if registered, null if skipped
 * ```
 */
export function registerDefaultWebhook(
  registry: WebhookRegistry,
  pluginName: string,
  config: DefaultWebhookHandlerConfig | undefined,
  pluginIdField?: string
): string | null {
  // If config is not present, default handlers are disabled
  if (!config) {
    return null;
  }

  // Check if explicitly disabled globally
  if (config.enabled === false) {
    return null;
  }

  // Check per-plugin configuration
  const pluginConfig = config.plugins?.[pluginName];

  // If plugin is explicitly disabled
  if (pluginConfig === false) {
    console.log(`📭 Default webhook disabled for plugin: ${pluginName}`);
    return null;
  }

  // Determine the path to use
  const globalPath = config.path ?? DEFAULT_WEBHOOK_PATH;
  const path =
    typeof pluginConfig === 'object' && pluginConfig.path
      ? pluginConfig.path
      : globalPath;

  // Check if handler already exists for this path (don't overwrite custom handlers)
  if (registry.has(pluginName, path)) {
    console.log(
      `📌 Plugin ${pluginName} already has handler for '${path}', skipping default registration`
    );
    return null;
  }

  // Register the default handler using the plugin's idField
  registry.register(pluginName, {
    path,
    handler: createDefaultWebhookHandler(
      pluginName,
      pluginIdField ? { idField: pluginIdField } : {}
    ),
    description: `Default UDL sync handler for ${pluginName}${pluginIdField ? ` (idField: ${pluginIdField})` : ''}`,
  });

  const lookupInfo = pluginIdField ? ` (idField: ${pluginIdField})` : '';
  console.log(
    `📬 Default webhook registered: /_webhooks/${pluginName}/${path}${lookupInfo}`
  );
  return path;
}

/**
 * Register default webhooks for multiple plugins.
 *
 * Convenience function to register default handlers for all plugins
 * in a single call.
 *
 * @param registry - The webhook registry to register with
 * @param pluginNames - Array of plugin names to register
 * @param config - The default webhook configuration
 * @returns Map of plugin name to registered path (or null if not registered)
 *
 * @example
 * ```typescript
 * const results = registerDefaultWebhooks(
 *   registry,
 *   ['contentful', 'shopify', 'custom-plugin'],
 *   { enabled: true }
 * );
 * // results: Map { 'contentful' => 'sync', 'shopify' => 'sync', ... }
 * ```
 */
export function registerDefaultWebhooks(
  registry: WebhookRegistry,
  pluginNames: string[],
  config: DefaultWebhookHandlerConfig | undefined
): Map<string, string | null> {
  const results = new Map<string, string | null>();

  for (const pluginName of pluginNames) {
    const path = registerDefaultWebhook(registry, pluginName, config);
    results.set(pluginName, path);
  }

  return results;
}
