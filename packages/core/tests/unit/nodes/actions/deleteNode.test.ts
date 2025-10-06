import { beforeEach, describe, expect, it } from 'vitest';
import { NodeStore } from '@/nodes/store.js';
import {
  createNode,
  deleteNode,
  type CreateNodeInput,
} from '@/nodes/actions/index.js';

describe('deleteNode', () => {
  let store: NodeStore;

  beforeEach(() => {
    store = new NodeStore();
  });

  describe('basic deletion', () => {
    it('deletes a node by ID string', async () => {
      const input: CreateNodeInput = {
        id: 'test-1',
        internal: {
          type: 'TestNode',
          owner: 'test-plugin',
        },
      };

      await createNode(input, { store });
      expect(store.has('test-1')).toBe(true);

      const deleted = await deleteNode('test-1', { store });

      expect(deleted).toBe(true);
      expect(store.has('test-1')).toBe(false);
      expect(store.get('test-1')).toBeUndefined();
    });

    it('deletes a node by node object', async () => {
      const input: CreateNodeInput = {
        id: 'test-1',
        internal: {
          type: 'TestNode',
          owner: 'test-plugin',
        },
      };

      const node = await createNode(input, { store });
      const deleted = await deleteNode(node, { store });

      expect(deleted).toBe(true);
      expect(store.has('test-1')).toBe(false);
    });

    it('deletes a node by object with id property', async () => {
      const input: CreateNodeInput = {
        id: 'test-1',
        internal: {
          type: 'TestNode',
          owner: 'test-plugin',
        },
      };

      await createNode(input, { store });
      const deleted = await deleteNode({ id: 'test-1' }, { store });

      expect(deleted).toBe(true);
      expect(store.has('test-1')).toBe(false);
    });

    it('returns false when deleting non-existent node', async () => {
      const deleted = await deleteNode('non-existent', { store });

      expect(deleted).toBe(false);
    });

    it('handles deleting same node twice gracefully', async () => {
      const input: CreateNodeInput = {
        id: 'test-1',
        internal: {
          type: 'TestNode',
          owner: 'test-plugin',
        },
      };

      await createNode(input, { store });

      const firstDelete = await deleteNode('test-1', { store });
      const secondDelete = await deleteNode('test-1', { store });

      expect(firstDelete).toBe(true);
      expect(secondDelete).toBe(false);
    });
  });

  describe('type index cleanup', () => {
    it('removes node from type index', async () => {
      const input: CreateNodeInput = {
        id: 'test-1',
        internal: {
          type: 'TestNode',
          owner: 'test-plugin',
        },
      };

      await createNode(input, { store });
      expect(store.getByType('TestNode')).toHaveLength(1);

      await deleteNode('test-1', { store });

      expect(store.getByType('TestNode')).toHaveLength(0);
    });

    it('removes type from type index when last node of type is deleted', async () => {
      const input: CreateNodeInput = {
        id: 'test-1',
        internal: {
          type: 'TestNode',
          owner: 'test-plugin',
        },
      };

      await createNode(input, { store });
      expect(store.getTypes()).toContain('TestNode');

      await deleteNode('test-1', { store });

      expect(store.getTypes()).not.toContain('TestNode');
    });

    it('maintains type index when deleting one of many nodes', async () => {
      const input1: CreateNodeInput = {
        id: 'test-1',
        internal: {
          type: 'TestNode',
          owner: 'test-plugin',
        },
      };
      const input2: CreateNodeInput = {
        id: 'test-2',
        internal: {
          type: 'TestNode',
          owner: 'test-plugin',
        },
      };

      await createNode(input1, { store });
      await createNode(input2, { store });
      expect(store.getByType('TestNode')).toHaveLength(2);

      await deleteNode('test-1', { store });

      expect(store.getByType('TestNode')).toHaveLength(1);
      expect(store.getTypes()).toContain('TestNode');
    });
  });

  describe('parent-child relationship cleanup', () => {
    it('removes node from parent children array', async () => {
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

      // Delete child
      await deleteNode('child-1', { store });

      const updatedParent = store.get('parent-1');
      expect(updatedParent?.children).not.toContain('child-1');
      expect(updatedParent?.children).toHaveLength(0);
    });

    it('handles deletion when parent has multiple children', async () => {
      // Create parent
      const parent: CreateNodeInput = {
        id: 'parent-1',
        internal: {
          type: 'Parent',
          owner: 'test-plugin',
        },
      };
      await createNode(parent, { store });

      // Create children
      const child1: CreateNodeInput = {
        id: 'child-1',
        internal: {
          type: 'Child',
          owner: 'test-plugin',
        },
        parent: 'parent-1',
      };
      const child2: CreateNodeInput = {
        id: 'child-2',
        internal: {
          type: 'Child',
          owner: 'test-plugin',
        },
        parent: 'parent-1',
      };
      await createNode(child1, { store });
      await createNode(child2, { store });

      // Delete one child
      await deleteNode('child-1', { store });

      const parentNode = store.get('parent-1');
      expect(parentNode?.children).not.toContain('child-1');
      expect(parentNode?.children).toContain('child-2');
      expect(parentNode?.children).toHaveLength(1);
    });

    it('handles deletion when parent does not exist', async () => {
      const child: CreateNodeInput = {
        id: 'child-1',
        internal: {
          type: 'Child',
          owner: 'test-plugin',
        },
        parent: 'non-existent-parent',
      };
      await createNode(child, { store });

      // Should not throw
      await expect(deleteNode('child-1', { store })).resolves.toBe(true);
    });

    it('removes parent reference from children when deleting without cascade', async () => {
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

      // Delete parent without cascade
      await deleteNode('parent-1', { store, cascade: false });

      // Child should still exist but have no parent
      const childNode = store.get('child-1');
      expect(childNode).toBeDefined();
      expect(childNode?.parent).toBeUndefined();
    });
  });

  describe('cascade deletion', () => {
    it('deletes all children when cascade is true', async () => {
      // Create parent
      const parent: CreateNodeInput = {
        id: 'parent-1',
        internal: {
          type: 'Parent',
          owner: 'test-plugin',
        },
      };
      await createNode(parent, { store });

      // Create children
      const child1: CreateNodeInput = {
        id: 'child-1',
        internal: {
          type: 'Child',
          owner: 'test-plugin',
        },
        parent: 'parent-1',
      };
      const child2: CreateNodeInput = {
        id: 'child-2',
        internal: {
          type: 'Child',
          owner: 'test-plugin',
        },
        parent: 'parent-1',
      };
      await createNode(child1, { store });
      await createNode(child2, { store });

      // Delete parent with cascade
      await deleteNode('parent-1', { store, cascade: true });

      expect(store.has('parent-1')).toBe(false);
      expect(store.has('child-1')).toBe(false);
      expect(store.has('child-2')).toBe(false);
    });

    it('cascades through multiple levels of hierarchy', async () => {
      // Create grandparent -> parent -> child hierarchy
      const grandparent: CreateNodeInput = {
        id: 'grandparent-1',
        internal: {
          type: 'Grandparent',
          owner: 'test-plugin',
        },
      };
      await createNode(grandparent, { store });

      const parent: CreateNodeInput = {
        id: 'parent-1',
        internal: {
          type: 'Parent',
          owner: 'test-plugin',
        },
        parent: 'grandparent-1',
      };
      await createNode(parent, { store });

      const child: CreateNodeInput = {
        id: 'child-1',
        internal: {
          type: 'Child',
          owner: 'test-plugin',
        },
        parent: 'parent-1',
      };
      await createNode(child, { store });

      // Delete grandparent with cascade
      await deleteNode('grandparent-1', { store, cascade: true });

      expect(store.has('grandparent-1')).toBe(false);
      expect(store.has('parent-1')).toBe(false);
      expect(store.has('child-1')).toBe(false);
    });

    it('does not delete children when cascade is false', async () => {
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

      // Delete parent without cascade
      await deleteNode('parent-1', { store, cascade: false });

      expect(store.has('parent-1')).toBe(false);
      expect(store.has('child-1')).toBe(true);
    });

    it('handles cascade when node has no children', async () => {
      const input: CreateNodeInput = {
        id: 'test-1',
        internal: {
          type: 'TestNode',
          owner: 'test-plugin',
        },
      };
      await createNode(input, { store });

      // Should not throw
      await expect(
        deleteNode('test-1', { store, cascade: true })
      ).resolves.toBe(true);
    });
  });

  describe('validation', () => {
    it('throws error for invalid input type', async () => {
      // @ts-expect-error Testing invalid input
      await expect(deleteNode(123, { store })).rejects.toThrow(
        'Invalid deleteNode input'
      );
    });

    it('throws error for null input', async () => {
      // @ts-expect-error Testing invalid input
      await expect(deleteNode(null, { store })).rejects.toThrow(
        'Invalid deleteNode input'
      );
    });

    it('throws error for undefined input', async () => {
      // @ts-expect-error Testing invalid input
      await expect(deleteNode(undefined, { store })).rejects.toThrow(
        'Invalid deleteNode input'
      );
    });
  });

  describe('edge cases', () => {
    it('handles deleting node with empty children array', async () => {
      const input: CreateNodeInput = {
        id: 'test-1',
        internal: {
          type: 'TestNode',
          owner: 'test-plugin',
        },
        children: [],
      };
      await createNode(input, { store });

      await expect(deleteNode('test-1', { store })).resolves.toBe(true);
    });

    it('correctly updates store size', async () => {
      const input1: CreateNodeInput = {
        id: 'test-1',
        internal: {
          type: 'TestNode',
          owner: 'test-plugin',
        },
      };
      const input2: CreateNodeInput = {
        id: 'test-2',
        internal: {
          type: 'TestNode',
          owner: 'test-plugin',
        },
      };

      await createNode(input1, { store });
      await createNode(input2, { store });
      expect(store.size()).toBe(2);

      await deleteNode('test-1', { store });
      expect(store.size()).toBe(1);

      await deleteNode('test-2', { store });
      expect(store.size()).toBe(0);
    });
  });

  describe('performance with many children', () => {
    it('efficiently deletes node with many children using cascade', async () => {
      // Create parent
      const parent: CreateNodeInput = {
        id: 'parent-1',
        internal: {
          type: 'Parent',
          owner: 'test-plugin',
        },
      };
      await createNode(parent, { store });

      // Create 100 children
      for (let i = 0; i < 100; i++) {
        const child: CreateNodeInput = {
          id: `child-${i}`,
          internal: {
            type: 'Child',
            owner: 'test-plugin',
          },
          parent: 'parent-1',
        };
        await createNode(child, { store });
      }

      expect(store.size()).toBe(101); // 1 parent + 100 children

      // Delete parent with cascade
      await deleteNode('parent-1', { store, cascade: true });

      expect(store.size()).toBe(0);
    });

    it('efficiently removes parent reference from many children without cascade', async () => {
      // Create parent
      const parent: CreateNodeInput = {
        id: 'parent-1',
        internal: {
          type: 'Parent',
          owner: 'test-plugin',
        },
      };
      await createNode(parent, { store });

      // Create 50 children
      for (let i = 0; i < 50; i++) {
        const child: CreateNodeInput = {
          id: `child-${i}`,
          internal: {
            type: 'Child',
            owner: 'test-plugin',
          },
          parent: 'parent-1',
        };
        await createNode(child, { store });
      }

      // Delete parent without cascade
      await deleteNode('parent-1', { store, cascade: false });

      expect(store.size()).toBe(50); // Children still exist
      expect(store.has('parent-1')).toBe(false);

      // All children should have undefined parent
      for (let i = 0; i < 50; i++) {
        const child = store.get(`child-${i}`);
        expect(child?.parent).toBeUndefined();
      }
    });
  });
});
