/**
 * Cache module for persisting node data across server restarts.
 *
 * @module cache
 */

export { FileCacheStorage } from './file-cache.js';
export type { CacheStorage, CachedData, SerializedNode } from './types.js';
