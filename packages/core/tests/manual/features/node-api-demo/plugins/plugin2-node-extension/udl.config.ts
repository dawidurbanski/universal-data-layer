/**
 * Plugin 2: Node Extension Plugin
 *
 * This plugin demonstrates extending existing nodes created by other plugins.
 * It queries Product nodes and adds computed fields based on price ranges.
 */

import { defineConfig, type SourceNodesContext } from 'universal-data-layer';

export const config = defineConfig({
  type: 'other',
  name: 'extend-products',
});

export async function sourceNodes({ actions }: SourceNodesContext) {
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
    await actions.extendNode(node.internal.id, {
      priceCategory,
      discountedPrice,
      inStock,
    });
  }
}
