import { describe, it, expect, beforeEach } from 'vitest';
import { NodeStore } from '@/nodes/store.js';
import {
  getNode,
  getNodes,
  getNodesByType,
  getAllNodeTypes,
  type NodePredicate,
} from '@/nodes/queries.js';
import type { Node } from '@/nodes/types.js';

describe('Node Queries', () => {
  let store: NodeStore;

  beforeEach(() => {
    store = new NodeStore();
  });

  describe('getNode', () => {
    it('should retrieve a node by ID', () => {
      const node: Node = {
        id: 'test-1',
        internal: {
          type: 'Test',
          contentDigest: 'abc123',
          owner: 'test-plugin',
          createdAt: Date.now(),
          modifiedAt: Date.now(),
        },
      };

      store.set(node);

      const result = getNode('test-1', store);
      expect(result).toEqual(node);
    });

    it('should return undefined for non-existent node', () => {
      const result = getNode('non-existent', store);
      expect(result).toBeUndefined();
    });

    it('should return undefined for empty store', () => {
      const result = getNode('any-id', store);
      expect(result).toBeUndefined();
    });

    it('should preserve type information with generics', () => {
      interface ProductNode extends Node {
        name: string;
        price: number;
      }

      const product: ProductNode = {
        id: 'product-1',
        internal: {
          type: 'Product',
          contentDigest: 'xyz789',
          owner: 'shop-plugin',
          createdAt: Date.now(),
          modifiedAt: Date.now(),
        },
        name: 'Widget',
        price: 29.99,
      };

      store.set(product);

      const result = getNode<ProductNode>('product-1', store);
      expect(result?.name).toBe('Widget');
      expect(result?.price).toBe(29.99);
    });
  });

  describe('getNodes', () => {
    it('should retrieve all nodes from store', () => {
      const node1: Node = {
        id: 'node-1',
        internal: {
          type: 'TypeA',
          contentDigest: 'hash1',
          owner: 'plugin1',
          createdAt: Date.now(),
          modifiedAt: Date.now(),
        },
      };

      const node2: Node = {
        id: 'node-2',
        internal: {
          type: 'TypeB',
          contentDigest: 'hash2',
          owner: 'plugin2',
          createdAt: Date.now(),
          modifiedAt: Date.now(),
        },
      };

      store.set(node1);
      store.set(node2);

      const results = getNodes(store);
      expect(results).toHaveLength(2);
      expect(results).toContainEqual(node1);
      expect(results).toContainEqual(node2);
    });

    it('should return empty array for empty store', () => {
      const results = getNodes(store);
      expect(results).toEqual([]);
    });

    it('should filter nodes with predicate', () => {
      const now = Date.now();
      const oldNode: Node = {
        id: 'old-1',
        internal: {
          type: 'Test',
          contentDigest: 'old',
          owner: 'plugin',
          createdAt: now - 1000000,
          modifiedAt: now - 1000000,
        },
      };

      const newNode: Node = {
        id: 'new-1',
        internal: {
          type: 'Test',
          contentDigest: 'new',
          owner: 'plugin',
          createdAt: now,
          modifiedAt: now,
        },
      };

      store.set(oldNode);
      store.set(newNode);

      const predicate: NodePredicate = (node) => {
        return node.internal.createdAt > now - 500000;
      };

      const results = getNodes(store, predicate);
      expect(results).toHaveLength(1);
      expect(results[0]).toEqual(newNode);
    });

    it('should return empty array when predicate matches nothing', () => {
      const node: Node = {
        id: 'node-1',
        internal: {
          type: 'Test',
          contentDigest: 'hash',
          owner: 'plugin',
          createdAt: Date.now(),
          modifiedAt: Date.now(),
        },
      };

      store.set(node);

      const predicate: NodePredicate = () => false;
      const results = getNodes(store, predicate);
      expect(results).toEqual([]);
    });

    it('should work with custom node types and predicates', () => {
      interface ProductNode extends Node {
        price: number;
      }

      const cheap: ProductNode = {
        id: 'prod-1',
        internal: {
          type: 'Product',
          contentDigest: 'h1',
          owner: 'shop',
          createdAt: Date.now(),
          modifiedAt: Date.now(),
        },
        price: 10,
      };

      const expensive: ProductNode = {
        id: 'prod-2',
        internal: {
          type: 'Product',
          contentDigest: 'h2',
          owner: 'shop',
          createdAt: Date.now(),
          modifiedAt: Date.now(),
        },
        price: 200,
      };

      store.set(cheap);
      store.set(expensive);

      const results = getNodes<ProductNode>(store, (node) => node.price > 100);
      expect(results).toHaveLength(1);
      expect(results[0]?.id).toBe('prod-2');
    });
  });

  describe('getNodesByType', () => {
    it('should retrieve nodes of specific type', () => {
      const product1: Node = {
        id: 'prod-1',
        internal: {
          type: 'Product',
          contentDigest: 'h1',
          owner: 'shop',
          createdAt: Date.now(),
          modifiedAt: Date.now(),
        },
      };

      const product2: Node = {
        id: 'prod-2',
        internal: {
          type: 'Product',
          contentDigest: 'h2',
          owner: 'shop',
          createdAt: Date.now(),
          modifiedAt: Date.now(),
        },
      };

      const post: Node = {
        id: 'post-1',
        internal: {
          type: 'BlogPost',
          contentDigest: 'h3',
          owner: 'cms',
          createdAt: Date.now(),
          modifiedAt: Date.now(),
        },
      };

      store.set(product1);
      store.set(product2);
      store.set(post);

      const products = getNodesByType('Product', store);
      expect(products).toHaveLength(2);
      expect(products).toContainEqual(product1);
      expect(products).toContainEqual(product2);
    });

    it('should return empty array for non-existent type', () => {
      const results = getNodesByType('NonExistent', store);
      expect(results).toEqual([]);
    });

    it('should return empty array for empty store', () => {
      const results = getNodesByType('AnyType', store);
      expect(results).toEqual([]);
    });

    it('should filter nodes by type with predicate', () => {
      interface ProductNode extends Node {
        category: string;
      }

      const electronics: ProductNode = {
        id: 'prod-1',
        internal: {
          type: 'Product',
          contentDigest: 'h1',
          owner: 'shop',
          createdAt: Date.now(),
          modifiedAt: Date.now(),
        },
        category: 'electronics',
      };

      const books: ProductNode = {
        id: 'prod-2',
        internal: {
          type: 'Product',
          contentDigest: 'h2',
          owner: 'shop',
          createdAt: Date.now(),
          modifiedAt: Date.now(),
        },
        category: 'books',
      };

      store.set(electronics);
      store.set(books);

      const results = getNodesByType<ProductNode>(
        'Product',
        store,
        (node) => node.category === 'electronics'
      );

      expect(results).toHaveLength(1);
      expect(results[0]?.id).toBe('prod-1');
    });

    it('should return empty array when predicate matches nothing', () => {
      const node: Node = {
        id: 'node-1',
        internal: {
          type: 'Test',
          contentDigest: 'hash',
          owner: 'plugin',
          createdAt: Date.now(),
          modifiedAt: Date.now(),
        },
      };

      store.set(node);

      const predicate: NodePredicate = () => false;
      const results = getNodesByType('Test', store, predicate);
      expect(results).toEqual([]);
    });

    it('should handle multiple types correctly', () => {
      const product: Node = {
        id: 'prod-1',
        internal: {
          type: 'Product',
          contentDigest: 'h1',
          owner: 'shop',
          createdAt: Date.now(),
          modifiedAt: Date.now(),
        },
      };

      const post: Node = {
        id: 'post-1',
        internal: {
          type: 'BlogPost',
          contentDigest: 'h2',
          owner: 'cms',
          createdAt: Date.now(),
          modifiedAt: Date.now(),
        },
      };

      store.set(product);
      store.set(post);

      const products = getNodesByType('Product', store);
      const posts = getNodesByType('BlogPost', store);

      expect(products).toHaveLength(1);
      expect(posts).toHaveLength(1);
      expect(products[0]?.id).toBe('prod-1');
      expect(posts[0]?.id).toBe('post-1');
    });
  });

  describe('getAllNodeTypes', () => {
    it('should return all registered node types', () => {
      const product: Node = {
        id: 'prod-1',
        internal: {
          type: 'Product',
          contentDigest: 'h1',
          owner: 'shop',
          createdAt: Date.now(),
          modifiedAt: Date.now(),
        },
      };

      const post: Node = {
        id: 'post-1',
        internal: {
          type: 'BlogPost',
          contentDigest: 'h2',
          owner: 'cms',
          createdAt: Date.now(),
          modifiedAt: Date.now(),
        },
      };

      const author: Node = {
        id: 'author-1',
        internal: {
          type: 'Author',
          contentDigest: 'h3',
          owner: 'cms',
          createdAt: Date.now(),
          modifiedAt: Date.now(),
        },
      };

      store.set(product);
      store.set(post);
      store.set(author);

      const types = getAllNodeTypes(store);
      expect(types).toHaveLength(3);
      expect(types).toContain('Product');
      expect(types).toContain('BlogPost');
      expect(types).toContain('Author');
    });

    it('should return empty array for empty store', () => {
      const types = getAllNodeTypes(store);
      expect(types).toEqual([]);
    });

    it('should return unique types even with multiple nodes of same type', () => {
      const product1: Node = {
        id: 'prod-1',
        internal: {
          type: 'Product',
          contentDigest: 'h1',
          owner: 'shop',
          createdAt: Date.now(),
          modifiedAt: Date.now(),
        },
      };

      const product2: Node = {
        id: 'prod-2',
        internal: {
          type: 'Product',
          contentDigest: 'h2',
          owner: 'shop',
          createdAt: Date.now(),
          modifiedAt: Date.now(),
        },
      };

      store.set(product1);
      store.set(product2);

      const types = getAllNodeTypes(store);
      expect(types).toEqual(['Product']);
    });
  });

  describe('Edge cases and performance', () => {
    it('should handle nodes with parent-child relationships', () => {
      const parent: Node = {
        id: 'parent-1',
        internal: {
          type: 'Parent',
          contentDigest: 'hp',
          owner: 'plugin',
          createdAt: Date.now(),
          modifiedAt: Date.now(),
        },
        children: ['child-1', 'child-2'],
      };

      const child1: Node = {
        id: 'child-1',
        internal: {
          type: 'Child',
          contentDigest: 'hc1',
          owner: 'plugin',
          createdAt: Date.now(),
          modifiedAt: Date.now(),
        },
        parent: 'parent-1',
      };

      const child2: Node = {
        id: 'child-2',
        internal: {
          type: 'Child',
          contentDigest: 'hc2',
          owner: 'plugin',
          createdAt: Date.now(),
          modifiedAt: Date.now(),
        },
        parent: 'parent-1',
      };

      store.set(parent);
      store.set(child1);
      store.set(child2);

      const parentNode = getNode('parent-1', store);
      const childNodes = getNodesByType('Child', store);

      expect(parentNode?.children).toEqual(['child-1', 'child-2']);
      expect(childNodes).toHaveLength(2);
      expect(childNodes.every((c) => c.parent === 'parent-1')).toBe(true);
    });

    it('should handle large number of nodes efficiently', () => {
      // Create 1000 nodes
      for (let i = 0; i < 1000; i++) {
        store.set({
          id: `node-${i}`,
          internal: {
            type: i % 10 === 0 ? 'TypeA' : 'TypeB',
            contentDigest: `hash-${i}`,
            owner: 'plugin',
            createdAt: Date.now(),
            modifiedAt: Date.now(),
          },
        });
      }

      // Should be fast - O(1) type bucket lookup
      const start = Date.now();
      const typeANodes = getNodesByType('TypeA', store);
      const elapsed = Date.now() - start;

      expect(typeANodes).toHaveLength(100);
      expect(elapsed).toBeLessThan(100); // Should be very fast
    });

    it('should handle nodes with additional custom fields', () => {
      interface CustomNode extends Node {
        customField: string;
        nested: {
          value: number;
        };
      }

      const custom: CustomNode = {
        id: 'custom-1',
        internal: {
          type: 'Custom',
          contentDigest: 'hc',
          owner: 'plugin',
          createdAt: Date.now(),
          modifiedAt: Date.now(),
        },
        customField: 'test',
        nested: {
          value: 42,
        },
      };

      store.set(custom);

      const result = getNode<CustomNode>('custom-1', store);
      expect(result?.customField).toBe('test');
      expect(result?.nested.value).toBe(42);
    });
  });
});
