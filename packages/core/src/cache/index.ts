/**
 * Cache module for persisting node data across server restarts.
 *
 * @module cache
 */

export { FileCacheStorage } from './file-cache.js';
export {
  setStore,
  getStore,
  registerPluginCache,
  initPluginCache,
  hasPluginCache,
  getPluginCache,
  getRegisteredPlugins,
  savePluginCache,
  saveAffectedPlugins,
  replaceAllCaches,
  clearAllCaches,
  resetCacheManager,
} from './manager.js';
export type { CacheStorage, CachedData, SerializedNode } from './types.js';
