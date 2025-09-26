# Data Layer API Documentation

## Overview

The Data Layer is a high-performance, plugin-based data sourcing and caching system distributed as an NPM package. It provides a unified GraphQL API for accessing data from multiple sources, with intelligent caching and real-time updates.

### Key Features

- **GraphQL Server**: Automatically managed GraphQL server for data queries
- **Plugin Architecture**: Extensible system for connecting to any data source
- **Build-Time Optimization**: Reduced build times through intelligent caching
- **Real-Time Updates**: WebSocket-based live data updates during development
- **Type Safety**: Automatic TypeScript type generation from GraphQL schema
- **Framework Adapters**: Specialized integrations for Next.js (and future frameworks)

## Installation & Setup

### 1. Install Packages

```bash
npm install @universal-data-layer/next @universal-data-layer/contentful
```

### 2. Configure Environment Variables

Add your data source credentials to `.env`:

```env
# Contentful
CONTENTFUL_SPACE_ID=your_space_id
CONTENTFUL_ACCESS_TOKEN=your_access_token
CONTENTFUL_PREVIEW_TOKEN=your_preview_token

# Shopify
SHOPIFY_STORE_DOMAIN=your-store.myshopify.com
SHOPIFY_STOREFRONT_ACCESS_TOKEN=your_token

# Okendo
OKENDO_API_KEY=your_api_key
```

### 3. Create Configuration File

Create `data-layer.config.js` in your project root:

```javascript
module.exports = {
  plugins: [
    '@universal-data-layer/contentful',
    '@universal-data-layer/shopify',
  ],
  // Optional: Override default paths
  paths: {
    nodeSource: './data-layer-node.ts',
  },
};
```

### 4. Update Package.json Scripts

Replace your Next.js scripts:

```json
{
  "scripts": {
    "dev": "next-data-layer dev",
    "build": "next-data-layer build"
  }
}
```

### 5. Optional: Create Custom Node Source File

Create `data-layer-node.ts` for custom data enhancements:

```typescript
import type { NodeAPI } from '@universal-data-layer/core';

export const onCreateNode = [
  {
    priority: 10,
    handler: async ({ node, actions, getNode }) => {
      if (node.type === 'ContentfulProduct') {
        // Enhance with Shopify data
        const shopifyData = await fetchShopifyProduct(node.sku);
        actions.createNodeField({
          node,
          name: 'shopifyData',
          value: shopifyData,
        });
      }
    },
  },
];
```

## Core Concepts

### Nodes

All data in the system is represented as nodes - standardized data objects that can be queried via GraphQL. Plugins source nodes from their respective APIs, and you can enhance or create custom nodes.

### Data Enhancement

Unlike traditional systems with complex relationships, the Data Layer encourages data embedding. For example, Shopify pricing data can be directly embedded into Contentful product nodes, creating denormalized but efficient data structures.

### Priority System

When multiple handlers need to process the same data, a simple priority system determines execution order:

- **Lower numbers execute first** (priority: 10 runs before priority: 20)
- **Supports zero and negative values** for edge cases
- **Default priority is 10** if not specified

## Configuration Reference

### data-layer.config.js

```javascript
module.exports = {
  // Required: List of plugins to use
  plugins: [
    '@universal-data-layer/contentful',
    '@universal-data-layer/shopify',
    // Custom plugin configuration
    {
      resolve: '@universal-data-layer/okendo',
      options: {
        apiKey: process.env.CUSTOM_OKENDO_KEY,
      },
    },
  ],

  // Optional: Override default paths
  paths: {
    nodeSource: './data-layer-node.ts', // Default: './data-layer-node.ts'
    cache: './.cache', // Default: './.cache'
    generated: './generated', // Default: './node_modules/@universal-data-layer/core/generated'
  },

  // Optional: Server configuration
  server: {
    port: 4000, // Default: 4000
    playground: true, // Default: true in development
  },

  // Optional: Environment variable mapping
  env: {
    contentful: {
      spaceId: 'MY_CUSTOM_SPACE_ID_VAR',
      accessToken: 'MY_CUSTOM_TOKEN_VAR',
    },
  },
};
```

