# Next.js + Universal Data Layer Example

This example demonstrates how to use Universal Data Layer (UDL) with Next.js and Contentful.

## What's Included

- **UDL Configuration** (`udl.config.ts`) - Shows how to configure the Contentful plugin
- **GraphQL Queries** - Next.js pages query the UDL server using `udl.query()`
- **Mock Data** - MSW intercepts Contentful API calls at the UDL server level, providing mock data without real credentials

## Quick Start

1. **Install dependencies** (from monorepo root)

   ```bash
   npm install
   ```

2. **Start the UDL server**

   ```bash
   npm run udl
   ```

   This starts the Universal Data Layer GraphQL server on port 4000. The MSW mock server intercepts Contentful API calls and returns mock data.

3. **In another terminal, start Next.js**

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000) to see the result.

   The example uses mock data by default - no Contentful credentials needed!

## Architecture

```
┌─────────────────┐      GraphQL      ┌─────────────────┐      Contentful API     ┌─────────────────┐
│                 │    localhost:4000  │                 │   (intercepted by MSW)  │                 │
│    Next.js      │  ───────────────▶  │   UDL Server    │  ───────────────────▶   │  Mock Fixtures  │
│   (port 3000)   │                    │   (port 4000)   │                         │                 │
│                 │                    │                 │                         │                 │
└─────────────────┘                    └─────────────────┘                         └─────────────────┘
```

1. Next.js pages make GraphQL queries to the UDL server
2. UDL server fetches data from Contentful via the plugin
3. MSW intercepts Contentful API calls and returns mock data

## Using Real Contentful Data

To connect to a real Contentful space:

1. Copy the example environment file:

   ```bash
   cp .env.example .env.local
   ```

2. Add your Contentful credentials to `.env.local`:

   ```bash
   CONTENTFUL_SPACE_ID=your_space_id
   CONTENTFUL_ACCESS_TOKEN=your_delivery_api_access_token
   CONTENTFUL_ENVIRONMENT=master
   USE_REAL_API=true  # Disable MSW mocks and use real Contentful
   ```

## Example Queries

### Fetching All Products

```tsx
import { udl, gql } from './lib/udl';

const products = await udl.query(gql`
  {
    allContentfulProducts {
      name
      slug
      description
      price
    }
  }
`);
```

### Fetching a Single Product by Slug

```tsx
const product = await udl.query(
  gql`
    query GetProduct($slug: String!) {
      contentfulProduct(slug: $slug) {
        name
        slug
        description
        price
        variants {
          ... on ContentfulVariant {
            name
            sku
            price
            inStock
          }
        }
      }
    }
  `,
  { slug: 'classic-t-shirt' }
);
```

> Note: The `slug` argument is available because `indexes: ['slug']` is configured in `udl.config.ts`.

## Mock Data

Mock data is provided by the UDL server's MSW integration. The fixtures are defined in `@udl/plugin-source-contentful/mocks` and include:

**Content Types:**

- `Product` - name, slug, description, price, image, variants
- `Variant` - name, sku, price, inStock

**Sample Data:**

- 2 products (Classic T-Shirt, Denim Jacket)
- 4 variants (size/color combinations)
- 2 product images

## Scripts

| Script              | Description                                 |
| ------------------- | ------------------------------------------- |
| `npm run dev`       | Start Next.js development server            |
| `npm run udl`       | Start UDL GraphQL server (with MSW mocking) |
| `npm run build`     | Build Next.js for production                |
| `npm run typecheck` | Run TypeScript type checking                |

## For Real Projects

When using UDL in your own projects (not this monorepo example), install packages from npm:

```bash
npm install universal-data-layer @udl/plugin-source-contentful
```
