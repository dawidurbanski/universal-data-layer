import type { Node } from '@/nodes/types.js';
import type { NodeStore } from '@/nodes/store.js';
import type { DeletionLog } from '@/sync/index.js';
import { emitNodeChange } from '@/nodes/events.js';

/**
 * Input for deleting a node - accepts either a node object or node ID
 */
export type DeleteNodeInput = string | Node | { internal: { id: string } };

/**
 * Options for deleteNode function
 */
export interface DeleteNodeOptions {
  /** The node store to use */
  store: NodeStore;
  /** Whether to cascade delete all children (default: false) */
  cascade?: boolean;
  /** Optional deletion log to record deletions for partial sync */
  deletionLog?: DeletionLog;
}

/**
 * Deletes a node from the node store
 *
 * - Accepts node object, node ID string, or object with internal.id property
 * - Removes node from primary and type indexes
 * - Updates parent's children array if node has a parent
 * - Optionally cascade deletes all children
 * - Handles non-existent nodes gracefully (returns false)
 * - Returns true if deletion occurred, false otherwise
 *
 * @param input - Node, node ID, or object with internal.id to delete
 * @param options - Configuration including NodeStore instance and cascade option
 *
 * @example
 * ```ts
 * const store = new NodeStore();
 *
 * // Delete by ID
 * const deleted = await deleteNode('product-123', { store });
 *
 * // Delete by node object
 * const node = store.get('product-123');
 * await deleteNode(node, { store });
 *
 * // Delete with cascade
 * await deleteNode('parent-1', { store, cascade: true });
 * ```
 */
export async function deleteNode(
  input: DeleteNodeInput,
  options: DeleteNodeOptions
): Promise<boolean> {
  const { store, cascade = false, deletionLog } = options;

  // Validate input type
  if (input === null || input === undefined) {
    throw new Error(
      'Invalid deleteNode input: must be string, Node, or object with internal.id'
    );
  }

  // Extract node ID from input
  let nodeId: string;
  if (typeof input === 'string') {
    nodeId = input;
  } else if (typeof input === 'object' && 'internal' in input) {
    nodeId = input.internal.id;
  } else {
    throw new Error(
      'Invalid deleteNode input: must be string, Node, or object with internal.id'
    );
  }

  // Get the node from store
  const node = store.get(nodeId);
  if (!node) {
    // Node doesn't exist, return false gracefully
    return false;
  }

  // Cascade delete children if requested
  if (cascade && node.children && node.children.length > 0) {
    // Create copy of children array to avoid mutation during iteration
    const childrenToDelete = [...node.children];
    for (const childId of childrenToDelete) {
      const childOptions: DeleteNodeOptions = { store, cascade: true };
      if (deletionLog) {
        childOptions.deletionLog = deletionLog;
      }
      await deleteNode(childId, childOptions);
    }
  } else if (node.children && node.children.length > 0) {
    // Remove parent reference from children if not cascading
    for (const childId of node.children) {
      const child = store.get(childId);
      if (child && child.parent === nodeId) {
        // Update child to remove parent reference
        delete child.parent;
        store.set(child);
      }
    }
  }

  // Remove this node from parent's children array
  if (node.parent) {
    const parent = store.get(node.parent);
    if (parent && parent.children) {
      parent.children = parent.children.filter((id) => id !== nodeId);
      store.set(parent);
    }
  }

  // Record deletion before removing from store
  deletionLog?.recordDeletion(node);

  // Emit node deleted event before removing from store
  emitNodeChange({
    type: 'node:deleted',
    nodeId: node.internal.id,
    nodeType: node.internal.type,
    node: null,
    timestamp: new Date().toISOString(),
  });

  // Delete the node from store
  return store.delete(nodeId);
}
