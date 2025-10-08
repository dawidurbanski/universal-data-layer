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
    slug: 'wireless-headphones',
    price: 299.99,
    category: 'electronics',
    description: 'Premium wireless headphones with noise cancellation',
  },
  {
    id: 'prod-2',
    name: 'Coffee Maker',
    slug: 'coffee-maker',
    price: 89.99,
    category: 'appliances',
    description: 'Programmable drip coffee maker',
  },
  {
    id: 'prod-3',
    name: 'Running Shoes',
    slug: 'running-shoes',
    price: 129.99,
    category: 'sports',
    description: 'Lightweight running shoes with cushioning',
  },
  {
    id: 'prod-4',
    name: 'Vintage Camera',
    slug: 'vintage-camera',
    price: 599.99,
    category: 'discontinued',
    description: 'Collectible vintage film camera',
  },
  {
    id: 'prod-5',
    name: 'Yoga Mat',
    slug: 'yoga-mat',
    price: 34.99,
    category: 'sports',
    description: 'Non-slip exercise yoga mat',
  },
];

export const config = {
  type: 'source' as const,
  name: 'source-products',
  indexes: ['slug'], // Default indexed fields for this plugin
};

export async function sourceNodes({
  actions,
  createNodeId,
  createContentDigest,
}: SourceNodesContext) {
  for (const product of products) {
    // Create deterministic node ID from product type and external ID
    const nodeId = createNodeId('Product', product.id);

    // Create the node
    await actions.createNode({
      // Required fields
      internal: {
        id: nodeId,
        type: 'Product',
        owner: 'product-source',
        contentDigest: createContentDigest(product),
      },

      // Product-specific fields
      externalId: product.id,
      name: product.name,
      slug: product.slug,
      price: product.price,
      category: product.category,
      description: product.description,
    });
  }
}
