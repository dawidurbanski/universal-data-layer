import { describe, it, expect, beforeEach } from 'vitest';
import { NodeStore } from '@/nodes/store.js';
import type { Node } from '@/nodes/types.js';

describe('NodeStore', () => {
  let store: NodeStore;

  beforeEach(() => {
    store = new NodeStore();
  });

  describe('set and get', () => {
    it('should store and retrieve a node by ID', () => {
      const node: Node = {
        internal: {
          id: 'test-1',
          type: 'TestType',
          contentDigest: 'abc123',
          owner: 'test-plugin',
          createdAt: Date.now(),
          modifiedAt: Date.now(),
        },
      };

      store.set(node);
      const retrieved = store.get('test-1');

      expect(retrieved).toEqual(node);
    });

    it('should return undefined for non-existent node', () => {
      expect(store.get('non-existent')).toBeUndefined();
    });

    it('should update existing node when set with same ID', () => {
      const node1: Node = {
        internal: {
          id: 'test-1',
          type: 'TestType',
          contentDigest: 'abc123',
          owner: 'test-plugin',
          createdAt: Date.now(),
          modifiedAt: Date.now(),
        },
      };

      const node2: Node = {
        internal: {
          id: 'test-1',
          type: 'TestType',
          contentDigest: 'xyz789',
          owner: 'test-plugin',
          createdAt: Date.now(),
          modifiedAt: Date.now(),
        },
      };

      store.set(node1);
      store.set(node2);

      const retrieved = store.get('test-1');
      expect(retrieved?.internal.contentDigest).toBe('xyz789');
    });
  });

  describe('getByType', () => {
    it('should retrieve all nodes of a specific type', () => {
      const product1: Node = {
        internal: {
          id: 'product-1',
          type: 'Product',
          contentDigest: 'abc',
          owner: 'shop-plugin',
          createdAt: Date.now(),
          modifiedAt: Date.now(),
        },
      };

      const product2: Node = {
        internal: {
          id: 'product-2',
          type: 'Product',
          contentDigest: 'def',
          owner: 'shop-plugin',
          createdAt: Date.now(),
          modifiedAt: Date.now(),
        },
      };

      const post: Node = {
        internal: {
          id: 'post-1',
          type: 'BlogPost',
          contentDigest: 'ghi',
          owner: 'cms-plugin',
          createdAt: Date.now(),
          modifiedAt: Date.now(),
        },
      };

      store.set(product1);
      store.set(product2);
      store.set(post);

      const products = store.getByType('Product');
      expect(products).toHaveLength(2);
      expect(products).toContainEqual(product1);
      expect(products).toContainEqual(product2);
    });

    it('should return empty array for non-existent type', () => {
      expect(store.getByType('NonExistent')).toEqual([]);
    });

    it('should return empty array when store is empty', () => {
      expect(store.getByType('AnyType')).toEqual([]);
    });
  });

  describe('getAll', () => {
    it('should return all nodes', () => {
      const node1: Node = {
        internal: {
          id: 'node-1',
          type: 'Type1',
          contentDigest: 'abc',
          owner: 'plugin1',
          createdAt: Date.now(),
          modifiedAt: Date.now(),
        },
      };

      const node2: Node = {
        internal: {
          id: 'node-2',
          type: 'Type2',
          contentDigest: 'def',
          owner: 'plugin2',
          createdAt: Date.now(),
          modifiedAt: Date.now(),
        },
      };

      store.set(node1);
      store.set(node2);

      const all = store.getAll();
      expect(all).toHaveLength(2);
      expect(all).toContainEqual(node1);
      expect(all).toContainEqual(node2);
    });

    it('should return empty array when store is empty', () => {
      expect(store.getAll()).toEqual([]);
    });
  });

  describe('getTypes', () => {
    it('should return all registered node types', () => {
      const node1: Node = {
        internal: {
          id: 'node-1',
          type: 'Product',
          contentDigest: 'abc',
          owner: 'plugin1',
          createdAt: Date.now(),
          modifiedAt: Date.now(),
        },
      };

      const node2: Node = {
        internal: {
          id: 'node-2',
          type: 'BlogPost',
          contentDigest: 'def',
          owner: 'plugin2',
          createdAt: Date.now(),
          modifiedAt: Date.now(),
        },
      };

      store.set(node1);
      store.set(node2);

      const types = store.getTypes();
      expect(types).toHaveLength(2);
      expect(types).toContain('Product');
      expect(types).toContain('BlogPost');
    });

    it('should return empty array when store is empty', () => {
      expect(store.getTypes()).toEqual([]);
    });

    it('should not duplicate types when multiple nodes of same type exist', () => {
      const node1: Node = {
        internal: {
          id: 'node-1',
          type: 'Product',
          contentDigest: 'abc',
          owner: 'plugin',
          createdAt: Date.now(),
          modifiedAt: Date.now(),
        },
      };

      const node2: Node = {
        internal: {
          id: 'node-2',
          type: 'Product',
          contentDigest: 'def',
          owner: 'plugin',
          createdAt: Date.now(),
          modifiedAt: Date.now(),
        },
      };

      store.set(node1);
      store.set(node2);

      const types = store.getTypes();
      expect(types).toEqual(['Product']);
    });
  });

  describe('countByType', () => {
    it('should return correct count for a type', () => {
      const node1: Node = {
        internal: {
          id: 'node-1',
          type: 'Product',
          contentDigest: 'abc',
          owner: 'plugin',
          createdAt: Date.now(),
          modifiedAt: Date.now(),
        },
      };

      const node2: Node = {
        internal: {
          id: 'node-2',
          type: 'Product',
          contentDigest: 'def',
          owner: 'plugin',
          createdAt: Date.now(),
          modifiedAt: Date.now(),
        },
      };

      store.set(node1);
      store.set(node2);

      expect(store.countByType('Product')).toBe(2);
    });

    it('should return 0 for non-existent type', () => {
      expect(store.countByType('NonExistent')).toBe(0);
    });
  });

  describe('delete', () => {
    it('should delete a node and return true', () => {
      const node: Node = {
        internal: {
          id: 'test-1',
          type: 'TestType',
          contentDigest: 'abc123',
          owner: 'test-plugin',
          createdAt: Date.now(),
          modifiedAt: Date.now(),
        },
      };

      store.set(node);
      const deleted = store.delete('test-1');

      expect(deleted).toBe(true);
      expect(store.get('test-1')).toBeUndefined();
    });

    it('should return false when deleting non-existent node', () => {
      expect(store.delete('non-existent')).toBe(false);
    });

    it('should remove node from type index', () => {
      const node: Node = {
        internal: {
          id: 'test-1',
          type: 'TestType',
          contentDigest: 'abc123',
          owner: 'test-plugin',
          createdAt: Date.now(),
          modifiedAt: Date.now(),
        },
      };

      store.set(node);
      store.delete('test-1');

      expect(store.getByType('TestType')).toEqual([]);
      expect(store.getTypes()).toEqual([]);
    });

    it('should clean up type index when last node of type is deleted', () => {
      const node1: Node = {
        internal: {
          id: 'node-1',
          type: 'Product',
          contentDigest: 'abc',
          owner: 'plugin',
          createdAt: Date.now(),
          modifiedAt: Date.now(),
        },
      };

      const node2: Node = {
        internal: {
          id: 'node-2',
          type: 'Product',
          contentDigest: 'def',
          owner: 'plugin',
          createdAt: Date.now(),
          modifiedAt: Date.now(),
        },
      };

      store.set(node1);
      store.set(node2);
      store.delete('node-1');

      expect(store.getTypes()).toContain('Product');
      expect(store.countByType('Product')).toBe(1);

      store.delete('node-2');
      expect(store.getTypes()).not.toContain('Product');
      expect(store.countByType('Product')).toBe(0);
    });
  });

  describe('has', () => {
    it('should return true if node exists', () => {
      const node: Node = {
        internal: {
          id: 'test-1',
          type: 'TestType',
          contentDigest: 'abc123',
          owner: 'test-plugin',
          createdAt: Date.now(),
          modifiedAt: Date.now(),
        },
      };

      store.set(node);
      expect(store.has('test-1')).toBe(true);
    });

    it('should return false if node does not exist', () => {
      expect(store.has('non-existent')).toBe(false);
    });
  });

  describe('size', () => {
    it('should return 0 for empty store', () => {
      expect(store.size()).toBe(0);
    });

    it('should return correct count of nodes', () => {
      const node1: Node = {
        internal: {
          id: 'node-1',
          type: 'Type1',
          contentDigest: 'abc',
          owner: 'plugin',
          createdAt: Date.now(),
          modifiedAt: Date.now(),
        },
      };

      const node2: Node = {
        internal: {
          id: 'node-2',
          type: 'Type2',
          contentDigest: 'def',
          owner: 'plugin',
          createdAt: Date.now(),
          modifiedAt: Date.now(),
        },
      };

      store.set(node1);
      expect(store.size()).toBe(1);

      store.set(node2);
      expect(store.size()).toBe(2);
    });

    it('should not increase when updating existing node', () => {
      const node1: Node = {
        internal: {
          id: 'node-1',
          type: 'Type1',
          contentDigest: 'abc',
          owner: 'plugin',
          createdAt: Date.now(),
          modifiedAt: Date.now(),
        },
      };

      const node2: Node = {
        internal: {
          id: 'node-1',
          type: 'Type1',
          contentDigest: 'xyz',
          owner: 'plugin',
          createdAt: Date.now(),
          modifiedAt: Date.now(),
        },
      };

      store.set(node1);
      store.set(node2);
      expect(store.size()).toBe(1);
    });
  });

  describe('clear', () => {
    it('should remove all nodes', () => {
      const node1: Node = {
        internal: {
          id: 'node-1',
          type: 'Type1',
          contentDigest: 'abc',
          owner: 'plugin',
          createdAt: Date.now(),
          modifiedAt: Date.now(),
        },
      };

      const node2: Node = {
        internal: {
          id: 'node-2',
          type: 'Type2',
          contentDigest: 'def',
          owner: 'plugin',
          createdAt: Date.now(),
          modifiedAt: Date.now(),
        },
      };

      store.set(node1);
      store.set(node2);
      store.clear();

      expect(store.size()).toBe(0);
      expect(store.getAll()).toEqual([]);
      expect(store.getTypes()).toEqual([]);
    });

    it('should be safe to call on empty store', () => {
      expect(() => store.clear()).not.toThrow();
      expect(store.size()).toBe(0);
    });
  });

  describe('type index consistency', () => {
    it('should maintain type index when updating node with same type', () => {
      const node1: Node = {
        internal: {
          id: 'node-1',
          type: 'Product',
          contentDigest: 'abc',
          owner: 'plugin',
          createdAt: Date.now(),
          modifiedAt: Date.now(),
        },
      };

      const node2: Node = {
        internal: {
          id: 'node-1',
          type: 'Product',
          contentDigest: 'xyz',
          owner: 'plugin',
          createdAt: Date.now(),
          modifiedAt: Date.now(),
        },
      };

      store.set(node1);
      store.set(node2);

      expect(store.countByType('Product')).toBe(1);
      expect(store.getByType('Product')).toHaveLength(1);
    });

    it('should update type index when changing node type', () => {
      const node1: Node = {
        internal: {
          id: 'node-1',
          type: 'Product',
          contentDigest: 'abc',
          owner: 'plugin',
          createdAt: Date.now(),
          modifiedAt: Date.now(),
        },
      };

      const node2: Node = {
        internal: {
          id: 'node-1',
          type: 'BlogPost',
          contentDigest: 'xyz',
          owner: 'plugin',
          createdAt: Date.now(),
          modifiedAt: Date.now(),
        },
      };

      store.set(node1);
      expect(store.countByType('Product')).toBe(1);
      expect(store.countByType('BlogPost')).toBe(0);

      store.set(node2);
      expect(store.countByType('Product')).toBe(1);
      expect(store.countByType('BlogPost')).toBe(1);
    });
  });

  describe('field indexing', () => {
    it('should register an index for a field', () => {
      const node: Node = {
        internal: {
          id: 'product-1',
          type: 'Product',
          contentDigest: 'abc',
          owner: 'test',
          createdAt: Date.now(),
          modifiedAt: Date.now(),
        },
        slug: 'test-product',
      } as Node;

      store.set(node);
      store.registerIndex('Product', 'slug');

      const registeredIndexes = store.getRegisteredIndexes('Product');
      expect(registeredIndexes).toContain('slug');
    });

    it('should retrieve node by indexed field', () => {
      const node: Node = {
        internal: {
          id: 'product-1',
          type: 'Product',
          contentDigest: 'abc',
          owner: 'test',
          createdAt: Date.now(),
          modifiedAt: Date.now(),
        },
        slug: 'wireless-headphones',
      } as Node;

      store.set(node);
      store.registerIndex('Product', 'slug');

      const retrieved = store.getByField(
        'Product',
        'slug',
        'wireless-headphones'
      );
      expect(retrieved).toEqual(node);
    });

    it('should return undefined for non-existent field value', () => {
      store.registerIndex('Product', 'slug');
      const retrieved = store.getByField('Product', 'slug', 'non-existent');
      expect(retrieved).toBeUndefined();
    });

    it('should update field index when node is updated', () => {
      const node1: Node = {
        internal: {
          id: 'product-1',
          type: 'Product',
          contentDigest: 'abc',
          owner: 'test',
          createdAt: Date.now(),
          modifiedAt: Date.now(),
        },
        slug: 'old-slug',
      } as Node;

      store.set(node1);
      store.registerIndex('Product', 'slug');

      const node2: Node = {
        internal: {
          id: 'product-1',
          type: 'Product',
          contentDigest: 'xyz',
          owner: 'test',
          createdAt: Date.now(),
          modifiedAt: Date.now(),
        },
        slug: 'new-slug',
      } as Node;

      store.set(node2);

      expect(store.getByField('Product', 'slug', 'old-slug')).toBeUndefined();
      expect(store.getByField('Product', 'slug', 'new-slug')).toEqual(node2);
    });

    it('should clean up field index on node deletion', () => {
      const node: Node = {
        internal: {
          id: 'product-1',
          type: 'Product',
          contentDigest: 'abc',
          owner: 'test',
          createdAt: Date.now(),
          modifiedAt: Date.now(),
        },
        slug: 'test-slug',
      } as Node;

      store.set(node);
      store.registerIndex('Product', 'slug');

      expect(store.getByField('Product', 'slug', 'test-slug')).toEqual(node);

      store.delete('product-1');

      expect(store.getByField('Product', 'slug', 'test-slug')).toBeUndefined();
    });

    it('should index existing nodes when registering a new index', () => {
      const node1: Node = {
        internal: {
          id: 'product-1',
          type: 'Product',
          contentDigest: 'abc',
          owner: 'test',
          createdAt: Date.now(),
          modifiedAt: Date.now(),
        },
        slug: 'product-one',
      } as Node;

      const node2: Node = {
        internal: {
          id: 'product-2',
          type: 'Product',
          contentDigest: 'def',
          owner: 'test',
          createdAt: Date.now(),
          modifiedAt: Date.now(),
        },
        slug: 'product-two',
      } as Node;

      store.set(node1);
      store.set(node2);

      // Register index after nodes already exist
      store.registerIndex('Product', 'slug');

      expect(store.getByField('Product', 'slug', 'product-one')).toEqual(node1);
      expect(store.getByField('Product', 'slug', 'product-two')).toEqual(node2);
    });

    it('should handle multiple indexes on same node type', () => {
      const node: Node = {
        internal: {
          id: 'product-1',
          type: 'Product',
          contentDigest: 'abc',
          owner: 'test',
          createdAt: Date.now(),
          modifiedAt: Date.now(),
        },
        slug: 'test-product',
        sku: 'SKU-123',
      } as Node;

      store.set(node);
      store.registerIndex('Product', 'slug');
      store.registerIndex('Product', 'sku');

      expect(store.getByField('Product', 'slug', 'test-product')).toEqual(node);
      expect(store.getByField('Product', 'sku', 'SKU-123')).toEqual(node);
    });

    it('should clear field indexes on store.clear()', () => {
      const node: Node = {
        internal: {
          id: 'product-1',
          type: 'Product',
          contentDigest: 'abc',
          owner: 'test',
          createdAt: Date.now(),
          modifiedAt: Date.now(),
        },
        slug: 'test-product',
      } as Node;

      store.set(node);
      store.registerIndex('Product', 'slug');

      expect(store.getByField('Product', 'slug', 'test-product')).toEqual(node);

      store.clear();

      expect(
        store.getByField('Product', 'slug', 'test-product')
      ).toBeUndefined();
      expect(store.getRegisteredIndexes('Product')).toEqual([]);
    });
  });

  describe('performance with large datasets', () => {
    it('should handle 10000 nodes efficiently', () => {
      const startTime = Date.now();

      // Insert 10000 nodes
      for (let i = 0; i < 10000; i++) {
        const node: Node = {
          internal: {
            id: `node-${i}`,
            type: `Type${i % 10}`, // 10 different types
            contentDigest: `digest-${i}`,
            owner: 'test-plugin',
            createdAt: Date.now(),
            modifiedAt: Date.now(),
          },
        };
        store.set(node);
      }

      const insertTime = Date.now() - startTime;

      // Verify lookups are fast
      const lookupStart = Date.now();
      expect(store.get('node-5000')).toBeDefined();
      expect(store.getByType('Type5')).toHaveLength(1000);
      const lookupTime = Date.now() - lookupStart;

      expect(store.size()).toBe(10000);
      expect(insertTime).toBeLessThan(1000); // Should insert 10k nodes in < 1s
      expect(lookupTime).toBeLessThan(100); // Lookups should be very fast
    });
  });
});
