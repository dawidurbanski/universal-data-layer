import type { Node } from '@/nodes/types.js';
import type { NodeStore } from '@/nodes/store.js';
import type { CreateNodeInput, CreateNodeOptions } from './createNode.js';
import type { DeleteNodeInput, DeleteNodeOptions } from './deleteNode.js';
import type { ExtendNodeData, ExtendNodeOptions } from './extendNode.js';
import type { NodePredicate } from '@/nodes/queries.js';
import type { DeletionLog } from '@/sync/index.js';
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
   *
   * @param input - Node data to create
   * @param options - Optional settings including schema hints for code generation
   *
   * @example
   * ```ts
   * import { s } from 'universal-data-layer';
   *
   * await actions.createNode(data, {
   *   schema: s.infer().override({
   *     status: s.enum(['pending', 'completed']),
   *   }),
   * });
   * ```
   */
  createNode: (
    input: CreateNodeInput,
    options?: Omit<CreateNodeOptions, 'store' | 'owner'>
  ) => Promise<Node>;

  /**
   * Delete a node from the store
   */
  deleteNode: (
    input: DeleteNodeInput,
    options?: Omit<DeleteNodeOptions, 'store' | 'deletionLog'>
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
 * Options for creating node actions
 */
export interface CreateNodeActionsOptions {
  /** The node store to use for all operations */
  store: NodeStore;
  /** The plugin name that owns these actions */
  owner: string;
  /** Optional deletion log for tracking deletions */
  deletionLog?: DeletionLog;
}

/**
 * Creates a NodeActions object bound to a specific store and owner
 * This ensures actions automatically track which plugin created which nodes
 *
 * @param options - Configuration including store, owner, and optional deletionLog
 * @returns NodeActions bound to the provided store and owner
 */
export function createNodeActions(
  options: CreateNodeActionsOptions
): NodeActions {
  const { store, owner, deletionLog } = options;

  return {
    createNode: (
      input: CreateNodeInput,
      createOptions?: Omit<CreateNodeOptions, 'store' | 'owner'>
    ) => createNode(input, { store, owner, ...createOptions }),

    deleteNode: (
      input: DeleteNodeInput,
      deleteOptions?: Omit<DeleteNodeOptions, 'store' | 'deletionLog'>
    ) => {
      const opts: DeleteNodeOptions = { store, ...deleteOptions };
      if (deletionLog) {
        opts.deletionLog = deletionLog;
      }
      return deleteNode(input, opts);
    },

    extendNode: (nodeId: string, data: ExtendNodeData, options?) =>
      extendNode(nodeId, data, { store, ...options }),

    getNode: (id: string) => getNode(id, store),

    getNodes: (predicate?) => getNodes(store, predicate),

    getNodesByType: (type: string, predicate?) =>
      getNodesByType(type, store, predicate),
  };
}
