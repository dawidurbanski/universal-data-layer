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

export const onLoad = () => {
  console.log('[Plugin 3] Loading product curator...');
};

export async function sourceNodes({ actions }: SourceNodesContext) {
  console.log('[Plugin 3] Curating product catalog...');

  // Query all Product nodes
  const productNodes = actions.getNodesByType('Product');

  let deletedCount = 0;

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

  const remainingProducts = actions.getNodesByType('Product');

  console.log(
    `[Plugin 3] Removed ${deletedCount} products, ${remainingProducts.length} remaining`
  );
}
