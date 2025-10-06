import type { Node } from '@/nodes/types.js';
import type { NodeStore } from '@/nodes/store.js';

/**
 * Predicate function for filtering nodes
 */
export type NodePredicate<T extends Node = Node> = (node: T) => boolean;

/**
 * Retrieves a single node by ID
 *
 * @param id - The node ID to retrieve
 * @param store - The node store to query from
 * @returns The node if found, undefined otherwise
 *
 * @example
 * ```ts
 * const store = new NodeStore();
 * const product = getNode('product-123', store);
 * ```
 */
export function getNode<T extends Node = Node>(
  id: string,
  store: NodeStore
): T | undefined {
  return store.get(id) as T | undefined;
}

/**
 * Retrieves all nodes from the store
 *
 * @param store - The node store to query from
 * @param predicate - Optional filter function to apply to results
 * @returns Array of all nodes (or filtered nodes if predicate provided)
 *
 * @example
 * ```ts
 * const store = new NodeStore();
 *
 * // Get all nodes
 * const allNodes = getNodes(store);
 *
 * // Get nodes with filter
 * const recentNodes = getNodes(store, (node) => {
 *   return node.internal.createdAt > Date.now() - 86400000;
 * });
 * ```
 */
export function getNodes<T extends Node = Node>(
  store: NodeStore,
  predicate?: NodePredicate<T>
): T[] {
  const nodes = store.getAll() as T[];

  if (predicate) {
    return nodes.filter(predicate);
  }

  return nodes;
}

/**
 * Retrieves all nodes of a specific type
 *
 * @param type - The node type to filter by
 * @param store - The node store to query from
 * @param predicate - Optional filter function to apply to results
 * @returns Array of nodes of the specified type (empty array if none found)
 *
 * @example
 * ```ts
 * const store = new NodeStore();
 *
 * // Get all Product nodes
 * const products = getNodesByType('Product', store);
 *
 * // Get expensive products only
 * const expensiveProducts = getNodesByType('Product', store, (node) => {
 *   return node.price > 100;
 * });
 * ```
 */
export function getNodesByType<T extends Node = Node>(
  type: string,
  store: NodeStore,
  predicate?: NodePredicate<T>
): T[] {
  const nodes = store.getByType(type) as T[];

  if (predicate) {
    return nodes.filter(predicate);
  }

  return nodes;
}

/**
 * Gets a list of all registered node types in the store
 *
 * @param store - The node store to query from
 * @returns Array of unique node type names
 *
 * @example
 * ```ts
 * const store = new NodeStore();
 * const types = getAllNodeTypes(store);
 * // => ['Product', 'BlogPost', 'Author']
 * ```
 */
export function getAllNodeTypes(store: NodeStore): string[] {
  return store.getTypes();
}