## Query API

### Server Components

Use the `query` helper in Next.js server components:

```typescript
import { query } from '@universal-data-layer/next';

export default async function ProductPage({ params }) {
  const data = await query(`
    query GetProduct($id: ID!) {
      product(id: $id) {
        id
        title
        description
        shopifyData {
          price
          inventory
          variants {
            id
            title
            available
          }
        }
      }
    }
  `, {
    variables: { id: params.id },
    // Optional: caching options
    cache: {
      revalidate: 3600 // seconds
    }
  });

  return <ProductDetails product={data.product} />;
}
```

### Type Safety

TypeScript types are automatically generated and can be imported:

```typescript
import type { Product, ProductQuery } from '@universal-data-layer/core';

const data = await query<ProductQuery>(`...`);
// data.product is fully typed
```

## Data Sourcing API

### data-layer-node.ts

This file allows you to customize how nodes are created and enhanced:

```typescript
import type {
  NodeAPI,
  SourceNodesArgs,
  CreateNodeArgs,
} from '@universal-data-layer/core';

// Source custom nodes
export async function sourceNodes({
  actions,
  createNodeId,
  createContentDigest,
}: SourceNodesArgs) {
  const customData = await fetchCustomAPI();

  customData.forEach((item) => {
    actions.createNode({
      ...item,
      id: createNodeId(`custom-${item.id}`),
      type: 'CustomNode',
      internal: {
        contentDigest: createContentDigest(item),
      },
    });
  });
}

// Enhance existing nodes
export const onCreateNode = [
  {
    priority: 10,
    handler: async ({ node, actions, getNode }: CreateNodeArgs) => {
      if (node.type === 'ContentfulProduct') {
        // Fetch related Shopify data
        const shopifyProduct = await fetchShopifyBySKU(node.sku);

        // Embed the data directly into the node
        actions.createNodeField({
          node,
          name: 'shopifyData',
          value: {
            price: shopifyProduct.price,
            compareAtPrice: shopifyProduct.compareAtPrice,
            inventory: shopifyProduct.totalInventory,
            variants: shopifyProduct.variants,
          },
        });
      }
    },
  },
  {
    priority: 20,
    handler: async ({ node, actions }) => {
      if (node.type === 'ContentfulProduct') {
        // Add computed fields
        actions.createNodeField({
          node,
          name: 'isOnSale',
          value: node.shopifyData?.compareAtPrice > node.shopifyData?.price,
        });
      }
    },
  },
];

// Customize GraphQL schema
export function createSchemaCustomization({ actions }) {
  const { createTypes } = actions;

  createTypes(`
    type CustomNode implements Node {
      id: ID!
      title: String!
      customField: String
    }
  `);
}
```

## Plugin System

### Official Plugins

#### @universal-data-layer/contentful

Sources content from Contentful CMS:

```javascript
{
  resolve: '@universal-data-layer/contentful',
  options: {
    spaceId: process.env.CONTENTFUL_SPACE_ID,
    accessToken: process.env.CONTENTFUL_ACCESS_TOKEN,
    previewToken: process.env.CONTENTFUL_PREVIEW_TOKEN,
    environment: 'master',
    downloadLocal: false
  }
}
```

#### @universal-data-layer/shopify

Sources products and collections from Shopify:

```javascript
{
  resolve: '@universal-data-layer/shopify',
  options: {
    storeDomain: process.env.SHOPIFY_STORE_DOMAIN,
    storefrontAccessToken: process.env.SHOPIFY_STOREFRONT_ACCESS_TOKEN,
    apiVersion: '2024-01'
  }
}
```

#### @universal-data-layer/okendo

Sources reviews and ratings from Okendo:

