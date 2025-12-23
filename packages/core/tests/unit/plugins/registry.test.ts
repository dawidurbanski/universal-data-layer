import { describe, it, expect, beforeEach } from 'vitest';
import {
  PluginRegistry,
  defaultPluginRegistry,
  type RegisteredPlugin,
} from '@/plugins/registry.js';

describe('PluginRegistry', () => {
  let registry: PluginRegistry;

  beforeEach(() => {
    registry = new PluginRegistry();
  });

  describe('register', () => {
    it('should register a plugin', () => {
      const plugin: RegisteredPlugin = {
        name: 'test-plugin',
        sourceNodes: undefined,
        updateStrategy: 'webhook',
        sourceNodesContext: undefined,
        store: undefined,
      };

      registry.register(plugin);

      expect(registry.get('test-plugin')).toBe(plugin);
    });

    it('should overwrite existing plugin with same name', () => {
      const plugin1: RegisteredPlugin = {
        name: 'test-plugin',
        sourceNodes: undefined,
        updateStrategy: 'webhook',
        sourceNodesContext: undefined,
        store: undefined,
      };

      const plugin2: RegisteredPlugin = {
        name: 'test-plugin',
        sourceNodes: undefined,
        updateStrategy: 'sync',
        sourceNodesContext: undefined,
        store: undefined,
      };

      registry.register(plugin1);
      registry.register(plugin2);

      expect(registry.get('test-plugin')).toBe(plugin2);
      expect(registry.get('test-plugin')?.updateStrategy).toBe('sync');
    });
  });

  describe('get', () => {
    it('should return undefined for non-existent plugin', () => {
      expect(registry.get('non-existent')).toBeUndefined();
    });

    it('should return the registered plugin', () => {
      const plugin: RegisteredPlugin = {
        name: 'my-plugin',
        sourceNodes: undefined,
        updateStrategy: 'sync',
        sourceNodesContext: undefined,
        store: undefined,
      };

      registry.register(plugin);

      expect(registry.get('my-plugin')).toBe(plugin);
    });
  });

  describe('has', () => {
    it('should return false for non-existent plugin', () => {
      expect(registry.has('non-existent')).toBe(false);
    });

    it('should return true for registered plugin', () => {
      const plugin: RegisteredPlugin = {
        name: 'existing-plugin',
        sourceNodes: undefined,
        updateStrategy: 'webhook',
        sourceNodesContext: undefined,
        store: undefined,
      };

      registry.register(plugin);

      expect(registry.has('existing-plugin')).toBe(true);
    });
  });

  describe('getAll', () => {
    it('should return empty array when no plugins registered', () => {
      expect(registry.getAll()).toEqual([]);
    });

    it('should return all registered plugins', () => {
      const plugin1: RegisteredPlugin = {
        name: 'plugin-1',
        sourceNodes: undefined,
        updateStrategy: 'webhook',
        sourceNodesContext: undefined,
        store: undefined,
      };

      const plugin2: RegisteredPlugin = {
        name: 'plugin-2',
        sourceNodes: undefined,
        updateStrategy: 'sync',
        sourceNodesContext: undefined,
        store: undefined,
      };

      registry.register(plugin1);
      registry.register(plugin2);

      const all = registry.getAll();
      expect(all).toHaveLength(2);
      expect(all).toContain(plugin1);
      expect(all).toContain(plugin2);
    });
  });

  describe('getByStrategy', () => {
    it('should return empty array when no plugins match strategy', () => {
      const plugin: RegisteredPlugin = {
        name: 'webhook-plugin',
        sourceNodes: undefined,
        updateStrategy: 'webhook',
        sourceNodesContext: undefined,
        store: undefined,
      };

      registry.register(plugin);

      expect(registry.getByStrategy('sync')).toEqual([]);
    });

    it('should return plugins with matching strategy', () => {
      const webhookPlugin: RegisteredPlugin = {
        name: 'webhook-plugin',
        sourceNodes: undefined,
        updateStrategy: 'webhook',
        sourceNodesContext: undefined,
        store: undefined,
      };

      const syncPlugin1: RegisteredPlugin = {
        name: 'sync-plugin-1',
        sourceNodes: undefined,
        updateStrategy: 'sync',
        sourceNodesContext: undefined,
        store: undefined,
      };

      const syncPlugin2: RegisteredPlugin = {
        name: 'sync-plugin-2',
        sourceNodes: undefined,
        updateStrategy: 'sync',
        sourceNodesContext: undefined,
        store: undefined,
      };

      registry.register(webhookPlugin);
      registry.register(syncPlugin1);
      registry.register(syncPlugin2);

      const syncPlugins = registry.getByStrategy('sync');
      expect(syncPlugins).toHaveLength(2);
      expect(syncPlugins).toContain(syncPlugin1);
      expect(syncPlugins).toContain(syncPlugin2);
      expect(syncPlugins).not.toContain(webhookPlugin);

      const webhookPlugins = registry.getByStrategy('webhook');
      expect(webhookPlugins).toHaveLength(1);
      expect(webhookPlugins).toContain(webhookPlugin);
    });

    it('should return empty array when registry is empty', () => {
      expect(registry.getByStrategy('webhook')).toEqual([]);
      expect(registry.getByStrategy('sync')).toEqual([]);
    });
  });

  describe('clear', () => {
    it('should remove all registered plugins', () => {
      const plugin1: RegisteredPlugin = {
        name: 'plugin-1',
        sourceNodes: undefined,
        updateStrategy: 'webhook',
        sourceNodesContext: undefined,
        store: undefined,
      };

      const plugin2: RegisteredPlugin = {
        name: 'plugin-2',
        sourceNodes: undefined,
        updateStrategy: 'sync',
        sourceNodesContext: undefined,
        store: undefined,
      };

      registry.register(plugin1);
      registry.register(plugin2);

      expect(registry.getAll()).toHaveLength(2);

      registry.clear();

      expect(registry.getAll()).toEqual([]);
      expect(registry.has('plugin-1')).toBe(false);
      expect(registry.has('plugin-2')).toBe(false);
    });

    it('should work on empty registry', () => {
      registry.clear();
      expect(registry.getAll()).toEqual([]);
    });
  });
});

describe('defaultPluginRegistry', () => {
  beforeEach(() => {
    defaultPluginRegistry.clear();
  });

  it('should be an instance of PluginRegistry', () => {
    expect(defaultPluginRegistry).toBeInstanceOf(PluginRegistry);
  });

  it('should be a singleton', () => {
    const plugin: RegisteredPlugin = {
      name: 'singleton-test',
      sourceNodes: undefined,
      updateStrategy: 'webhook',
      sourceNodesContext: undefined,
      store: undefined,
    };

    defaultPluginRegistry.register(plugin);

    expect(defaultPluginRegistry.get('singleton-test')).toBe(plugin);
  });
});
