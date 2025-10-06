export {
  createNode,
  type CreateNodeInput,
  type CreateNodeOptions,
} from './createNode.js';

export {
  deleteNode,
  type DeleteNodeInput,
  type DeleteNodeOptions,
} from './deleteNode.js';

export {
  extendNode,
  type ExtendNodeData,
  type ExtendNodeOptions,
} from './extendNode.js';

import type { Node } from '@/nodes/types.js';
import type { NodeStore } from '@/nodes/store.js';
import type { CreateNodeInput } from './createNode.js';
import type { DeleteNodeInput, DeleteNodeOptions } from './deleteNode.js';
import type { ExtendNodeData, ExtendNodeOptions } from './extendNode.js';
import type { NodePredicate } from '@/nodes/queries.js';
import { createNode } from './createNode.js';
import { deleteNode } from './deleteNode.js';
import { extendNode } from './extendNode.js';
import { getNode, getNodes, getNodesByType } from '@/nodes/queries.js';

/**
 * Bundle of all node manipulation actions provided to plugins
 * Used in the sourceNodes lifecycle hook context
 */
export interface NodeActions {
  /**
   * Create or update a node in the store
   */
  createNode: (input: CreateNodeInput) => Promise<Node>;

  /**
   * Delete a node from the store
   */
  deleteNode: (
    input: DeleteNodeInput,
    options?: Omit<DeleteNodeOptions, 'store'>
  ) => Promise<boolean>;

  /**
   * Extend an existing node with additional fields
   */
  extendNode: <T extends Node = Node>(
    nodeId: string,
    data: ExtendNodeData,
    options?: Omit<ExtendNodeOptions, 'store'>
  ) => Promise<T>;

  /**
   * Get a single node by ID
   */
  getNode: <T extends Node = Node>(id: string) => T | undefined;

  /**
   * Get all nodes, optionally filtered by predicate
   */
  getNodes: <T extends Node = Node>(predicate?: NodePredicate<T>) => T[];

  /**
   * Get all nodes of a specific type, optionally filtered by predicate
   */
  getNodesByType: <T extends Node = Node>(
    type: string,
    predicate?: NodePredicate<T>
  ) => T[];
}

/**
 * Creates a NodeActions object bound to a specific store and owner
 * This ensures actions automatically track which plugin created which nodes
 *
 * @param store - The node store to use for all operations
 * @param owner - The plugin name that owns these actions
 * @returns NodeActions bound to the provided store and owner
 */
export function createNodeActions(
  store: NodeStore,
  owner: string
): NodeActions {
  return {
    createNode: (input: CreateNodeInput) => createNode(input, { store, owner }),

    deleteNode: (
      input: DeleteNodeInput,
      options?: Omit<DeleteNodeOptions, 'store'>
    ) => deleteNode(input, { store, ...options }),

    extendNode: (nodeId: string, data: ExtendNodeData, options?) =>
      extendNode(nodeId, data, { store, ...options }),

    getNode: (id: string) => getNode(id, store),

    getNodes: (predicate?) => getNodes(store, predicate),

    getNodesByType: (type: string, predicate?) =>
      getNodesByType(type, store, predicate),
  };
}
