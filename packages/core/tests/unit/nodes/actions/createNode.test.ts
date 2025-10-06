import { beforeEach, describe, expect, it } from 'vitest';
import { NodeStore } from '@/nodes/store.js';
import { createNode, type CreateNodeInput } from '@/nodes/actions/index.js';

describe('createNode', () => {
  let store: NodeStore;

  beforeEach(() => {
    store = new NodeStore();
  });

  describe('basic node creation', () => {
    it('creates a simple node with required fields', async () => {
      const input: CreateNodeInput = {
        id: 'test-1',
        internal: {
          type: 'TestNode',
          owner: 'test-plugin',
        },
      };

      const node = await createNode(input, { store });

      expect(node.id).toBe('test-1');
      expect(node.internal.type).toBe('TestNode');
      expect(node.internal.owner).toBe('test-plugin');
      expect(node.internal.contentDigest).toBeTruthy();
      expect(node.internal.createdAt).toBeTruthy();
      expect(node.internal.modifiedAt).toBeTruthy();
    });

    it('stores the node in the NodeStore', async () => {
      const input: CreateNodeInput = {
        id: 'test-1',
        internal: {
          type: 'TestNode',
          owner: 'test-plugin',
        },
      };

      await createNode(input, { store });

      const storedNode = store.get('test-1');
      expect(storedNode).toBeDefined();
      expect(storedNode?.id).toBe('test-1');
    });

    it('creates node with custom data fields', async () => {
      const input: CreateNodeInput = {
        id: 'product-1',
        internal: {
          type: 'Product',
          owner: 'shopify',
        },
        name: 'Widget',
        price: 29.99,
        category: 'gadgets',
      } as CreateNodeInput;

      const node = await createNode(input, { store });

      expect(node).toMatchObject({
        id: 'product-1',
        name: 'Widget',
        price: 29.99,
        category: 'gadgets',
      });
    });
  });

  describe('validation', () => {
    it('throws error when id is missing', async () => {
      const input = {
        internal: {
          type: 'TestNode',
          owner: 'test-plugin',
        },
      } as CreateNodeInput;

      await expect(createNode(input, { store })).rejects.toThrow(
        'Node id is required'
      );
    });

    it('throws error when internal.type is missing', async () => {
      const input = {
        id: 'test-1',
        internal: {
          owner: 'test-plugin',
        },
      } as CreateNodeInput;

      await expect(createNode(input, { store })).rejects.toThrow(
        'Node internal.type is required'
      );
    });
  });

  describe('content digest', () => {
    it('auto-generates contentDigest if not provided', async () => {
      const input: CreateNodeInput = {
        id: 'test-1',
        internal: {
          type: 'TestNode',
          owner: 'test-plugin',
        },
      };

      const node = await createNode(input, { store });

      expect(node.internal.contentDigest).toBeTruthy();
      expect(node.internal.contentDigest).toHaveLength(64); // SHA-256
    });

    it('uses provided contentDigest if given', async () => {
      const customDigest = 'custom-digest-123';
      const input: CreateNodeInput = {
        id: 'test-1',
        internal: {
          type: 'TestNode',
          owner: 'test-plugin',
          contentDigest: customDigest,
        },
      };

      const node = await createNode(input, { store });

      expect(node.internal.contentDigest).toBe(customDigest);
    });

    it('creates different digests for different data', async () => {
      const input1: CreateNodeInput = {
        id: 'test-1',
        internal: { type: 'TestNode', owner: 'test-plugin' },
        data: 'value1',
      } as CreateNodeInput;

      const input2: CreateNodeInput = {
        id: 'test-2',
        internal: { type: 'TestNode', owner: 'test-plugin' },
        data: 'value2',
      } as CreateNodeInput;

      const node1 = await createNode(input1, { store });
      const node2 = await createNode(input2, { store });

      expect(node1.internal.contentDigest).not.toBe(
        node2.internal.contentDigest
      );
    });
  });

  describe('timestamps', () => {
    it('sets createdAt and modifiedAt on first creation', async () => {
      const input: CreateNodeInput = {
        id: 'test-1',
        internal: {
          type: 'TestNode',
          owner: 'test-plugin',
        },
      };

      const node = await createNode(input, { store });

      expect(node.internal.createdAt).toBeTruthy();
      expect(node.internal.modifiedAt).toBeTruthy();
      expect(typeof node.internal.createdAt).toBe('number');
      expect(typeof node.internal.modifiedAt).toBe('number');
    });

    it('preserves createdAt but updates modifiedAt on update', async () => {
      const input: CreateNodeInput = {
        id: 'test-1',
        internal: {
          type: 'TestNode',
          owner: 'test-plugin',
        },
        data: 'original',
      } as CreateNodeInput;

      const node1 = await createNode(input, { store });
      const originalCreatedAt = node1.internal.createdAt;

      // Wait a bit to ensure different timestamp
      await new Promise((resolve) => setTimeout(resolve, 10));

      const updatedInput: CreateNodeInput = {
        id: 'test-1',
        internal: {
          type: 'TestNode',
          owner: 'test-plugin',
        },
        data: 'updated',
      } as CreateNodeInput;

      const node2 = await createNode(updatedInput, { store });

      expect(node2.internal.createdAt).toBe(originalCreatedAt);
      expect(node2.internal.modifiedAt).toBeGreaterThan(
        node1.internal.modifiedAt
      );
    });

    it('uses provided timestamps if given', async () => {
      const customCreatedAt = 1000000;
      const customModifiedAt = 2000000;

      const input: CreateNodeInput = {
        id: 'test-1',
        internal: {
          type: 'TestNode',
          owner: 'test-plugin',
          createdAt: customCreatedAt,
          modifiedAt: customModifiedAt,
        },
      };

      const node = await createNode(input, { store });

      expect(node.internal.createdAt).toBe(customCreatedAt);
      expect(node.internal.modifiedAt).toBe(customModifiedAt);
    });
  });

  describe('owner tracking', () => {
    it('uses owner from input', async () => {
      const input: CreateNodeInput = {
        id: 'test-1',
        internal: {
          type: 'TestNode',
          owner: 'my-plugin',
        },
      };

      const node = await createNode(input, { store });

      expect(node.internal.owner).toBe('my-plugin');
    });

    it('uses owner from options if provided', async () => {
      const input: CreateNodeInput = {
        id: 'test-1',
        internal: {
          type: 'TestNode',
          owner: 'input-owner',
        },
      };

      const node = await createNode(input, { store, owner: 'options-owner' });

      expect(node.internal.owner).toBe('options-owner');
    });

    it('prefers options owner over input owner', async () => {
      const input: CreateNodeInput = {
        id: 'test-1',
        internal: {
          type: 'TestNode',
          owner: 'input-owner',
        },
      };

      const node = await createNode(input, {
        store,
        owner: 'bound-owner',
      });

      expect(node.internal.owner).toBe('bound-owner');
    });
  });

  describe('parent-child relationships', () => {
    it('adds node ID to parent children array', async () => {
      // Create parent
      const parent: CreateNodeInput = {
        id: 'parent-1',
        internal: {
          type: 'Parent',
          owner: 'test-plugin',
        },
      };

      await createNode(parent, { store });

      // Create child
      const child: CreateNodeInput = {
        id: 'child-1',
        internal: {
          type: 'Child',
          owner: 'test-plugin',
        },
        parent: 'parent-1',
      };

      await createNode(child, { store });

      const parentNode = store.get('parent-1');
      expect(parentNode?.children).toContain('child-1');
    });

    it('does not duplicate child IDs in parent children array', async () => {
      // Create parent
      const parent: CreateNodeInput = {
        id: 'parent-1',
        internal: {
          type: 'Parent',
          owner: 'test-plugin',
        },
      };

      await createNode(parent, { store });

      // Create child
      const child: CreateNodeInput = {
        id: 'child-1',
        internal: {
          type: 'Child',
          owner: 'test-plugin',
        },
        parent: 'parent-1',
      };

      await createNode(child, { store });
      await createNode(child, { store }); // Create again

      const parentNode = store.get('parent-1');
      expect(parentNode?.children).toEqual(['child-1']); // Only once
    });

    it('updates parent when child parent changes', async () => {
      // Create two parents
      const parent1: CreateNodeInput = {
        id: 'parent-1',
        internal: { type: 'Parent', owner: 'test-plugin' },
      };
      const parent2: CreateNodeInput = {
        id: 'parent-2',
        internal: { type: 'Parent', owner: 'test-plugin' },
      };

      await createNode(parent1, { store });
      await createNode(parent2, { store });

      // Create child with parent-1
      const child: CreateNodeInput = {
        id: 'child-1',
        internal: { type: 'Child', owner: 'test-plugin' },
        parent: 'parent-1',
      };

      await createNode(child, { store });

      // Update child to have parent-2
      const updatedChild: CreateNodeInput = {
        id: 'child-1',
        internal: { type: 'Child', owner: 'test-plugin' },
        parent: 'parent-2',
      };

      await createNode(updatedChild, { store });

      const oldParent = store.get('parent-1');
      const newParent = store.get('parent-2');

      expect(oldParent?.children).not.toContain('child-1');
      expect(newParent?.children).toContain('child-1');
    });

    it('handles parent that does not exist gracefully', async () => {
      const child: CreateNodeInput = {
        id: 'child-1',
        internal: {
          type: 'Child',
          owner: 'test-plugin',
        },
        parent: 'non-existent-parent',
      };

      // Should not throw
      await expect(createNode(child, { store })).resolves.toBeDefined();
    });
  });

  describe('node updates', () => {
    it('fully replaces existing node', async () => {
      const original: CreateNodeInput = {
        id: 'test-1',
        internal: { type: 'TestNode', owner: 'test-plugin' },
        name: 'Original',
        price: 100,
      } as CreateNodeInput;

      await createNode(original, { store });

      const updated: CreateNodeInput = {
        id: 'test-1',
        internal: { type: 'TestNode', owner: 'test-plugin' },
        name: 'Updated',
      } as CreateNodeInput;

      await createNode(updated, { store });

      const node = store.get('test-1');
      expect(node).toMatchObject({
        id: 'test-1',
        name: 'Updated',
      });
      // price should not exist in updated node
      expect(node).not.toHaveProperty('price');
    });

    it('maintains type index on update', async () => {
      const input: CreateNodeInput = {
        id: 'test-1',
        internal: { type: 'TestNode', owner: 'test-plugin' },
      };

      await createNode(input, { store });
      await createNode(input, { store }); // Update

      const nodes = store.getByType('TestNode');
      expect(nodes).toHaveLength(1);
      expect(nodes[0]?.id).toBe('test-1');
    });
  });
});
