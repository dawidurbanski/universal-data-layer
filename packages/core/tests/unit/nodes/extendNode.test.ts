import { describe, it, expect, beforeEach } from 'vitest';
import { NodeStore } from '@/nodes/store.js';
import { createNode } from '@/nodes/actions/createNode.js';
import { extendNode } from '@/nodes/actions/extendNode.js';
import type { Node } from '@/nodes/types.js';

describe('extendNode', () => {
  let store: NodeStore;

  beforeEach(() => {
    store = new NodeStore();
  });

  describe('basic extension', () => {
    it('should extend node with new fields', async () => {
      // Create a base node
      await createNode(
        {
          internal: { id: 'product-1', type: 'Product', owner: 'test' },
          name: 'Widget',
          price: 100,
        },
        { store }
      );

      // Extend with new fields
      const extended = await extendNode(
        'product-1',
        {
          category: 'electronics',
          inStock: true,
        },
        { store }
      );

      expect(extended).toMatchObject({
        internal: {
          id: 'product-1',
        },
        name: 'Widget',
        price: 100,
        category: 'electronics',
        inStock: true,
      });
    });

    it('should overwrite existing fields with new values', async () => {
      // Create a base node
      await createNode(
        {
          internal: { id: 'product-1', type: 'Product', owner: 'test' },
          name: 'Widget',
          price: 100,
        },
        { store }
      );

      // Extend with field that overwrites existing value
      const extended = await extendNode(
        'product-1',
        {
          price: 150,
        },
        { store }
      );

      expect((extended as Node & { price: number }).price).toBe(150);
    });

    it('should return the extended node', async () => {
      await createNode(
        {
          internal: { id: 'product-1', type: 'Product', owner: 'test' },
          name: 'Widget',
        },
        { store }
      );

      const extended = await extendNode(
        'product-1',
        { category: 'gadgets' },
        { store }
      );

      expect(extended.internal.id).toBe('product-1');
      expect(extended).toHaveProperty('category', 'gadgets');
    });

    it('should persist changes to the store', async () => {
      await createNode(
        {
          internal: { id: 'product-1', type: 'Product', owner: 'test' },
          name: 'Widget',
        },
        { store }
      );

      await extendNode('product-1', { category: 'gadgets' }, { store });

      const retrieved = store.get('product-1') as Node & { category: string };
      expect(retrieved.category).toBe('gadgets');
    });
  });

  describe('shallow merge behavior', () => {
    it('should replace nested objects entirely (shallow merge)', async () => {
      await createNode(
        {
          internal: { id: 'product-1', type: 'Product', owner: 'test' },
          metadata: { color: 'red', size: 'large' },
        },
        { store }
      );

      const extended = await extendNode(
        'product-1',
        {
          metadata: { weight: 100 },
        },
        { store }
      );

      // Original metadata fields should be replaced, not merged
      const extendedTyped = extended as Node & {
        metadata: { color?: string; size?: string; weight?: number };
      };
      expect(extendedTyped.metadata).toEqual({ weight: 100 });
      expect(extendedTyped.metadata.color).toBeUndefined();
      expect(extendedTyped.metadata.size).toBeUndefined();
    });
  });

  describe('protected fields', () => {
    it('should prevent overwriting internal field', async () => {
      await createNode(
        {
          internal: { id: 'product-1', type: 'Product', owner: 'test' },
        },
        { store }
      );

      await expect(
        extendNode(
          'product-1',
          { internal: { type: 'NewType', owner: 'hacker' } } as never,
          { store }
        )
      ).rejects.toThrow('protected fields: internal');
    });

    it('should prevent overwriting parent field', async () => {
      await createNode(
        {
          internal: { id: 'product-1', type: 'Product', owner: 'test' },
        },
        { store }
      );

      await expect(
        extendNode('product-1', { parent: 'some-parent' } as never, { store })
      ).rejects.toThrow('protected fields: parent');
    });

    it('should prevent overwriting children field', async () => {
      await createNode(
        {
          internal: { id: 'product-1', type: 'Product', owner: 'test' },
        },
        { store }
      );

      await expect(
        extendNode('product-1', { children: ['child-1'] } as never, { store })
      ).rejects.toThrow('protected fields: children');
    });

    it('should prevent overwriting multiple protected fields', async () => {
      await createNode(
        {
          internal: { id: 'product-1', type: 'Product', owner: 'test' },
        },
        { store }
      );

      await expect(
        extendNode(
          'product-1',
          {
            parent: 'some-parent',
            internal: { type: 'NewType', owner: 'hacker' },
          } as never,
          { store }
        )
      ).rejects.toThrow('protected fields');
    });
  });

  describe('contentDigest and timestamps', () => {
    it('should update contentDigest after extension', async () => {
      const original = await createNode(
        {
          internal: { id: 'product-1', type: 'Product', owner: 'test' },
          name: 'Widget',
        },
        { store }
      );

      const originalDigest = original.internal.contentDigest;

      const extended = await extendNode(
        'product-1',
        { category: 'gadgets' },
        { store }
      );

      expect(extended.internal.contentDigest).not.toBe(originalDigest);
    });

    it('should update modifiedAt timestamp', async () => {
      const original = await createNode(
        {
          internal: { id: 'product-1', type: 'Product', owner: 'test' },
        },
        { store }
      );

      const originalModifiedAt = original.internal.modifiedAt;

      // Wait a tiny bit to ensure timestamp changes
      await new Promise((resolve) => setTimeout(resolve, 5));

      const extended = await extendNode(
        'product-1',
        { category: 'gadgets' },
        { store }
      );

      expect(extended.internal.modifiedAt).toBeGreaterThan(originalModifiedAt);
    });

    it('should preserve createdAt timestamp', async () => {
      const original = await createNode(
        {
          internal: { id: 'product-1', type: 'Product', owner: 'test' },
        },
        { store }
      );

      const originalCreatedAt = original.internal.createdAt;

      const extended = await extendNode(
        'product-1',
        { category: 'gadgets' },
        { store }
      );

      expect(extended.internal.createdAt).toBe(originalCreatedAt);
    });

    it('should preserve owner', async () => {
      await createNode(
        {
          internal: { id: 'product-1', type: 'Product', owner: 'shopify' },
        },
        { store }
      );

      const extended = await extendNode(
        'product-1',
        { category: 'gadgets' },
        { store }
      );

      expect(extended.internal.owner).toBe('shopify');
    });

    it('should preserve type', async () => {
      await createNode(
        {
          internal: { id: 'product-1', type: 'Product', owner: 'test' },
        },
        { store }
      );

      const extended = await extendNode(
        'product-1',
        { category: 'gadgets' },
        { store }
      );

      expect(extended.internal.type).toBe('Product');
    });
  });

  describe('error handling', () => {
    it('should throw error if node does not exist', async () => {
      await expect(
        extendNode('non-existent', { field: 'value' }, { store })
      ).rejects.toThrow('Node with id "non-existent" not found');
    });

    it('should throw error with helpful message for missing node', async () => {
      await expect(
        extendNode('product-999', { category: 'gadgets' }, { store })
      ).rejects.toThrow('Cannot extend node');
    });
  });

  describe('parent-child relationships', () => {
    it('should preserve parent relationship', async () => {
      await createNode(
        {
          internal: { id: 'parent-1', type: 'Category', owner: 'test' },
        },
        { store }
      );

      await createNode(
        {
          internal: { id: 'product-1', type: 'Product', owner: 'test' },
          parent: 'parent-1',
        },
        { store }
      );

      const extended = await extendNode(
        'product-1',
        { category: 'gadgets' },
        { store }
      );

      expect(extended.parent).toBe('parent-1');
    });

    it('should preserve children array', async () => {
      await createNode(
        {
          internal: { id: 'parent-1', type: 'Category', owner: 'test' },
        },
        { store }
      );

      await createNode(
        {
          internal: { id: 'product-1', type: 'Product', owner: 'test' },
          parent: 'parent-1',
        },
        { store }
      );

      const extended = await extendNode(
        'parent-1',
        { description: 'A category' },
        { store }
      );

      expect(extended.children).toEqual(['product-1']);
    });
  });

  describe('complex extension scenarios', () => {
    it('should handle extending with computed fields', async () => {
      await createNode(
        {
          internal: { id: 'product-1', type: 'Product', owner: 'test' },
          price: 150,
        },
        { store }
      );

      const extended = await extendNode(
        'product-1',
        {
          priceCategory: 'expensive',
          discountedPrice: 120,
        },
        { store }
      );

      const extendedTyped = extended as Node & {
        price: number;
        priceCategory: string;
        discountedPrice: number;
      };

      expect(extendedTyped.price).toBe(150);
      expect(extendedTyped.priceCategory).toBe('expensive');
      expect(extendedTyped.discountedPrice).toBe(120);
    });

    it('should handle multiple sequential extensions', async () => {
      await createNode(
        {
          internal: { id: 'product-1', type: 'Product', owner: 'test' },
          name: 'Widget',
        },
        { store }
      );

      await extendNode('product-1', { category: 'electronics' }, { store });
      await extendNode('product-1', { inStock: true }, { store });
      const final = await extendNode('product-1', { price: 100 }, { store });

      const finalTyped = final as Node & {
        name: string;
        category: string;
        inStock: boolean;
        price: number;
      };

      expect(finalTyped.name).toBe('Widget');
      expect(finalTyped.category).toBe('electronics');
      expect(finalTyped.inStock).toBe(true);
      expect(finalTyped.price).toBe(100);
    });

    it('should handle extending with array fields', async () => {
      await createNode(
        {
          internal: { id: 'product-1', type: 'Product', owner: 'test' },
        },
        { store }
      );

      const extended = await extendNode(
        'product-1',
        {
          tags: ['electronics', 'gadgets', 'popular'],
        },
        { store }
      );

      const extendedTyped = extended as Node & { tags: string[] };
      expect(extendedTyped.tags).toEqual(['electronics', 'gadgets', 'popular']);
    });

    it('should handle extending with null and undefined values', async () => {
      await createNode(
        {
          internal: { id: 'product-1', type: 'Product', owner: 'test' },
          description: 'Original description',
        },
        { store }
      );

      const extended = await extendNode(
        'product-1',
        {
          description: null,
          notes: undefined,
        },
        { store }
      );

      const extendedTyped = extended as Node & {
        description: null;
        notes: undefined;
      };
      expect(extendedTyped.description).toBeNull();
      expect(extendedTyped.notes).toBeUndefined();
    });

    it('should handle empty extension object', async () => {
      const original = await createNode(
        {
          internal: { id: 'product-1', type: 'Product', owner: 'test' },
          name: 'Widget',
        },
        { store }
      );

      const extended = await extendNode('product-1', {}, { store });

      // Should still update timestamps and digest even with empty extension
      expect(extended.internal.id).toBe(original.internal.id);
      expect(extended.internal.modifiedAt).toBeGreaterThanOrEqual(
        original.internal.modifiedAt
      );
    });
  });
});
