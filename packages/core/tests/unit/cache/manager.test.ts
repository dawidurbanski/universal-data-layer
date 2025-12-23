import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
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
} from '@/cache/manager.js';
import type { CacheStorage, CachedData } from '@/cache/types.js';
import { FileCacheStorage } from '@/cache/file-cache.js';
import { NodeStore } from '@/nodes/store.js';
import type { Node } from '@/nodes/types.js';

/** Helper to create a valid test node */
function createTestNode(
  overrides: Partial<Node> & {
    id?: string;
    _type?: string;
    _owner?: string;
  } = {}
): Node {
  const {
    id = 'node-1',
    _type = 'TestNode',
    _owner = 'test-plugin',
    ...rest
  } = overrides;
  return {
    internal: {
      id,
      type: _type,
      contentDigest: 'test-digest',
      owner: _owner,
      createdAt: 1000,
      modifiedAt: 2000,
    },
    ...rest,
  };
}

/** Create a mock CacheStorage */
function createMockCache(): CacheStorage & {
  savedData: CachedData | null;
  loadedData: CachedData | null;
} {
  return {
    savedData: null,
    loadedData: null,
    async load() {
      return this.loadedData;
    },
    async save(data: CachedData) {
      this.savedData = data;
    },
    async clear() {
      this.savedData = null;
    },
  };
}

