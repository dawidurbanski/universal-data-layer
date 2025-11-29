import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  unlinkSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import type { CacheStorage, CachedData } from './types.js';

/** Current cache format version. Increment when format changes. */
const CACHE_VERSION = 1;

/**
 * Safely stringify an object, handling circular references.
 * Circular references are replaced with a placeholder string.
 */
function safeStringify(obj: unknown, indent?: number): string {
  const seen = new WeakSet();

  return JSON.stringify(
    obj,
    (_key, value) => {
      // Handle non-object values directly
      if (typeof value !== 'object' || value === null) {
        return value;
      }

      // Check for circular reference
      if (seen.has(value)) {
        return '[Circular]';
      }

      seen.add(value);
      return value;
    },
    indent
  );
}

/**
 * File-based cache storage implementation.
 *
 * Stores node data in `.udl-cache/nodes.json` by default.
 * This is the default cache storage used when no custom implementation is provided.
 *
 * @example
 * ```typescript
 * // Use default path (.udl-cache/nodes.json in cwd)
 * const cache = new FileCacheStorage();
 *
 * // Use custom base path
 * const cache = new FileCacheStorage('/path/to/project');
 * ```
 */
export class FileCacheStorage implements CacheStorage {
  private readonly filePath: string;

  /**
   * Create a new file cache storage instance.
   * @param basePath - Base directory for cache files (default: process.cwd())
   */
  constructor(basePath: string = process.cwd()) {
    this.filePath = join(basePath, '.udl-cache', 'nodes.json');
  }

  /**
   * Load cached data from disk.
   * Returns null if cache doesn't exist, is corrupted, or has version mismatch.
   */
  async load(): Promise<CachedData | null> {
    if (!existsSync(this.filePath)) {
      return null;
    }

    try {
      const content = readFileSync(this.filePath, 'utf-8');
      const data = JSON.parse(content) as CachedData;

      // Version check - invalidate cache if version mismatch
      if (data.meta?.version !== CACHE_VERSION) {
        console.log(
          `📦 Cache version mismatch (expected ${CACHE_VERSION}, got ${data.meta?.version}), invalidating...`
        );
        return null;
      }

      return data;
    } catch (error) {
      console.warn('⚠️ Failed to load cache, starting fresh:', error);
      return null;
    }
  }

  /**
   * Save data to cache file.
   * Creates the cache directory if it doesn't exist.
   */
  async save(data: CachedData): Promise<void> {
    const dir = dirname(this.filePath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    // Ensure metadata is set
    const dataToSave: CachedData = {
      ...data,
      meta: {
        ...data.meta,
        version: CACHE_VERSION,
        updatedAt: Date.now(),
      },
    };

    writeFileSync(this.filePath, safeStringify(dataToSave, 2));
  }

  /**
   * Delete the cache file.
   */
  async clear(): Promise<void> {
    if (existsSync(this.filePath)) {
      unlinkSync(this.filePath);
    }
  }
}
