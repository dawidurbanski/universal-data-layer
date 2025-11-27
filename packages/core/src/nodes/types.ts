/**
 * Internal metadata tracked for each node
 * Contains system-level information about the node's origin, integrity, and lifecycle
 *
 * @typeParam Type - The GraphQL type name (defaults to string for non-generated code)
 * @typeParam Owner - The plugin name that owns this node (defaults to string for non-generated code)
 *
 * @example
 * ```ts
 * // Generic usage (runtime)
 * const internal: NodeInternal = { id: '123', type: 'Product', ... };
 *
 * // Typed usage (generated code)
 * interface Product {
 *   internal: NodeInternal<'Product', 'shopify-source'>;
 * }
 * ```
 */
export interface NodeInternal<
  Type extends string = string,
  Owner extends string = string,
> {
  /** Globally unique identifier for this node */
  id: string;

  /** The GraphQL type name for this node (e.g., 'Product', 'BlogPost') */
  type: Type;

  /** Hash of the node's content for change detection and cache invalidation */
  contentDigest: string;

  /** Plugin name that created this node (for tracking ownership and dependencies) */
  owner: Owner;

  /** Timestamp when the node was created */
  createdAt: number;

  /** Timestamp when the node was last modified */
  modifiedAt: number;
}

/**
 * Base node structure that all data entities must implement
 * Nodes are the fundamental unit of data in the Universal Data Layer
 *
 * @example
 * ```ts
 * // Define a custom node type by extending Node
 * interface ProductNode extends Node {
 *   name: string;
 *   price: number;
 *   category: string;
 * }
 *
 * // Create a node
 * const product: ProductNode = {
 *   internal: {
 *     id: 'product-123',
 *     type: 'Product',
 *     contentDigest: 'abc123...',
 *     owner: 'my-source-plugin',
 *     createdAt: Date.now(),
 *     modifiedAt: Date.now(),
 *   },
 *   parent: undefined,
 *   children: undefined,
 *   name: 'Widget',
 *   price: 29.99,
 *   category: 'gadgets',
 * };
 * ```
 */
export interface Node {
  /** Internal metadata about this node's type, origin, and integrity */
  internal: NodeInternal;

  /**
   * ID of the parent node (optional)
   * Use when this node is derived from or belongs to another node
   * Prefer embedding data over relationships when possible
   */
  parent?: string;

  /**
   * Array of child node IDs (optional)
   * Automatically maintained when child nodes specify this node as their parent
   * Prefer embedding data over relationships when possible
   */
  children?: string[];
}
