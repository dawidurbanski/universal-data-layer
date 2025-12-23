/**
 * Cache Manager for coordinating plugin cache updates.
 *
 * Provides a central point for webhook handlers and remote sync to update
 * plugin caches after store changes.
 */

import type { CacheStorage, CachedData } from './types.js';
import { FileCacheStorage } from './file-cache.js';
import type { NodeStore } from '../nodes/store.js';

/**
 * Entry for a registered plugin cache.
 */
interface PluginCacheEntry {
  pluginName: string;
  cache: CacheStorage;
}

// Module-level state
const pluginCaches = new Map<string, PluginCacheEntry>();
let store: NodeStore | null = null;

/**
 * Set the node store reference.
 * This allows cache operations to access the current store state.
 */
export function setStore(nodeStore: NodeStore): void {
  store = nodeStore;
}

/**
 * Get the node store reference.
 */
export function getStore(): NodeStore | null {
  return store;
}

/**
 * Register a plugin's cache storage.
 * Called during plugin loading to associate a plugin with its cache.
 *
 * @param pluginName - The plugin name (e.g., '@universal-data-layer/plugin-source-contentful')
 * @param cache - The cache storage instance for this plugin
 */
export function registerPluginCache(
  pluginName: string,
  cache: CacheStorage
): void {
  pluginCaches.set(pluginName, {
    pluginName,
    cache,
  });
  console.log(`📦 [CacheManager] Registered cache for plugin: ${pluginName}`);
}

/**
 * Initialize and register a plugin's cache storage.
 * This is the preferred way to set up plugin caching - it handles both
 * custom CacheStorage implementations and the default FileCacheStorage.
 *
 * @param pluginName - The plugin name
 * @param cacheLocation - Directory for cache files (used by FileCacheStorage)
 * @param customCache - Optional custom CacheStorage from plugin config
 * @returns The cache storage instance
 *
 * @example
 * ```typescript
 * // Use default FileCacheStorage
 * const cache = initPluginCache('my-plugin', '/path/to/cache');
 *
 * // Use custom cache from plugin config
 * const cache = initPluginCache('my-plugin', '/path/to/cache', pluginConfig.cache);
 * ```
 */
export function initPluginCache(
  pluginName: string,
  cacheLocation: string,
  customCache?: CacheStorage
): CacheStorage {
  const cache = customCache ?? new FileCacheStorage(cacheLocation);
  registerPluginCache(pluginName, cache);
  return cache;
}

/**
 * Check if a plugin has a registered cache.
 */
export function hasPluginCache(pluginName: string): boolean {
  return pluginCaches.has(pluginName);
}

/**
 * Get a plugin's cache storage.
 */
export function getPluginCache(pluginName: string): CacheStorage | undefined {
  return pluginCaches.get(pluginName)?.cache;
}

/**
 * Get all registered plugin names.
 */
export function getRegisteredPlugins(): string[] {
  return Array.from(pluginCaches.keys());
}

/**
 * Save a specific plugin's cache from the current store state.
 * Only saves nodes owned by the specified plugin.
 *
 * @param pluginName - The plugin name to save cache for
 * @param nodeStore - The node store to read from (optional, uses registered store if not provided)
 */
