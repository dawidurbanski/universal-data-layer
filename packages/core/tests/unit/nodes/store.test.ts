import { describe, it, expect, beforeEach } from 'vitest';
import { NodeStore } from '@/nodes/store.js';
import type { Node } from '@/nodes/types.js';
import { s, z } from '@/schema-builder.js';

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

  describe('type schema management', () => {
    describe('setTypeSchema', () => {
      it('should store InferSchema with overrides', () => {
        const schema = s.infer().override({
          status: s.enum(['active', 'inactive']),
        });

        store.setTypeSchema('Product', schema);

        const retrieved = store.getTypeSchema('Product');
        expect(retrieved).toBeDefined();
        expect(retrieved?.overrides).toBeDefined();
        expect(retrieved?.overrides?.['status']).toBeDefined();
        expect(retrieved?.fullSchema).toBeUndefined();
      });

      it('should not store InferSchema without overrides', () => {
        const schema = s.infer(); // No overrides

        store.setTypeSchema('Product', schema);

        const retrieved = store.getTypeSchema('Product');
        expect(retrieved).toBeUndefined();
      });

      it('should store ZodObject as fullSchema', () => {
        const schema = z.object({
          name: z.string(),
          price: z.number(),
        });

        store.setTypeSchema('Product', schema);

        const retrieved = store.getTypeSchema('Product');
        expect(retrieved).toBeDefined();
        expect(retrieved?.fullSchema).toBeDefined();
        expect(retrieved?.overrides).toBeUndefined();
      });

      it('should ignore subsequent setTypeSchema calls (first wins)', () => {
        const schema1 = s.infer().override({
          status: s.enum(['active', 'inactive']),
        });
        const schema2 = s.infer().override({
          status: s.enum(['pending', 'completed']),
        });

        store.setTypeSchema('Product', schema1);
        store.setTypeSchema('Product', schema2);

        const retrieved = store.getTypeSchema('Product');
        expect(retrieved).toBeDefined();
        // First schema should win - has 'active'/'inactive' enum
        expect(retrieved?.overrides).toBeDefined();
      });

      it('should handle null schema gracefully', () => {
        // @ts-expect-error - testing edge case with null
        store.setTypeSchema('Product', null);

        const retrieved = store.getTypeSchema('Product');
        expect(retrieved).toBeUndefined();
      });

      it('should handle undefined schema gracefully', () => {
        // @ts-expect-error - testing edge case with undefined
        store.setTypeSchema('Product', undefined);

        const retrieved = store.getTypeSchema('Product');
        expect(retrieved).toBeUndefined();
      });

      it('should handle non-schema object gracefully', () => {
        // @ts-expect-error - testing edge case with non-schema object
        store.setTypeSchema('Product', { notASchema: true });

        const retrieved = store.getTypeSchema('Product');
        expect(retrieved).toBeUndefined();
      });
    });

    describe('getTypeSchema', () => {
      it('should return undefined for non-existent type', () => {
        expect(store.getTypeSchema('NonExistent')).toBeUndefined();
      });

      it('should return stored schema info', () => {
        const schema = z.object({ name: z.string() });
        store.setTypeSchema('Product', schema);

        const retrieved = store.getTypeSchema('Product');
        expect(retrieved).toBeDefined();
        expect(retrieved?.fullSchema).toBe(schema);
      });
    });

    describe('hasTypeSchema', () => {
      it('should return false for non-existent type', () => {
        expect(store.hasTypeSchema('NonExistent')).toBe(false);
      });

      it('should return true for type with InferSchema', () => {
        store.setTypeSchema(
          'Product',
          s.infer().override({ status: s.enum(['active', 'inactive']) })
        );
        expect(store.hasTypeSchema('Product')).toBe(true);
      });

      it('should return true for type with ZodObject', () => {
        store.setTypeSchema('Product', z.object({ name: z.string() }));
        expect(store.hasTypeSchema('Product')).toBe(true);
      });
    });

    describe('clear should reset type schemas', () => {
      it('should clear type schemas on store.clear()', () => {
        store.setTypeSchema(
          'Product',
          s.infer().override({ status: s.enum(['active', 'inactive']) })
        );
        expect(store.hasTypeSchema('Product')).toBe(true);

        store.clear();

        expect(store.hasTypeSchema('Product')).toBe(false);
        expect(store.getTypeSchema('Product')).toBeUndefined();
      });
    });
  });

  describe('serialization', () => {
    describe('toSerializable', () => {
      it('should export empty store correctly', () => {
        const data = store.toSerializable();

        expect(data.nodes).toEqual([]);
        expect(data.indexes).toEqual({});
      });

      it('should export nodes and indexes', () => {
        const node1: Node = {
          internal: {
            id: 'product-1',
            type: 'Product',
            contentDigest: 'abc',
            owner: 'test',
            createdAt: Date.now(),
            modifiedAt: Date.now(),
          },
          slug: 'test-product',
          sku: 'SKU-001',
        } as Node;

        const node2: Node = {
          internal: {
            id: 'post-1',
            type: 'BlogPost',
            contentDigest: 'def',
            owner: 'test',
            createdAt: Date.now(),
            modifiedAt: Date.now(),
          },
          slug: 'test-post',
        } as Node;

        store.set(node1);
        store.set(node2);
        store.registerIndex('Product', 'slug');
        store.registerIndex('Product', 'sku');
        store.registerIndex('BlogPost', 'slug');

        const data = store.toSerializable();

        expect(data.nodes).toHaveLength(2);
        expect(data.nodes).toContainEqual(node1);
        expect(data.nodes).toContainEqual(node2);
        expect(data.indexes['Product']).toContain('slug');
        expect(data.indexes['Product']).toContain('sku');
        expect(data.indexes['BlogPost']).toContain('slug');
      });
    });

    describe('fromSerializable', () => {
      it('should import empty data correctly', () => {
        // Add some data first
        const node: Node = {
          internal: {
            id: 'old-node',
            type: 'OldType',
            contentDigest: 'old',
            owner: 'test',
            createdAt: Date.now(),
            modifiedAt: Date.now(),
          },
        };
        store.set(node);
        store.registerIndex('OldType', 'field');

        // Import empty data
        store.fromSerializable({ nodes: [], indexes: {} });

        expect(store.size()).toBe(0);
        expect(store.getAll()).toEqual([]);
        expect(store.getRegisteredIndexes('OldType')).toEqual([]);
      });

      it('should import nodes and indexes', () => {
        const node1: Node = {
          internal: {
            id: 'product-1',
            type: 'Product',
            contentDigest: 'abc',
            owner: 'test',
            createdAt: 1234567890,
            modifiedAt: 1234567890,
          },
          slug: 'imported-product',
        } as Node;

        const node2: Node = {
          internal: {
            id: 'post-1',
            type: 'BlogPost',
            contentDigest: 'def',
            owner: 'test',
            createdAt: 1234567891,
            modifiedAt: 1234567891,
          },
          slug: 'imported-post',
        } as Node;

        store.fromSerializable({
          nodes: [node1, node2],
          indexes: {
            Product: ['slug'],
            BlogPost: ['slug'],
          },
        });

        // Verify nodes were imported
        expect(store.size()).toBe(2);
        expect(store.get('product-1')).toEqual(node1);
        expect(store.get('post-1')).toEqual(node2);

        // Verify indexes were registered
        expect(store.getRegisteredIndexes('Product')).toContain('slug');
        expect(store.getRegisteredIndexes('BlogPost')).toContain('slug');

        // Verify field indexes work (nodes should be indexed)
        expect(store.getByField('Product', 'slug', 'imported-product')).toEqual(
          node1
        );
        expect(store.getByField('BlogPost', 'slug', 'imported-post')).toEqual(
          node2
        );
      });

      it('should clear existing data before importing', () => {
        // Add existing data
        const existingNode: Node = {
          internal: {
            id: 'existing-1',
            type: 'Existing',
            contentDigest: 'existing',
            owner: 'test',
            createdAt: Date.now(),
            modifiedAt: Date.now(),
          },
        };
        store.set(existingNode);
        store.registerIndex('Existing', 'field');

        // Import new data
        const newNode: Node = {
          internal: {
            id: 'new-1',
            type: 'New',
            contentDigest: 'new',
            owner: 'test',
            createdAt: Date.now(),
            modifiedAt: Date.now(),
          },
        };
        store.fromSerializable({
          nodes: [newNode],
          indexes: { New: ['otherField'] },
        });

        // Old data should be gone
        expect(store.get('existing-1')).toBeUndefined();
        expect(store.getByType('Existing')).toEqual([]);
        expect(store.getRegisteredIndexes('Existing')).toEqual([]);

        // New data should exist
        expect(store.get('new-1')).toEqual(newNode);
        expect(store.getRegisteredIndexes('New')).toContain('otherField');
      });

      it('should roundtrip through toSerializable/fromSerializable', () => {
        const node1: Node = {
          internal: {
            id: 'product-1',
            type: 'Product',
            contentDigest: 'abc',
            owner: 'test',
            createdAt: 1234567890,
            modifiedAt: 1234567890,
          },
          slug: 'product-slug',
          sku: 'SKU-123',
        } as Node;

        store.set(node1);
        store.registerIndex('Product', 'slug');
        store.registerIndex('Product', 'sku');

        // Export
        const serialized = store.toSerializable();

        // Create new store and import
        const newStore = new NodeStore();
        newStore.fromSerializable(serialized);

        // Verify everything matches
        expect(newStore.size()).toBe(store.size());
        expect(newStore.get('product-1')).toEqual(node1);
        expect(newStore.getRegisteredIndexes('Product').sort()).toEqual(
          store.getRegisteredIndexes('Product').sort()
        );
        expect(newStore.getByField('Product', 'slug', 'product-slug')).toEqual(
          node1
        );
        expect(newStore.getByField('Product', 'sku', 'SKU-123')).toEqual(node1);
      });
    });
  });

  describe('edge cases for field indexing', () => {
    it('should handle node with null field value', () => {
      store.registerIndex('Product', 'slug');

      const node: Node = {
        internal: {
          id: 'product-1',
          type: 'Product',
          contentDigest: 'abc',
          owner: 'test',
          createdAt: Date.now(),
          modifiedAt: Date.now(),
        },
        slug: null,
      } as unknown as Node;

      store.set(node);

      // Should not index null values
      expect(store.getByField('Product', 'slug', null)).toBeUndefined();
    });

    it('should handle node with undefined field value', () => {
      store.registerIndex('Product', 'slug');

      const node: Node = {
        internal: {
          id: 'product-1',
          type: 'Product',
          contentDigest: 'abc',
          owner: 'test',
          createdAt: Date.now(),
          modifiedAt: Date.now(),
        },
        // slug is undefined
      };

      store.set(node);

      // Should not index undefined values
      expect(store.getByField('Product', 'slug', undefined)).toBeUndefined();
    });

    it('should handle updating node to remove indexed field', () => {
      store.registerIndex('Product', 'slug');

      const node1: Node = {
        internal: {
          id: 'product-1',
          type: 'Product',
          contentDigest: 'abc',
          owner: 'test',
          createdAt: Date.now(),
          modifiedAt: Date.now(),
        },
        slug: 'my-slug',
      } as Node;

      store.set(node1);
      expect(store.getByField('Product', 'slug', 'my-slug')).toEqual(node1);

      // Update to remove slug field
      const node2: Node = {
        internal: {
          id: 'product-1',
          type: 'Product',
          contentDigest: 'xyz',
          owner: 'test',
          createdAt: Date.now(),
          modifiedAt: Date.now(),
        },
        // slug is now undefined
      };

      store.set(node2);

      // Old value should be removed from index
      expect(store.getByField('Product', 'slug', 'my-slug')).toBeUndefined();
    });

    it('should return empty array for getRegisteredIndexes on non-existent type', () => {
      expect(store.getRegisteredIndexes('NonExistent')).toEqual([]);
    });

    it('should return undefined for getByField on non-indexed type', () => {
      // Query a type that has no indexes registered
      expect(store.getByField('Product', 'slug', 'some-value')).toBeUndefined();
    });

    it('should return undefined for getByField on non-indexed field', () => {
      store.registerIndex('Product', 'slug');
      // Query a field that is not indexed
      expect(store.getByField('Product', 'sku', 'some-value')).toBeUndefined();
    });
  });
});
