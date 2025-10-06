/**
 * Main barrel export for the nodes system
 * Provides all node types, actions, queries, and utilities
 */

// Types
export type { Node, NodeInternal } from './types.js';

// Store
export { NodeStore } from './store.js';
export { defaultStore, setDefaultStore } from './defaultStore.js';

// Actions
export {
  createNode,
  deleteNode,
  extendNode,
  createNodeActions,
  type NodeActions,
  type CreateNodeInput,
  type CreateNodeOptions,
  type DeleteNodeInput,
  type DeleteNodeOptions,
  type ExtendNodeData,
  type ExtendNodeOptions,
} from './actions/index.js';

// Queries
export {
  getNode,
  getNodes,
  getNodesByType,
  getAllNodeTypes,
  type NodePredicate,
} from './queries.js';

// Utilities
export { createNodeId, createContentDigest } from './utils/index.js';

// Context for sourceNodes hook
import type { NodeActions } from './actions/index.js';

/**
 * Context passed to the sourceNodes lifecycle hook
 * Provides all tools needed for plugins to source data
 */
export interface SourceNodesContext<T = Record<string, unknown>> {
  /** Bundle of node manipulation actions */
  actions: NodeActions;
  /** Helper to create deterministic node IDs */
  createNodeId: (...args: string[]) => string;
  /** Helper to create content digests for change detection */
  createContentDigest: (data: unknown) => string;
  /** Plugin-specific options passed from the config */
  options?: T;
}
