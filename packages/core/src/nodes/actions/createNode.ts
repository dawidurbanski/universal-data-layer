import type { Node } from '@/nodes/types.js';
import type { NodeStore } from '@/nodes/store.js';
import { createContentDigest } from '@/nodes/utils/index.js';

/**
 * Input for creating a node - allows partial internal metadata
 * The system will auto-fill missing fields like contentDigest and timestamps
 * Supports custom fields beyond the base Node interface
 */
export type CreateNodeInput = Omit<Node, 'internal'> & {
  internal: Omit<
    Node['internal'],
    'contentDigest' | 'createdAt' | 'modifiedAt'
  > & {
    contentDigest?: string;
    createdAt?: number;
    modifiedAt?: number;
  };
  // Allow any additional custom fields
  [key: string]: unknown;
};

/**
 * Options for createNode function
 */
export interface CreateNodeOptions {
  /** The node store to use for storage */
  store: NodeStore;
  /** Optional owner to set (usually bound via context) */
  owner?: string;
}

/**
 * Creates or updates a node in the node store
 *
 * - Validates required fields (id, internal.type)
 * - Auto-generates contentDigest if not provided
 * - Sets created/modified timestamps
 * - Updates parent-child relationships bidirectionally
 * - Stores node in the NodeStore
 * - Fully replaces existing nodes with the same ID
 *
 * @param input - Node data with optional auto-generated fields
 * @param options - Configuration including NodeStore instance
 *
 * @example
 * ```ts
 * const store = new NodeStore();
 *
 * await createNode({
 *   id: 'product-123',
 *   internal: {
 *     type: 'Product',
 *     owner: 'shopify-source'
 *   },
 *   parent: undefined,
 *   children: undefined,
 *   name: 'Widget',
 *   price: 29.99
 * }, { store });
 * ```
 */
export async function createNode(
  input: CreateNodeInput,
  options: CreateNodeOptions
): Promise<Node> {
  const { store, owner } = options;

  // Validate required fields
  if (!input.id) {
    throw new Error('Node id is required');
  }

  if (!input.internal?.type) {
    throw new Error('Node internal.type is required');
  }

  // Check if node already exists to determine timestamps
  const existingNode = store.get(input.id);
  const now = Date.now();
  const createdAt = existingNode?.internal.createdAt ?? now;
  const modifiedAt = now;

  // Build the complete node with auto-generated fields
  const node: Node = {
    ...input,
    internal: {
      type: input.internal.type,
      owner: owner || input.internal.owner,
      contentDigest: input.internal.contentDigest || createContentDigest(input),
      createdAt: input.internal.createdAt ?? createdAt,
      modifiedAt: input.internal.modifiedAt ?? modifiedAt,
    },
  };

  // Update parent-child relationships
  if (node.parent) {
    const parentNode = store.get(node.parent);
    if (parentNode) {
      // Add this node to parent's children array if not already present
      if (!parentNode.children) {
        parentNode.children = [];
      }
      if (!parentNode.children.includes(node.id)) {
        parentNode.children.push(node.id);
        // Update parent node in store with new children array
        store.set(parentNode);
      }
    }
  }

  // Remove from old parent's children if parent changed
  if (existingNode?.parent && existingNode.parent !== node.parent) {
    const oldParent = store.get(existingNode.parent);
    if (oldParent?.children) {
      oldParent.children = oldParent.children.filter((id) => id !== node.id);
      store.set(oldParent);
    }
  }

  // Store the node
  store.set(node);

  return node;
}
