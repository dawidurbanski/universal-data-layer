/**
 * Plugin 3: Node Filter/Delete Plugin
 *
 * This plugin demonstrates filtering/curating data by deleting nodes
 * based on specific criteria. It removes discontinued products.
 */

import type { SourceNodesContext } from '@core/nodes/index.js';

export const config = {
  type: 'other' as const,
  name: 'filter-products',
};

export async function sourceNodes({ actions }: SourceNodesContext) {
  // Query all Product nodes
  const productNodes = actions.getNodesByType('Product');

  for (const node of productNodes) {
    const product = node as typeof node & {
      category: string;
      name?: string;
      inStock?: boolean;
    };

    // Remove discontinued products
    if (product.category === 'discontinued') {
      await actions.deleteNode(node.internal.id);
      continue;
    }

    // Could also filter by other criteria
    // Example: Remove out-of-stock products
    if (product.inStock === false) {
      await actions.deleteNode(node.internal.id);
    }
  }
}
