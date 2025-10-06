import type { Node } from '@/nodes/types.js';
import type { NodeStore } from '@/nodes/store.js';
import { createContentDigest } from '@/nodes/utils/index.js';

/**
 * Data to extend a node with
 * Cannot override protected system fields (id, internal, parent, children)
 */
export type ExtendNodeData = Record<string, unknown>;

/**
 * Options for extendNode function
 */
export interface ExtendNodeOptions {
  /** The node store to use */
  store: NodeStore;
}

/**
 * Extends an existing node with additional fields or computed data
 *
 * - Merges new fields into existing node (shallow merge)
 * - Validates node exists before extending
 * - Prevents overwriting protected fields (id, internal, parent, children)
 * - Updates contentDigest and modifiedAt timestamp
 * - Returns the updated node
 *
 * Commonly used for:
 * - Adding relationships to nodes created by other plugins
 * - Adding computed/derived fields
 * - Enriching nodes with additional data
 *
 * @param nodeId - ID of the node to extend
 * @param extension - Object with fields to add/update
 * @param options - Configuration including NodeStore instance
 *
 * @example
 * ```ts
 * const store = new NodeStore();
 *
 * // Create a product node
 * await createNode({
 *   id: 'product-123',
 *   internal: { type: 'Product', owner: 'shopify' },
 *   name: 'Widget',
 *   price: 150
 * }, { store });
 *
 * // Extend with computed field
 * await extendNode('product-123', {
 *   priceCategory: 'expensive',
 *   discountedPrice: 120
 * }, { store });
 * ```
 */
export async function extendNode(
  nodeId: string,
  extension: ExtendNodeData,
  options: ExtendNodeOptions
): Promise<Node> {
  const { store } = options;

  // Validate node exists
  const existingNode = store.get(nodeId);
  if (!existingNode) {
    throw new Error(`Cannot extend node: Node with id "${nodeId}" not found`);
  }

  // Validate extension data doesn't contain protected fields
  const protectedFields = ['id', 'internal', 'parent', 'children'];
  const attemptedProtectedFields = Object.keys(extension).filter((key) =>
    protectedFields.includes(key)
  );

  if (attemptedProtectedFields.length > 0) {
    throw new Error(
      `Cannot extend node: Attempting to override protected fields: ${attemptedProtectedFields.join(', ')}`
    );
  }

  // Create extended node with shallow merge
  const extendedNode: Node = {
    ...existingNode,
    ...extension,
    // Ensure protected fields remain unchanged
    id: existingNode.id,
    internal: {
      ...existingNode.internal,
      modifiedAt: Date.now(),
    },
    ...(existingNode.parent !== undefined && { parent: existingNode.parent }),
    ...(existingNode.children !== undefined && {
      children: existingNode.children,
    }),
  };

  // Update content digest to reflect changes
  extendedNode.internal.contentDigest = createContentDigest(extendedNode);

  // Store the updated node
  store.set(extendedNode);

  return extendedNode;
}
