import type { Node } from '../nodes/types.js';
import type { DeletionLogData } from '../sync/index.js';

/** Serializable representation of a node for cache storage */
export type SerializedNode = Node;

/** Data structure for cache storage */
export interface CachedData {
  /** All nodes in the store */
  nodes: SerializedNode[];
  /** Registered indexes: nodeType -> fieldNames[] */
  indexes: Record<string, string[]>;
  /** Deletion log for partial sync support */
  deletionLog?: DeletionLogData;
  /** Cache metadata */
  meta: {
    version: number;
    createdAt: number;
    updatedAt: number;
  };
}

/**
 * Interface for pluggable cache storage backends.
 *
 * Implement this interface to create custom cache storage solutions
 * (e.g., Redis, SQLite, S3, etc.)
 *
 * @example
 * ```typescript
 * class RedisCacheStorage implements CacheStorage {
 *   async load() {
 *     const data = await redis.get('udl-cache');
 *     return data ? JSON.parse(data) : null;
 *   }
 *   async save(data: CachedData) {
 *     await redis.set('udl-cache', JSON.stringify(data));
 *   }
 *   async clear() {
 *     await redis.del('udl-cache');
 *   }
 * }
 * ```
 */
export interface CacheStorage {
  /** Load cached data from storage. Returns null if no cache exists. */
  load(): Promise<CachedData | null>;

  /** Save data to cache storage */
  save(data: CachedData): Promise<void>;

  /** Clear all cached data */
  clear(): Promise<void>;
}
