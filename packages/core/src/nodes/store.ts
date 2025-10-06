import type { Node } from './types.js';

/**
 * In-memory node storage using Map-based indexes
 * Provides O(1) lookups by ID and O(1) type bucket access
 *
 * @example
 * ```ts
 * const store = new NodeStore();
 *
 * // Add a node
 * store.set(myNode);
 *
 * // Get by ID
 * const node = store.get('node-123');
 *
 * // Get all nodes of a type
 * const products = store.getByType('Product');
 *
 * // Clear for testing
 * store.clear();
 * ```
 */
export class NodeStore {
  /** Primary index: node ID -> node */
  private nodes: Map<string, Node>;

  /** Secondary index: node type -> Set of node IDs */
  private typeIndex: Map<string, Set<string>>;

  constructor() {
    this.nodes = new Map();
    this.typeIndex = new Map();
  }

  /**
   * Store or update a node
   * Maintains both primary ID index and secondary type index
   */
  set(node: Node): void {
    // Store in primary index
    this.nodes.set(node.id, node);

    // Update type index
    if (!this.typeIndex.has(node.internal.type)) {
      this.typeIndex.set(node.internal.type, new Set());
    }
    this.typeIndex.get(node.internal.type)!.add(node.id);
  }

  /**
   * Get a node by ID
   * @returns The node or undefined if not found
   */
  get(id: string): Node | undefined {
    return this.nodes.get(id);
  }

  /**
   * Get all nodes of a specific type
   * @returns Array of nodes (empty array if type not found)
   */
  getByType(type: string): Node[] {
    const ids = this.typeIndex.get(type);
    if (!ids) {
      return [];
    }

    const result: Node[] = [];
    for (const id of ids) {
      const node = this.nodes.get(id);
      if (node) {
        result.push(node);
      }
    }
    return result;
  }

  /**
   * Get all nodes in the store
   * @returns Array of all nodes
   */
  getAll(): Node[] {
    return Array.from(this.nodes.values());
  }

  /**
   * Get all registered node types
   * @returns Array of type names
   */
  getTypes(): string[] {
    return Array.from(this.typeIndex.keys());
  }

  /**
   * Get count of nodes by type
   * @returns Number of nodes of the specified type
   */
  countByType(type: string): number {
    return this.typeIndex.get(type)?.size ?? 0;
  }

  /**
   * Delete a node by ID
   * Removes from both primary and type indexes
   * @returns true if node was deleted, false if it didn't exist
   */
  delete(id: string): boolean {
    const node = this.nodes.get(id);
    if (!node) {
      return false;
    }

    // Remove from type index
    const typeSet = this.typeIndex.get(node.internal.type);
    if (typeSet) {
      typeSet.delete(id);
      // Clean up empty type sets
      if (typeSet.size === 0) {
        this.typeIndex.delete(node.internal.type);
      }
    }

    // Remove from primary index
    this.nodes.delete(id);
    return true;
  }

  /**
   * Check if a node exists
   */
  has(id: string): boolean {
    return this.nodes.has(id);
  }

  /**
   * Get total number of nodes
   */
  size(): number {
    return this.nodes.size;
  }

  /**
   * Clear all nodes (useful for testing)
   */
  clear(): void {
    this.nodes.clear();
    this.typeIndex.clear();
  }
}
