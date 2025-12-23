/**
 * Plugin Registry
 *
 * Stores plugin information including sourceNodes functions and their context.
 * Used by the webhook processor to re-invoke sourceNodes for plugins with
 * updateStrategy: 'sync'.
 */

import type { NodeStore } from '@/nodes/store.js';
import type { SourceNodesContext } from '@/nodes/index.js';
import type { UpdateStrategy } from '@/loader.js';

/**
 * Function signature for a plugin's sourceNodes export.
 * Uses a generic to match the UDLConfigFile.sourceNodes signature.
 */
export type SourceNodesFn = <T = Record<string, unknown>>(
  context?: SourceNodesContext<T>
) => void | Promise<void>;

/**
 * Information about a registered plugin needed for re-invoking sourceNodes.
 */
export interface RegisteredPlugin {
  /** The plugin name */
  name: string;
  /** The plugin's sourceNodes function (if it has one) */
  sourceNodes: SourceNodesFn | undefined;
  /** The update strategy for handling webhooks */
  updateStrategy: UpdateStrategy;
  /** The context to pass when re-invoking sourceNodes */
  sourceNodesContext: Omit<SourceNodesContext<unknown>, 'actions'> | undefined;
  /** The node store to use for creating actions */
  store: NodeStore | undefined;
}

/**
 * Registry for storing plugin information.
 * Singleton pattern - use defaultPluginRegistry for most cases.
 */
export class PluginRegistry {
  private plugins = new Map<string, RegisteredPlugin>();

  /**
   * Register a plugin with its sourceNodes function and context.
   */
  register(plugin: RegisteredPlugin): void {
    this.plugins.set(plugin.name, plugin);
  }

  /**
   * Get a registered plugin by name.
   */
  get(pluginName: string): RegisteredPlugin | undefined {
    return this.plugins.get(pluginName);
  }

  /**
   * Check if a plugin is registered.
   */
  has(pluginName: string): boolean {
    return this.plugins.has(pluginName);
  }

  /**
   * Get all registered plugins.
   */
  getAll(): RegisteredPlugin[] {
    return Array.from(this.plugins.values());
  }

  /**
   * Get all plugins with a specific update strategy.
   */
  getByStrategy(strategy: UpdateStrategy): RegisteredPlugin[] {
    return this.getAll().filter((p) => p.updateStrategy === strategy);
  }

  /**
   * Clear all registered plugins (primarily for testing).
   */
  clear(): void {
    this.plugins.clear();
  }
}

/** Default singleton plugin registry */
export const defaultPluginRegistry = new PluginRegistry();
