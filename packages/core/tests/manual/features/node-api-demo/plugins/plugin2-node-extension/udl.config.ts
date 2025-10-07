/**
 * Plugin 2: Node Extension Plugin
 *
 * This plugin demonstrates extending existing nodes created by other plugins.
 * It queries Product nodes and adds computed fields based on price ranges.
 */

import type { SourceNodesContext } from '@core/nodes/index.js';

export const config = {
  type: 'other' as const,
  name: 'extend-products',
};

export const onLoad = () => {
  console.log('[Plugin 2] Loading product enrichment...');
};

export async function sourceNodes({ actions }: SourceNodesContext) {
  console.log('[Plugin 2] Enriching product nodes...');

  // Query all Product nodes created by Plugin 1
  const productNodes = actions.getNodesByType('Product');

  for (const node of productNodes) {
    const product = node as typeof node & { price: number; category: string };

    // Add price category based on price
    let priceCategory: 'budget' | 'affordable' | 'premium' | 'luxury';
    if (product.price < 50) {
      priceCategory = 'budget';
    } else if (product.price < 150) {
      priceCategory = 'affordable';
    } else if (product.price < 400) {
      priceCategory = 'premium';
    } else {
      priceCategory = 'luxury';
    }

    // Calculate discount price (20% off)
    const discountedPrice = Math.round(product.price * 0.8 * 100) / 100;

    // Determine if product is in stock (based on category)
    const inStock = product.category !== 'discontinued';

    // Extend the node with computed fields
    await actions.extendNode(node.id, {
      priceCategory,
      discountedPrice,
      inStock,
    });

    console.log(
      `[Plugin 2] Enriched Product: ${(node as { name?: string }).name} (${priceCategory})`
    );
  }

  console.log(`[Plugin 2] Enriched ${productNodes.length} products`);
}
