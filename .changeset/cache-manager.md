---
'universal-data-layer': minor
---

Add centralized cache manager for plugin cache coordination

Introduces a `CacheManager` module that provides a central point for coordinating plugin cache updates. This enables webhook handlers and remote sync to persist changes to disk after store modifications.

**Features:**

- `registerPluginCache(pluginName, cache)`: Register a plugin's cache storage
- `initPluginCache(pluginName, cacheLocation, customCache?)`: Initialize and register a cache
- `savePluginCache(pluginName, store?)`: Save a specific plugin's nodes to cache
- `saveAffectedPlugins(affectedPlugins, store?)`: Save caches for multiple plugins
- `replaceAllCaches(store?)`: Replace all plugin caches (for remote sync)
- `setStore(store)`: Set the node store reference for cache operations

**Integration:**

- Loader now uses cache manager for plugin cache operations
- Webhook batch processing automatically saves affected plugin caches
- Remote sync persists fetched nodes to cache for offline support

**New exports:**

```typescript
import {
  setStore,
  getStore,
  registerPluginCache,
  initPluginCache,
  savePluginCache,
  saveAffectedPlugins,
  replaceAllCaches,
  clearAllCaches,
  resetCacheManager,
} from 'universal-data-layer';
```