describe('Cache Manager', () => {
  let store: NodeStore;

  beforeEach(() => {
    resetCacheManager();
    store = new NodeStore();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('store management', () => {
    it('should set and get store reference', () => {
      expect(getStore()).toBeNull();
      setStore(store);
      expect(getStore()).toBe(store);
    });
  });

  describe('registerPluginCache', () => {
    it('should register a plugin cache', () => {
      const cache = createMockCache();
      registerPluginCache('plugin-a', cache);

      expect(hasPluginCache('plugin-a')).toBe(true);
      expect(getPluginCache('plugin-a')).toBe(cache);
    });

    it('should return false for unregistered plugin', () => {
      expect(hasPluginCache('nonexistent')).toBe(false);
      expect(getPluginCache('nonexistent')).toBeUndefined();
    });

    it('should track all registered plugins', () => {
      const cacheA = createMockCache();
      const cacheB = createMockCache();

      registerPluginCache('plugin-a', cacheA);
      registerPluginCache('plugin-b', cacheB);

      const plugins = getRegisteredPlugins();
      expect(plugins).toContain('plugin-a');
      expect(plugins).toContain('plugin-b');
      expect(plugins).toHaveLength(2);
    });
  });

  describe('initPluginCache', () => {
    it('should create FileCacheStorage by default and register it', () => {
      const cache = initPluginCache('plugin-a', '/path/to/cache');

      expect(cache).toBeInstanceOf(FileCacheStorage);
      expect(hasPluginCache('plugin-a')).toBe(true);
      expect(getPluginCache('plugin-a')).toBe(cache);
    });

    it('should use custom cache when provided', () => {
      const customCache = createMockCache();
      const cache = initPluginCache('plugin-a', '/path/to/cache', customCache);

      expect(cache).toBe(customCache);
      expect(hasPluginCache('plugin-a')).toBe(true);
      expect(getPluginCache('plugin-a')).toBe(customCache);
    });

    it('should return the cache for later use', () => {
      const cache = initPluginCache('plugin-a', '/some/path');

      // Should be able to use the returned cache directly
      expect(cache).toBeDefined();
      expect(typeof cache.save).toBe('function');
      expect(typeof cache.load).toBe('function');
      expect(typeof cache.clear).toBe('function');
    });
  });

  describe('savePluginCache', () => {
    it('should save nodes owned by the plugin', async () => {
      const cache = createMockCache();
      registerPluginCache('plugin-a', cache);
      setStore(store);

      // Add nodes to store
      store.set(createTestNode({ id: 'node-1', _owner: 'plugin-a' }));
      store.set(createTestNode({ id: 'node-2', _owner: 'plugin-a' }));
      store.set(createTestNode({ id: 'node-3', _owner: 'plugin-b' }));

      const result = await savePluginCache('plugin-a');

      expect(result).toBe(true);
      expect(cache.savedData).not.toBeNull();
      expect(cache.savedData?.nodes).toHaveLength(2);
      expect(cache.savedData?.nodes.map((n) => n.internal.id)).toContain(
        'node-1'
      );
      expect(cache.savedData?.nodes.map((n) => n.internal.id)).toContain(
        'node-2'
      );
    });

    it('should include indexes for plugin node types', async () => {
      const cache = createMockCache();
      registerPluginCache('plugin-a', cache);
      setStore(store);

      // Add nodes and register indexes
      store.set(
        createTestNode({ id: 'node-1', _type: 'Product', _owner: 'plugin-a' })
      );
      store.registerIndex('Product', 'slug');

      await savePluginCache('plugin-a');

      expect(cache.savedData?.indexes).toEqual({ Product: ['slug'] });
    });

    it('should return false for unregistered plugin', async () => {
      setStore(store);
      const result = await savePluginCache('nonexistent');
      expect(result).toBe(false);
    });

    it('should return false when no store is available', async () => {
      const cache = createMockCache();
      registerPluginCache('plugin-a', cache);

      const result = await savePluginCache('plugin-a');
      expect(result).toBe(false);
    });

    it('should use provided store over registered store', async () => {
      const cache = createMockCache();
      const alternateStore = new NodeStore();

      registerPluginCache('plugin-a', cache);
      setStore(store);

      // Add different nodes to each store
      store.set(createTestNode({ id: 'node-1', _owner: 'plugin-a' }));
      alternateStore.set(
        createTestNode({ id: 'alt-node-1', _owner: 'plugin-a' })
      );

      await savePluginCache('plugin-a', alternateStore);

      expect(cache.savedData?.nodes).toHaveLength(1);
      expect(cache.savedData?.nodes[0]?.internal.id).toBe('alt-node-1');
    });
  });

  describe('saveAffectedPlugins', () => {
    it('should save caches for all affected plugins', async () => {
      const cacheA = createMockCache();
      const cacheB = createMockCache();

      registerPluginCache('plugin-a', cacheA);
      registerPluginCache('plugin-b', cacheB);
      setStore(store);

      store.set(createTestNode({ id: 'node-1', _owner: 'plugin-a' }));
      store.set(createTestNode({ id: 'node-2', _owner: 'plugin-b' }));

      await saveAffectedPlugins(new Set(['plugin-a', 'plugin-b']));

      expect(cacheA.savedData?.nodes).toHaveLength(1);
      expect(cacheB.savedData?.nodes).toHaveLength(1);
    });

    it('should skip plugins without registered caches', async () => {
      const cacheA = createMockCache();
      registerPluginCache('plugin-a', cacheA);
      setStore(store);

      store.set(createTestNode({ id: 'node-1', _owner: 'plugin-a' }));
      store.set(createTestNode({ id: 'node-2', _owner: 'plugin-b' }));

      // plugin-b is not registered
      await saveAffectedPlugins(new Set(['plugin-a', 'plugin-b']));

      expect(cacheA.savedData?.nodes).toHaveLength(1);
    });
  });

  describe('replaceAllCaches', () => {
    it('should save all nodes grouped by owner', async () => {
      const cacheA = createMockCache();
      const cacheB = createMockCache();

      registerPluginCache('plugin-a', cacheA);
      registerPluginCache('plugin-b', cacheB);
      setStore(store);

      store.set(createTestNode({ id: 'node-1', _owner: 'plugin-a' }));
      store.set(createTestNode({ id: 'node-2', _owner: 'plugin-a' }));
      store.set(createTestNode({ id: 'node-3', _owner: 'plugin-b' }));

      await replaceAllCaches();

      expect(cacheA.savedData?.nodes).toHaveLength(2);
      expect(cacheB.savedData?.nodes).toHaveLength(1);
    });

    it('should skip plugins without registered caches', async () => {
      const cacheA = createMockCache();
      registerPluginCache('plugin-a', cacheA);
      setStore(store);

      store.set(createTestNode({ id: 'node-1', _owner: 'plugin-a' }));
      store.set(createTestNode({ id: 'node-2', _owner: 'plugin-b' }));

      // plugin-b is not registered - should not throw
      await replaceAllCaches();

      expect(cacheA.savedData?.nodes).toHaveLength(1);
    });

    it('should handle empty store', async () => {
      const cacheA = createMockCache();
      registerPluginCache('plugin-a', cacheA);
      setStore(store);

      await replaceAllCaches();

      // Should complete without error, no nodes to save
      expect(cacheA.savedData).toBeNull();
    });

    it('should warn and return early when no store is available', async () => {
      const cacheA = createMockCache();
      registerPluginCache('plugin-a', cacheA);
      // No store is set and no store is passed

      await replaceAllCaches();

      // Should warn and not save anything
      expect(console.warn).toHaveBeenCalledWith(
        '⚠️ [CacheManager] No store available for replacing all caches'
      );
      expect(cacheA.savedData).toBeNull();
    });

    it('should include indexes for node types in replaceAllCaches', async () => {
      const cacheA = createMockCache();
      registerPluginCache('plugin-a', cacheA);
      setStore(store);

      // Add node and register indexes
      store.set(
        createTestNode({ id: 'node-1', _type: 'Product', _owner: 'plugin-a' })
      );
      store.registerIndex('Product', 'slug');

      await replaceAllCaches();

      expect(cacheA.savedData?.indexes).toEqual({ Product: ['slug'] });
    });

    it('should use provided store over registered store', async () => {
      const cacheA = createMockCache();
      const alternateStore = new NodeStore();

      registerPluginCache('plugin-a', cacheA);
      setStore(store);

      alternateStore.set(
        createTestNode({ id: 'alt-node-1', _owner: 'plugin-a' })
      );

      await replaceAllCaches(alternateStore);

      expect(cacheA.savedData?.nodes).toHaveLength(1);
      expect(cacheA.savedData?.nodes[0]?.internal.id).toBe('alt-node-1');
    });
  });

  describe('clearAllCaches', () => {
    it('should clear all registered caches', async () => {
      const cacheA = createMockCache();
      const cacheB = createMockCache();

      cacheA.savedData = {
        nodes: [],
        indexes: {},
        meta: { version: 1, createdAt: 0, updatedAt: 0 },
      };
      cacheB.savedData = {
        nodes: [],
        indexes: {},
        meta: { version: 1, createdAt: 0, updatedAt: 0 },
      };

      registerPluginCache('plugin-a', cacheA);
      registerPluginCache('plugin-b', cacheB);

      await clearAllCaches();

      expect(cacheA.savedData).toBeNull();
      expect(cacheB.savedData).toBeNull();
    });
  });

  describe('resetCacheManager', () => {
    it('should reset all state', () => {
      const cache = createMockCache();
      registerPluginCache('plugin-a', cache);
      setStore(store);

      resetCacheManager();

      expect(getRegisteredPlugins()).toHaveLength(0);
      expect(getStore()).toBeNull();
    });
  });
});