```javascript
{
  resolve: '@universal-data-layer/okendo',
  options: {
    apiKey: process.env.OKENDO_API_KEY,
    subscriberId: process.env.OKENDO_SUBSCRIBER_ID
  }
}
```

### Creating Custom Plugins

Plugins are NPM packages that export a standard interface:

```typescript
// my-custom-plugin/index.ts
import type { PluginAPI } from '@universal-data-layer/core';

export default function myCustomPlugin(api: PluginAPI, options: any) {
  return {
    name: 'my-custom-plugin',

    async sourceNodes({ actions, createNodeId, createContentDigest }) {
      const data = await fetchFromAPI(options.apiUrl);

      data.items.forEach((item) => {
        actions.createNode({
          ...item,
          id: createNodeId(`custom-${item.id}`),
          type: 'CustomItem',
          internal: {
            contentDigest: createContentDigest(item),
          },
        });
      });
    },

    async createSchemaCustomization({ actions }) {
      actions.createTypes(`
        type CustomItem implements Node {
          id: ID!
          title: String!
          customField: String
        }
      `);
    },
  };
}
```

## Caching & Performance

### Build-Time Caching

The Data Layer maintains a persistent cache between builds to minimize API calls:

1. **Incremental Updates**: Only fetch changed data based on CMS webhooks
2. **Dependency Tracking**: Track which queries use which data
3. **Smart Invalidation**: Only rebuild affected pages when data changes

### Webhook Integration

Configure webhooks in your CMS to point to your Data Layer server:

```
https://your-data-layer-server.vercel.app/api/webhooks/contentful
```

The server will:

1. Receive the webhook payload
2. Update the specific cache entries
3. Mark affected queries for revalidation
4. Broadcast updates to connected development servers

### Local Development Sync

During development, your local GraphQL server connects via WebSocket to the remote server:

```typescript
// Automatically handled by the framework adapter
// Updates flow: CMS → Remote Server → WebSocket → Local Server → HMR
```

## Development Workflow

### Local Development

1. Run `npm run dev` (which executes `next-data-layer dev`)
2. Two servers start simultaneously:
   - Next.js dev server (port 3000)
   - GraphQL server (port 4000)
3. GraphQL playground available at `http://localhost:4000/graphql`
4. Real-time updates via WebSocket connection to remote server
5. HMR triggered on data changes

### Production Build

1. Run `npm run build` (which executes `next-data-layer build`)
2. GraphQL server starts and sources all data
3. Next.js build process runs with access to GraphQL server
4. Static pages generated with embedded data
5. Server shuts down after build completes

### Type Generation

Types are automatically generated on:

- Dev server start
- Build process
- Manual generation: `next-data-layer generate-types`

## Examples

### Basic Product Page

```typescript
// app/products/[slug]/page.tsx
import { query } from '@universal-data-layer/next';
import type { ProductQuery } from '@universal-data-layer/core';

export default async function ProductPage({ params }) {
  const data = await query<ProductQuery>(`
    query GetProduct($slug: String!) {
      contentfulProduct(slug: { eq: $slug }) {
        title
        description
        images {
          url
          alt
        }
        # Embedded Shopify data
        shopifyData {
          price
          compareAtPrice
          inventory
          variants {
            id
            title
            available
          }
        }
        # Embedded Okendo data
        okendoData {
          averageRating
          reviewCount
          reviews(first: 5) {
            title
            body
            rating
            author
          }
        }
      }
    }
  `, {
    variables: { slug: params.slug }
  });

  return <ProductDetails product={data.contentfulProduct} />;
}
```

### Custom Node Enhancement

```typescript
// data-layer-node.ts
export const onCreateNode = [
  {
    priority: 10,
    handler: async ({ node, actions, getNodesByType }) => {
      if (node.type === 'ContentfulBlogPost') {
        // Enhance blog posts with related products
        const products = getNodesByType('ContentfulProduct');
        const relatedProducts = products.filter((product) =>
          node.tags?.some((tag) => product.tags?.includes(tag))
        );

        actions.createNodeField({
          node,
          name: 'relatedProducts',
          value: relatedProducts.slice(0, 3),
        });
      }
    },
  },
];
```

