import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { loadConfigFile, loadPlugins } from '@/loader.js';
import { NodeStore, setDefaultStore } from '@/nodes/index.js';

describe('loader - sourceNodes integration', () => {
  let testDir: string;
  let store: NodeStore;

  beforeEach(() => {
    // Create a temporary directory for test plugin configs
    testDir = join(tmpdir(), `udl-test-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });

    // Create a fresh store for each test
    store = new NodeStore();

    // Set it as the default for isolation
    setDefaultStore(store);
  });

  afterEach(() => {
    // Clean up temp directory
    rmSync(testDir, { recursive: true, force: true });
  });

  describe('sourceNodes hook', () => {
    it('should execute sourceNodes hook when plugin exports it', async () => {
      const configPath = join(testDir, 'udl.config.js');

      // Create a plugin config with sourceNodes hook
      writeFileSync(
        configPath,
        `
        export const config = {
          type: 'source',
          name: 'test-plugin',
        };

        export async function sourceNodes({ actions, createNodeId, createContentDigest, options }) {
          await actions.createNode({
            internal: {
              id: createNodeId('Product', 'test-1'),
              type: 'Product',
            },
            parent: undefined,
            children: undefined,
            name: 'Test Product',
            price: 99.99,
          });
        }
        `
      );

      await loadConfigFile(configPath, {
        pluginName: 'test-plugin',
        store,
      });

      const nodes = store.getAll();

      expect(nodes).toHaveLength(1);
      expect(nodes[0]?.internal.type).toBe('Product');
      expect(nodes[0]?.internal.owner).toBe('test-plugin');
      expect(nodes[0]).toMatchObject({
        name: 'Test Product',
        price: 99.99,
      });
    });

    it('should pass plugin options to sourceNodes context', async () => {
      const configPath = join(testDir, 'udl.config.js');

      writeFileSync(
        configPath,
        `
        export const config = {
          type: 'source',
          name: 'test-plugin',
        };

        export async function sourceNodes({ actions, createNodeId, options }) {
          await actions.createNode({
            internal: {
              id: createNodeId('Config', 'settings'),
              type: 'Config',
            },
            parent: undefined,
            children: undefined,
            apiKey: options?.apiKey,
            environment: options?.environment,
          });
        }
        `
      );

      await loadConfigFile(configPath, {
        context: {
          options: {
            apiKey: 'test-key-123',
            environment: 'production',
          },
        },
        pluginName: 'test-plugin',
        store,
      });

      const nodes = store.getByType('Config');

      expect(nodes).toHaveLength(1);
      expect(nodes[0]).toMatchObject({
        apiKey: 'test-key-123',
        environment: 'production',
      });
    });

    it('should provide createNodeId helper in context', async () => {
      const configPath = join(testDir, 'udl.config.js');

      writeFileSync(
        configPath,
        `
        export const config = {
          type: 'source',
          name: 'test-plugin',
        };

        export async function sourceNodes({ actions, createNodeId }) {
          const id1 = createNodeId('Product', 'abc');
          const id2 = createNodeId('Product', 'abc');
          const id3 = createNodeId('Product', 'xyz');

          // Same inputs should produce same ID
          if (id1 !== id2) {
            throw new Error('createNodeId not deterministic');
          }

          // Different inputs should produce different ID
          if (id1 === id3) {
            throw new Error('createNodeId collision');
          }

          await actions.createNode({
            internal: {
              id: id1,
              type: 'Product',
            },
            parent: undefined,
            children: undefined,
          });
        }
        `
      );

      await loadConfigFile(configPath, {
        pluginName: 'test-plugin',
        store,
      });

      expect(store.getAll()).toHaveLength(1);
    });

    it('should provide createContentDigest helper in context', async () => {
      const configPath = join(testDir, 'udl.config.js');

      writeFileSync(
        configPath,
        `
        export const config = {
          type: 'source',
          name: 'test-plugin',
        };

        export async function sourceNodes({ actions, createNodeId, createContentDigest }) {
          const data = { name: 'Product', price: 100 };
          const digest = createContentDigest(data);

          await actions.createNode({
            internal: {
              id: createNodeId('Product', '1'),
              type: 'Product',
              contentDigest: digest,
            },
            parent: undefined,
            children: undefined,
            ...data,
          });
        }
        `
      );

      await loadConfigFile(configPath, {
        pluginName: 'test-plugin',
        store,
      });

      const nodes = store.getAll();

      expect(nodes).toHaveLength(1);
      expect(nodes[0]?.internal.contentDigest).toBeTruthy();
      expect(typeof nodes[0]?.internal.contentDigest).toBe('string');
      expect(nodes[0]?.internal.contentDigest.length).toBe(64); // SHA-256 hex length
    });

    it('should track which plugin created which nodes via owner field', async () => {
      const configPath1 = join(testDir, 'plugin1.config.js');
      const configPath2 = join(testDir, 'plugin2.config.js');

      writeFileSync(
        configPath1,
        `
        export const config = { name: 'plugin1' };

        export async function sourceNodes({ actions, createNodeId }) {
          await actions.createNode({
            internal: {
              id: createNodeId('Product', 'p1'),
              type: 'Product',
            },
            parent: undefined,
            children: undefined,
            source: 'plugin1',
          });
        }
        `
      );

      writeFileSync(
        configPath2,
        `
        export const config = { name: 'plugin2' };

        export async function sourceNodes({ actions, createNodeId }) {
          await actions.createNode({
            internal: {
              id: createNodeId('Product', 'p2'),
              type: 'Product',
            },
            parent: undefined,
            children: undefined,
            source: 'plugin2',
          });
        }
        `
      );

      await loadConfigFile(configPath1, {
        pluginName: 'plugin1',
        store,
      });
      await loadConfigFile(configPath2, {
        pluginName: 'plugin2',
        store,
      });

      const nodes = store.getAll();

      expect(nodes).toHaveLength(2);

      const plugin1Node = nodes.find(
        (n) => (n as { source?: string }).source === 'plugin1'
      );
      const plugin2Node = nodes.find(
        (n) => (n as { source?: string }).source === 'plugin2'
      );

      expect(plugin1Node?.internal.owner).toBe('plugin1');
      expect(plugin2Node?.internal.owner).toBe('plugin2');
    });

    it('should provide all node actions (createNode, getNode, deleteNode, extendNode)', async () => {
      const configPath = join(testDir, 'udl.config.js');

      writeFileSync(
        configPath,
        `
        export const config = { name: 'test-plugin' };

        export async function sourceNodes({ actions, createNodeId }) {
          // Create a node
          const node = await actions.createNode({
            internal: {
              id: createNodeId('Product', '1'),
              type: 'Product',
            },
            parent: undefined,
            children: undefined,
            name: 'Original',
            price: 100,
          });

          // Get the node
          const retrieved = actions.getNode(node.internal.id);
          if (!retrieved) throw new Error('getNode failed');

          // Extend the node
          const extended = await actions.extendNode(node.internal.id, {
            category: 'Electronics',
          });

          if (!extended.category) throw new Error('extendNode failed');

          // Get all nodes
          const allNodes = actions.getNodes();
          if (allNodes.length !== 1) throw new Error('getNodes failed');

          // Get by type
          const products = actions.getNodesByType('Product');
          if (products.length !== 1) throw new Error('getNodesByType failed');

          // Delete the node
          const deleted = await actions.deleteNode(node.internal.id);
          if (!deleted) throw new Error('deleteNode failed');

          const afterDelete = actions.getNode(node.internal.id);
          if (afterDelete) throw new Error('Node should be deleted');
        }
        `
      );

      // Should not throw
      await loadConfigFile(configPath, {
        pluginName: 'test-plugin',
        store,
      });

      expect(store.getAll()).toHaveLength(0); // Node was deleted
    });

    it('should work without sourceNodes hook (backwards compatible)', async () => {
      const configPath = join(testDir, 'udl.config.js');

      writeFileSync(
        configPath,
        `
        export const config = {
          type: 'source',
          name: 'test-plugin',
        };

        export async function onLoad({ options }) {
          // Only onLoad, no sourceNodes
        }
        `
      );

      // Should not throw
      const config = await loadConfigFile(configPath, {
        context: {},
        pluginName: 'test-plugin',
        store,
      });

      expect(config).toBeTruthy();
      expect(config?.name).toBe('test-plugin');

      expect(store.getAll()).toHaveLength(0); // No nodes created
    });

    it('should not execute sourceNodes if pluginName is not provided', async () => {
      const configPath = join(testDir, 'udl.config.js');

      writeFileSync(
        configPath,
        `
        export const config = { name: 'test-plugin' };

        export async function sourceNodes({ actions, createNodeId }) {
          await actions.createNode({
            internal: {
              id: createNodeId('Product', '1'),
              type: 'Product',
            },
            parent: undefined,
            children: undefined,
          });
        }
        `
      );

      // loadConfigFile without pluginName
      await loadConfigFile(configPath, {
        store,
        // No pluginName provided
      });

      expect(store.getAll()).toHaveLength(0); // sourceNodes should not execute
    });

    it('should use config.name as owner when loading plugins via loadPlugins', async () => {
      // Create a plugin directory structure
      const pluginDir = join(testDir, 'my-plugin');
      mkdirSync(pluginDir, { recursive: true });

      const configPath = join(pluginDir, 'udl.config.js');

      writeFileSync(
        configPath,
        `
        export const config = {
          type: 'source',
          name: 'source-products',
        };

        export async function sourceNodes({ actions, createNodeId }) {
          await actions.createNode({
            internal: {
              id: createNodeId('Product', 'test-1'),
              type: 'Product',
            },
            parent: undefined,
            children: undefined,
            name: 'Test Product',
          });
        }
        `
      );

      // Load the plugin using loadPlugins (passing the path)
      await loadPlugins([pluginDir], { appConfig: {}, store });

      const nodes = store.getAll();

      expect(nodes).toHaveLength(1);
      // The owner should be 'source-products' from config.name, not the path
      expect(nodes[0]?.internal.owner).toBe('source-products');
    });

    it('should use directory basename as owner if config.name is not provided', async () => {
      // Create a plugin directory structure
      const pluginDir = join(testDir, 'my-custom-plugin');
      mkdirSync(pluginDir, { recursive: true });

      const configPath = join(pluginDir, 'udl.config.js');

      writeFileSync(
        configPath,
        `
        export const config = {
          type: 'source',
          // No name field
        };

        export async function sourceNodes({ actions, createNodeId }) {
          await actions.createNode({
            internal: {
              id: createNodeId('Product', 'test-1'),
              type: 'Product',
            },
            parent: undefined,
            children: undefined,
            name: 'Test Product',
          });
        }
        `
      );

      // Load the plugin using loadPlugins
      await loadPlugins([pluginDir], { appConfig: {}, store });

      const nodes = store.getAll();

      expect(nodes).toHaveLength(1);
      // Should fallback to directory basename
      expect(nodes[0]?.internal.owner).toBe('my-custom-plugin');
    });

    it('should handle relative plugin paths correctly', async () => {
      // Create nested plugin directory
      const pluginDir = join(testDir, 'plugins', 'data-source-plugin');
      mkdirSync(pluginDir, { recursive: true });

      const configPath = join(pluginDir, 'udl.config.js');

      writeFileSync(
        configPath,
        `
        export const config = {
          name: 'data-source',
        };

        export async function sourceNodes({ actions, createNodeId }) {
          await actions.createNode({
            internal: {
              id: createNodeId('Article', '1'),
              type: 'Article',
            },
            parent: undefined,
            children: undefined,
            title: 'Test Article',
          });
        }
        `
      );

      // Load using absolute path
      await loadPlugins([pluginDir], { appConfig: {}, store });

      const nodes = store.getAll();

      expect(nodes).toHaveLength(1);
      expect(nodes[0]?.internal.owner).toBe('data-source');
      expect(nodes[0]).toMatchObject({
        title: 'Test Article',
      });
    });

    it('should load TypeScript plugin configs with tsx', async () => {
      // Create a plugin directory with TypeScript config
      const pluginDir = join(testDir, 'ts-plugin');
      mkdirSync(pluginDir, { recursive: true });

      const configPath = join(pluginDir, 'udl.config.ts');

      writeFileSync(
        configPath,
        `
        import type { UDLConfig } from '@/loader.js';

        export const config: UDLConfig = {
          name: 'typescript-plugin',
        };

        export async function sourceNodes({ actions, createNodeId }: any) {
          await actions.createNode({
            internal: {
              id: createNodeId('TSNode', '1'),
              type: 'TSNode',
            },
            parent: undefined,
            children: undefined,
            fromTypeScript: true,
          });
        }
        `
      );

      // Load the TypeScript plugin
      await loadPlugins([pluginDir], { appConfig: {}, store });

      const nodes = store.getAll();

      expect(nodes).toHaveLength(1);
      expect(nodes[0]?.internal.owner).toBe('typescript-plugin');
      expect(nodes[0]).toMatchObject({
        fromTypeScript: true,
      });
    });

    it('should prefer compiled TypeScript over source TypeScript files', async () => {
      // Create a plugin with both source .ts and compiled .js
      const pluginDir = join(testDir, 'compiled-plugin');
      const distDir = join(pluginDir, 'dist');
      mkdirSync(distDir, { recursive: true });

      // Source TypeScript file (should be ignored)
      const tsConfigPath = join(pluginDir, 'udl.config.ts');
      writeFileSync(
        tsConfigPath,
        `
        export const config = {
          name: 'should-not-be-used',
        };

        export async function sourceNodes({ actions, createNodeId }: any) {
          throw new Error('Should not execute source TS file');
        }
        `
      );

      // Compiled JavaScript file (should be used)
      const compiledConfigPath = join(distDir, 'udl.config.js');
      writeFileSync(
        compiledConfigPath,
        `
        export const config = {
          name: 'compiled-plugin',
        };

        export async function sourceNodes({ actions, createNodeId }) {
          await actions.createNode({
            internal: {
              id: createNodeId('CompiledNode', '1'),
              type: 'CompiledNode',
            },
            parent: undefined,
            children: undefined,
            compiled: true,
          });
        }
        `
      );

      // Should prefer compiled version
      await loadPlugins([pluginDir], { appConfig: {}, store });

      const nodes = store.getAll();

      expect(nodes).toHaveLength(1);
      expect(nodes[0]?.internal.owner).toBe('compiled-plugin');
      expect(nodes[0]).toMatchObject({
        compiled: true,
      });
    });

    it('should load JavaScript plugin configs directly', async () => {
      // Create a plugin with .js config
      const pluginDir = join(testDir, 'js-plugin');
      mkdirSync(pluginDir, { recursive: true });

      const configPath = join(pluginDir, 'udl.config.js');

      writeFileSync(
        configPath,
        `
        export const config = {
          name: 'javascript-plugin',
        };

        export async function sourceNodes({ actions, createNodeId }) {
          await actions.createNode({
            internal: {
              id: createNodeId('JSNode', '1'),
              type: 'JSNode',
            },
            parent: undefined,
            children: undefined,
            fromJavaScript: true,
          });
        }
        `
      );

      // Load the JavaScript plugin
      await loadPlugins([pluginDir], { appConfig: {}, store });

      const nodes = store.getAll();

      expect(nodes).toHaveLength(1);
      expect(nodes[0]?.internal.owner).toBe('javascript-plugin');
      expect(nodes[0]).toMatchObject({
        fromJavaScript: true,
      });
    });
  });

  describe('field indexing', () => {
    it('should register indexes from plugin config defaults', async () => {
      const pluginDir = join(testDir, 'indexed-plugin');
      mkdirSync(pluginDir, { recursive: true });

      const configPath = join(pluginDir, 'udl.config.js');

      writeFileSync(
        configPath,
        `
        export const config = {
          name: 'indexed-plugin',
          indexes: ['slug', 'sku'], // Default indexes
        };

        export async function sourceNodes({ actions, createNodeId }) {
          await actions.createNode({
            internal: {
              id: createNodeId('Product', '1'),
              type: 'Product',
            },
            parent: undefined,
            children: undefined,
            name: 'Test Product',
            slug: 'test-product',
            sku: 'SKU-123',
          });
        }
        `
      );

      await loadPlugins([pluginDir], { appConfig: {}, store });

      // Verify indexes were registered
      const registeredIndexes = store.getRegisteredIndexes('Product');
      expect(registeredIndexes).toContain('slug');
      expect(registeredIndexes).toContain('sku');

      // Verify we can query by indexed fields
      const bySlug = store.getByField('Product', 'slug', 'test-product');
      expect(bySlug).toBeDefined();
      expect((bySlug as { name?: string })?.name).toBe('Test Product');

      const bySku = store.getByField('Product', 'sku', 'SKU-123');
      expect(bySku).toBeDefined();
      expect((bySku as { name?: string })?.name).toBe('Test Product');
    });

    it('should register indexes from user options', async () => {
      const pluginDir = join(testDir, 'user-indexed-plugin');
      mkdirSync(pluginDir, { recursive: true });

      const configPath = join(pluginDir, 'udl.config.js');

      writeFileSync(
        configPath,
        `
        export const config = {
          name: 'user-indexed-plugin',
          // No default indexes
        };

        export async function sourceNodes({ actions, createNodeId }) {
          await actions.createNode({
            internal: {
              id: createNodeId('Product', '1'),
              type: 'Product',
            },
            parent: undefined,
            children: undefined,
            name: 'User Product',
            customField: 'custom-value',
          });
        }
        `
      );

      // Load plugin with user-provided indexes option
      await loadPlugins(
        [
          {
            name: pluginDir,
            options: {
              indexes: ['customField'],
            },
          },
        ],
        { appConfig: {}, store }
      );

      // Verify user-provided index was registered
      const registeredIndexes = store.getRegisteredIndexes('Product');
      expect(registeredIndexes).toContain('customField');

      // Verify we can query by the custom indexed field
      const byCustomField = store.getByField(
        'Product',
        'customField',
        'custom-value'
      );
      expect(byCustomField).toBeDefined();
      expect((byCustomField as { name?: string })?.name).toBe('User Product');
    });

    it('should merge plugin default indexes with user-provided indexes', async () => {
      const pluginDir = join(testDir, 'merged-indexed-plugin');
      mkdirSync(pluginDir, { recursive: true });

      const configPath = join(pluginDir, 'udl.config.js');

      writeFileSync(
        configPath,
        `
        export const config = {
          name: 'merged-indexed-plugin',
          indexes: ['slug'], // Default index
        };

        export async function sourceNodes({ actions, createNodeId }) {
          await actions.createNode({
            internal: {
              id: createNodeId('Product', '1'),
              type: 'Product',
            },
            parent: undefined,
            children: undefined,
            name: 'Merged Product',
            slug: 'merged-product',
            sku: 'MERGE-123',
          });
        }
        `
      );

      // Load plugin with additional user indexes
      await loadPlugins(
        [
          {
            name: pluginDir,
            options: {
              indexes: ['sku'], // User adds another index
            },
          },
        ],
        { appConfig: {}, store }
      );

      // Verify both indexes are registered
      const registeredIndexes = store.getRegisteredIndexes('Product');
      expect(registeredIndexes).toContain('slug'); // From plugin default
      expect(registeredIndexes).toContain('sku'); // From user options

      // Verify we can query by both
      const bySlug = store.getByField('Product', 'slug', 'merged-product');
      expect(bySlug).toBeDefined();

      const bySku = store.getByField('Product', 'sku', 'MERGE-123');
      expect(bySku).toBeDefined();
    });

    it('should only register indexes for nodes created by the plugin', async () => {
      const plugin1Dir = join(testDir, 'plugin-1');
      const plugin2Dir = join(testDir, 'plugin-2');
      mkdirSync(plugin1Dir, { recursive: true });
      mkdirSync(plugin2Dir, { recursive: true });

      writeFileSync(
        join(plugin1Dir, 'udl.config.js'),
        `
        export const config = {
          name: 'plugin-1',
          indexes: ['slug'],
        };

        export async function sourceNodes({ actions, createNodeId }) {
          await actions.createNode({
            internal: {
              id: createNodeId('Product', '1'),
              type: 'Product',
            },
            parent: undefined,
            children: undefined,
            slug: 'product-1',
          });
        }
        `
      );

      writeFileSync(
        join(plugin2Dir, 'udl.config.js'),
        `
        export const config = {
          name: 'plugin-2',
          indexes: ['sku'],
        };

        export async function sourceNodes({ actions, createNodeId }) {
          await actions.createNode({
            internal: {
              id: createNodeId('Article', '1'),
              type: 'Article',
            },
            parent: undefined,
            children: undefined,
            sku: 'article-1',
          });
        }
        `
      );

      // Load both plugins
      await loadPlugins([plugin1Dir, plugin2Dir], { appConfig: {}, store });

      // Product should have 'slug' index (from plugin-1)
      const productIndexes = store.getRegisteredIndexes('Product');
      expect(productIndexes).toContain('slug');
      expect(productIndexes).not.toContain('sku');

      // Article should have 'sku' index (from plugin-2)
      const articleIndexes = store.getRegisteredIndexes('Article');
      expect(articleIndexes).toContain('sku');
      expect(articleIndexes).not.toContain('slug');
    });
  });
});