export async function savePluginCache(
  pluginName: string,
  nodeStore?: NodeStore
): Promise<boolean> {
  const effectiveStore = nodeStore ?? store;
  if (!effectiveStore) {
    console.warn(
      `⚠️ [CacheManager] No store available for saving plugin cache: ${pluginName}`
    );
    return false;
  }

  const entry = pluginCaches.get(pluginName);
  if (!entry) {
    // Plugin has no registered cache (caching may be disabled)
    return false;
  }

  // Get only nodes owned by this plugin
  const allNodes = effectiveStore.getAll();
  const pluginNodes = allNodes.filter(
    (node) => node.internal.owner === pluginName
  );

  // Get indexes for node types owned by this plugin
  const pluginNodeTypes = new Set(pluginNodes.map((n) => n.internal.type));
  const indexes: Record<string, string[]> = {};
  for (const nodeType of pluginNodeTypes) {
    const registeredIndexes = effectiveStore.getRegisteredIndexes(nodeType);
    if (registeredIndexes.length > 0) {
      indexes[nodeType] = registeredIndexes;
    }
  }

  const cacheData: CachedData = {
    nodes: pluginNodes,
    indexes,
    meta: {
      version: 1,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
  };

  await entry.cache.save(cacheData);
  console.log(
    `💾 [CacheManager] Saved ${pluginNodes.length} nodes for plugin: ${pluginName}`
  );

  return true;
}

/**
 * Save caches for all plugins that own any of the affected nodes.
 * Used after webhook batch processing.
 *
 * @param affectedPlugins - Set of plugin names that were affected
 * @param nodeStore - The node store to read from (optional)
 */
export async function saveAffectedPlugins(
  affectedPlugins: Set<string>,
  nodeStore?: NodeStore
): Promise<void> {
  const savePromises: Promise<boolean>[] = [];

  for (const pluginName of affectedPlugins) {
    if (hasPluginCache(pluginName)) {
      savePromises.push(savePluginCache(pluginName, nodeStore));
    }
  }

  await Promise.all(savePromises);
}

/**
 * Replace all plugin caches with the current store state.
 * Used after remote sync to persist fetched data locally.
 *
 * @param nodeStore - The node store to read from (optional)
 */
export async function replaceAllCaches(nodeStore?: NodeStore): Promise<void> {
  const effectiveStore = nodeStore ?? store;
  if (!effectiveStore) {
    console.warn(
      '⚠️ [CacheManager] No store available for replacing all caches'
    );
    return;
  }

  // Group all nodes by owner
  const nodesByOwner = new Map<string, typeof allNodes>();
  const allNodes = effectiveStore.getAll();

  for (const node of allNodes) {
    const owner = node.internal.owner;
    if (!nodesByOwner.has(owner)) {
      nodesByOwner.set(owner, []);
    }
    nodesByOwner.get(owner)!.push(node);
  }

  // Save each plugin's cache
  const savePromises: Promise<void>[] = [];

  for (const [pluginName, pluginNodes] of nodesByOwner) {
    const entry = pluginCaches.get(pluginName);
    if (!entry) {
      // Plugin has no registered cache, skip
      continue;
    }

    // Get indexes for node types owned by this plugin
    const pluginNodeTypes = new Set(pluginNodes.map((n) => n.internal.type));
    const indexes: Record<string, string[]> = {};
    for (const nodeType of pluginNodeTypes) {
      const registeredIndexes = effectiveStore.getRegisteredIndexes(nodeType);
      if (registeredIndexes.length > 0) {
        indexes[nodeType] = registeredIndexes;
      }
    }

    const cacheData: CachedData = {
      nodes: pluginNodes,
      indexes,
      meta: {
        version: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    };

    savePromises.push(
      entry.cache.save(cacheData).then(() => {
        console.log(
          `💾 [CacheManager] Replaced cache for plugin: ${pluginName} (${pluginNodes.length} nodes)`
        );
      })
    );
  }

  await Promise.all(savePromises);
  console.log(
    `💾 [CacheManager] Replaced all caches (${nodesByOwner.size} plugins)`
  );
}

/**
 * Clear all registered plugin caches.
 * Useful for testing.
 */
export async function clearAllCaches(): Promise<void> {
  const clearPromises: Promise<void>[] = [];

  for (const entry of pluginCaches.values()) {
    clearPromises.push(entry.cache.clear());
  }

  await Promise.all(clearPromises);
}

/**
 * Reset the cache manager state.
 * Useful for testing to ensure isolation between test runs.
 */
export function resetCacheManager(): void {
  pluginCaches.clear();
  store = null;
}