### Multi-Source Product Composition

```typescript
// data-layer-node.ts
export const onCreateNode = [
  {
    priority: 10,
    handler: async ({ node, actions }) => {
      if (node.type === 'ContentfulProduct') {
        // Fetch from multiple sources in parallel
        const [shopifyData, okendoData, inventoryData] = await Promise.all([
          fetchShopifyProduct(node.shopifyId),
          fetchOkendoReviews(node.sku),
          fetchWarehouseInventory(node.sku),
        ]);

        // Create a unified product object
        actions.createNodeField({
          node,
          name: 'commerceData',
          value: {
            pricing: {
              current: shopifyData.price,
              compare: shopifyData.compareAtPrice,
              currency: shopifyData.currency,
            },
            inventory: {
              shopify: shopifyData.totalInventory,
              warehouse: inventoryData.available,
              total: shopifyData.totalInventory + inventoryData.available,
            },
            reviews: {
              average: okendoData.averageRating,
              count: okendoData.reviewCount,
              featured: okendoData.reviews.slice(0, 3),
            },
          },
        });
      }
    },
  },
];
```

## Package Structure

The Universl Data Layer is organized as a monorepo with the following packages:

- **@universal-data-layer/core**: Core library with plugin system and GraphQL server
- **@universal-data-layer/next**: Next.js adapter with build commands and query helpers
- **@universal-data-layer/contentful**: Contentful CMS plugin
- **@universal-data-layer/shopify**: Shopify Storefront API plugin
- **@universal-data-layer/okendo**: Okendo reviews plugin

## Migration Guide

### From Direct API Calls

Before:

```typescript
// Multiple API calls, no caching
const product = await contentfulClient.getEntry(id);
const shopifyData = await shopifyClient.product.fetch(product.shopifyId);
const reviews = await okendoAPI.getReviews(product.sku);
```

After:

```typescript
// Single GraphQL query, automatic caching
const data = await query(`
  query {
    product(id: $id) {
      title
      shopifyData { price }
      okendoData { averageRating }
    }
  }
`);
```

### From Gatsby

The Data Layer adopts many Gatsby concepts but simplifies them:

- **Simplified Node API**: Focus on data enhancement rather than complex transformations
- **No Page Creation**: Let Next.js handle routing
- **Embedded Data**: Prefer embedding over complex relationships
- **Runtime Queries**: Support for server components, not just static queries

## Troubleshooting

### Common Issues

**GraphQL server not starting**

- Check port 4000 is available
- Verify environment variables are set
- Check plugin configuration in `data-layer.config.js`

**Types not generating**

- Run `next-data-layer generate-types` manually
- Check write permissions for generated types location
- Verify GraphQL schema is valid

**Cache not updating**

- Verify webhook configuration in CMS
- Check network connectivity to remote server
- Clear cache with `rm -rf .cache` and rebuild

**WebSocket connection failed**

- Check firewall settings
- Verify remote server URL in environment
- Check for proxy/VPN interference

## Best Practices

1. **Keep Nodes Flat**: Embed related data rather than creating deep relationships
2. **Use Priority System**: Order your node enhancements logically
3. **Cache Strategically**: Set appropriate revalidation times for different data types
4. **Type Everything**: Leverage automatic type generation for type safety
5. **Monitor Performance**: Use GraphQL playground to analyze query performance
6. **Version Control**: Commit `data-layer-node.ts` but not `.cache` directory

## Future Roadmap

- Support for additional frameworks (Nuxt, Remix, etc.)
- More data source plugins (Strapi, Sanity, WordPress)
- Edge caching strategies
- GraphQL subscriptions for real-time data
- Visual query builder
- Performance analytics dashboard
