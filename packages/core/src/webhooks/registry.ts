/**
 * Webhook Registry
 *
 * Central registry for webhook handlers from all plugins.
 * Each plugin has exactly one webhook handler at /_webhooks/{plugin-name}/sync.
 */

import type { WebhookRegistration, WebhookHandler } from './types.js';

/**
 * Error thrown when webhook registration fails.
 */
export class WebhookRegistrationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WebhookRegistrationError';
  }
}

/**
 * Central registry for webhook handlers.
 *
 * Plugins register their webhook handler and the registry
 * provides lookup for routing incoming requests. Each plugin
 * can only have one handler (at the convention-based path /sync).
 *
 * @example
 * ```typescript
 * const registry = new WebhookRegistry();
 *
 * // Register a webhook handler
 * registry.register('my-plugin', {
 *   handler: async (req, res, context) => { ... },
 *   description: 'My plugin handler',
 * });
 *
 * // Look up a handler
 * const handler = registry.getHandler('my-plugin');
 * ```
 */
export class WebhookRegistry {
  private handlers: Map<string, WebhookHandler> = new Map();

  /**
   * Register a webhook handler for a plugin.
   *
   * @param pluginName - The name of the plugin registering the webhook
   * @param webhook - The webhook registration configuration
   * @throws {WebhookRegistrationError} If a handler is already registered for this plugin
   *
   * @example
   * ```typescript
   * registry.register('my-plugin', {
   *   handler: async (req, res, context) => {
   *     // Handle webhook
   *   },
   *   description: 'Handles webhook events',
   * });
   * ```
   */
  register(pluginName: string, webhook: WebhookRegistration): void {
    if (this.handlers.has(pluginName)) {
      throw new WebhookRegistrationError(
        `Webhook handler is already registered for plugin '${pluginName}'`
      );
    }

    const handler: WebhookHandler = {
      ...webhook,
      pluginName,
    };

    this.handlers.set(pluginName, handler);
  }

  /**
   * Get a webhook handler by plugin name.
   *
   * @param pluginName - The plugin that registered the webhook
   * @returns The webhook handler, or undefined if not found
   *
   * @example
   * ```typescript
   * const handler = registry.getHandler('my-plugin');
   * if (handler) {
   *   await handler.handler(req, res, context);
   * }
   * ```
   */
  getHandler(pluginName: string): WebhookHandler | undefined {
    return this.handlers.get(pluginName);
  }

  /**
   * Check if a webhook handler exists for a plugin.
   *
   * @param pluginName - The plugin name
   * @returns True if the handler exists
   */
  has(pluginName: string): boolean {
    return this.handlers.has(pluginName);
  }

  /**
   * Get all registered webhook handlers.
   *
   * @returns Array of all registered webhook handlers
   *
   * @example
   * ```typescript
   * const allHandlers = registry.getAllHandlers();
   * console.log(`${allHandlers.length} webhook handlers registered`);
   * ```
   */
  getAllHandlers(): WebhookHandler[] {
    return Array.from(this.handlers.values());
  }

  /**
   * Remove a webhook handler.
   *
   * @param pluginName - The plugin name
   * @returns True if a handler was removed, false if it didn't exist
   */
  unregister(pluginName: string): boolean {
    return this.handlers.delete(pluginName);
  }

  /**
   * Clear all registered webhook handlers.
   * Useful for testing to ensure isolation between test runs.
   *
   * @example
   * ```typescript
   * beforeEach(() => {
   *   webhookRegistry.clear();
   * });
   * ```
   */
  clear(): void {
    this.handlers.clear();
  }

  /**
   * Get the number of registered webhook handlers.
   *
   * @returns The count of registered handlers
   */
  size(): number {
    return this.handlers.size;
  }
}

/**
 * Default singleton webhook registry instance.
 *
 * This is automatically created on first import and persists across the application.
 * All plugins using the default behavior will share this registry.
 *
 * @example
 * ```typescript
 * import { defaultWebhookRegistry } from 'universal-data-layer';
 *
 * // Check registered webhooks
 * const handlers = defaultWebhookRegistry.getAllHandlers();
 * console.log(`${handlers.length} webhook handlers registered`);
 * ```
 */
export let defaultWebhookRegistry: WebhookRegistry = new WebhookRegistry();

/**
 * Replace the default webhook registry with a new instance.
 * Useful for testing to ensure isolation between test runs.
 *
 * @param registry - The new registry to use as the default
 *
 * @example
 * ```typescript
 * import { setDefaultWebhookRegistry, WebhookRegistry } from 'universal-data-layer';
 *
 * beforeEach(() => {
 *   setDefaultWebhookRegistry(new WebhookRegistry());
 * });
 * ```
 */
export function setDefaultWebhookRegistry(registry: WebhookRegistry): void {
  defaultWebhookRegistry = registry;
}
