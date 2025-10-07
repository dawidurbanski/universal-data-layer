/**
 * Plugin 1: Basic Data Source Plugin
 *
 * This plugin demonstrates basic node creation from static data.
 * It sources product data from an in-memory array and creates nodes.
 */

import type { SourceNodesContext } from '@core/nodes/index.js';

// Sample product data
const products = [
  {
    id: 'prod-1',
    name: 'Wireless Headphones',
    price: 299.99,
    category: 'electronics',
    description: 'Premium wireless headphones with noise cancellation',
  },
  {
    id: 'prod-2',
    name: 'Coffee Maker',
    price: 89.99,
    category: 'appliances',
    description: 'Programmable drip coffee maker',
  },
  {
    id: 'prod-3',
    name: 'Running Shoes',
    price: 129.99,
    category: 'sports',
    description: 'Lightweight running shoes with cushioning',
  },
  {
    id: 'prod-4',
    name: 'Vintage Camera',
    price: 599.99,
    category: 'discontinued',
    description: 'Collectible vintage film camera',
  },
  {
    id: 'prod-5',
    name: 'Yoga Mat',
    price: 34.99,
    category: 'sports',
    description: 'Non-slip exercise yoga mat',
  },
];

export const config = {
  type: 'source' as const,
  name: 'source-products',
};

export const onLoad = () => {
  console.log('[Plugin 1] Loading product data...');
};

export async function sourceNodes({
  actions,
  createNodeId,
  createContentDigest,
}: SourceNodesContext) {
  console.log('[Plugin 1] Sourcing product data...');

  for (const product of products) {
    // Create deterministic node ID from product type and external ID
    const nodeId = createNodeId('Product', product.id);

    // Create the node
    await actions.createNode({
      // Required fields
      id: nodeId,
      internal: {
        type: 'Product',
        owner: 'product-source',
        contentDigest: createContentDigest(product),
      },

      // Product-specific fields
      externalId: product.id,
      name: product.name,
      price: product.price,
      category: product.category,
      description: product.description,
    });

    console.log(`[Plugin 1] Created Product node: ${product.name}`);
  }

  console.log(`[Plugin 1] Sourced ${products.length} products`);
}
