import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { loadConfigFile } from '@/loader.js';
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
            id: createNodeId('Product', 'test-1'),
            internal: {
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
            id: createNodeId('Config', 'settings'),
            internal: {
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
            id: id1,
            internal: { type: 'Product' },
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
            id: createNodeId('Product', '1'),
            internal: {
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
            id: createNodeId('Product', 'p1'),
            internal: { type: 'Product' },
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
            id: createNodeId('Product', 'p2'),
            internal: { type: 'Product' },
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
            id: createNodeId('Product', '1'),
            internal: { type: 'Product' },
            parent: undefined,
            children: undefined,
            name: 'Original',
            price: 100,
          });

          // Get the node
          const retrieved = actions.getNode(node.id);
          if (!retrieved) throw new Error('getNode failed');

          // Extend the node
          const extended = await actions.extendNode(node.id, {
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
          const deleted = await actions.deleteNode(node.id);
          if (!deleted) throw new Error('deleteNode failed');

          const afterDelete = actions.getNode(node.id);
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
            id: createNodeId('Product', '1'),
            internal: { type: 'Product' },
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
  });
});
