/**
 * Webhook Registry
 *
 * Central registry for webhook handlers from all plugins.
 * Stores registered webhooks and provides lookup for routing
 * incoming webhook requests to the appropriate handler.
 */

import type { WebhookRegistration, WebhookHandler } from './types.js';

/**
 * Regular expression for validating webhook paths.
 * Paths must:
 * - Not start with a slash
 * - Contain only alphanumeric characters, hyphens, and underscores
 * - Not be empty
 */
const PATH_REGEX = /^[a-zA-Z0-9][a-zA-Z0-9_-]*$/;

/**
 * Error thrown when webhook registration fails validation.
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
 * Plugins register their webhook handlers and the registry
 * provides lookup for routing incoming requests.
 *
 * @example
 * ```typescript
 * const registry = new WebhookRegistry();
 *
 * // Register a webhook
 * registry.register('my-plugin', {
 *   path: 'entry-update',
 *   handler: async (req, res, context) => { ... },
 * });
 *
 * // Look up a handler
 * const handler = registry.getHandler('my-plugin', 'entry-update');
 * ```
 */
export class WebhookRegistry {
  private handlers: Map<string, WebhookHandler> = new Map();

  /**
   * Generate the map key for a webhook handler.
   * @param pluginName - The plugin that registered the webhook
   * @param path - The webhook path
   * @returns The map key in format "pluginName/path"
   */
  private getKey(pluginName: string, path: string): string {
    return `${pluginName}/${path}`;
  }

  /**
   * Validate a webhook path.
   * @param path - The path to validate
   * @throws {WebhookRegistrationError} If the path is invalid
   */
  private validatePath(path: string): void {
    if (!path) {
      throw new WebhookRegistrationError('Webhook path cannot be empty');
    }

    if (path.startsWith('/')) {
      throw new WebhookRegistrationError(
        `Webhook path cannot start with '/': ${path}`
      );
    }

    if (!PATH_REGEX.test(path)) {
      throw new WebhookRegistrationError(
        `Webhook path contains invalid characters: ${path}. ` +
          'Path must contain only alphanumeric characters, hyphens, and underscores, ' +
          'and must start with an alphanumeric character.'
      );
    }
  }

  /**
   * Register a webhook handler for a plugin.
   *
   * @param pluginName - The name of the plugin registering the webhook
   * @param webhook - The webhook registration configuration
   * @throws {WebhookRegistrationError} If the path is invalid or already registered
   *
   * @example
   * ```typescript
   * registry.register('@my-org/plugin-source-cms', {
   *   path: 'content-update',
   *   handler: async (req, res, context) => {
   *     // Handle webhook
   *   },
   *   verifySignature: (req, body) => verifyHmac(body, req.headers['x-signature']),
   *   description: 'Handles content update events',
   * });
   * ```
   */
  register(pluginName: string, webhook: WebhookRegistration): void {
    this.validatePath(webhook.path);

    const key = this.getKey(pluginName, webhook.path);

    if (this.handlers.has(key)) {
      throw new WebhookRegistrationError(
        `Webhook path '${webhook.path}' is already registered for plugin '${pluginName}'`
      );
    }

    const handler: WebhookHandler = {
      ...webhook,
      pluginName,
    };

    this.handlers.set(key, handler);
  }

  /**
   * Get a webhook handler by plugin name and path.
   *
   * @param pluginName - The plugin that registered the webhook
   * @param path - The webhook path
   * @returns The webhook handler, or undefined if not found
   *
   * @example
   * ```typescript
   * const handler = registry.getHandler('my-plugin', 'entry-update');
   * if (handler) {
   *   await handler.handler(req, res, context);
   * }
   * ```
   */
  getHandler(pluginName: string, path: string): WebhookHandler | undefined {
    const key = this.getKey(pluginName, path);
    return this.handlers.get(key);
  }

  /**
   * Check if a webhook handler exists.
   *
   * @param pluginName - The plugin name
   * @param path - The webhook path
   * @returns True if the handler exists
   */
  has(pluginName: string, path: string): boolean {
    const key = this.getKey(pluginName, path);
    return this.handlers.has(key);
  }

  /**
   * Get all registered webhook handlers.
   *
   * @returns Array of all registered webhook handlers
   *
   * @example
   * ```typescript
   * const allHandlers = registry.getAllHandlers();
   * console.log(`${allHandlers.length} webhooks registered`);
   * ```
   */
  getAllHandlers(): WebhookHandler[] {
    return Array.from(this.handlers.values());
  }

  /**
   * Get all webhook handlers registered by a specific plugin.
   *
   * @param pluginName - The plugin name to filter by
   * @returns Array of webhook handlers for the specified plugin
   *
   * @example
   * ```typescript
   * const contentfulWebhooks = registry.getHandlersByPlugin(
   *   '@universal-data-layer/plugin-source-contentful'
   * );
   * ```
   */
  getHandlersByPlugin(pluginName: string): WebhookHandler[] {
    return Array.from(this.handlers.values()).filter(
      (handler) => handler.pluginName === pluginName
    );
  }

  /**
   * Remove a webhook handler.
   *
   * @param pluginName - The plugin name
   * @param path - The webhook path
   * @returns True if a handler was removed, false if it didn't exist
   */
  unregister(pluginName: string, path: string): boolean {
    const key = this.getKey(pluginName, path);
    return this.handlers.delete(key);
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
