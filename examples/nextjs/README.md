# Next.js + Universal Data Layer Example

This example demonstrates how to use Universal Data Layer (UDL) with Next.js and Contentful.

## What's Included

- **UDL Configuration** (`udl.config.ts`) - Shows how to configure the Contentful plugin
- **MSW Mock Server** (`mocks/`) - Mock Contentful API responses for development without real credentials
- **Mock Fixtures** - Product and Variant content types with sample data

## Quick Start

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Run the development server**

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000) to see the result.

   The example uses mock data by default - no Contentful credentials needed!

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
   ```

3. Remove or comment out the mock server in `udl.config.ts`:

   ```ts
   // import { startMockServer } from './mocks/server.js';
   // startMockServer();
   ```

## Example Query

```tsx
import { udl, gql } from 'universal-data-layer';

export default async function Page() {
  const products = await udl.query(gql`
    {
      allContentfulProduct {
        name
        slug
        description
        price
      }
    }
  `);

  return (
    <ul>
      {products.map((product) => (
        <li key={product.slug}>{product.name}</li>
      ))}
    </ul>
  );
}
```

## Mock Data Structure

The mock fixtures include:

**Content Types:**

- `Product` - name, slug, description, price, image, variants
- `Variant` - name, sku, price, inStock

**Sample Data:**

- 2 products (Classic T-Shirt, Denim Jacket)
- 4 variants (size/color combinations)
- 2 product images

## For Real Projects

When using UDL in your own projects (not this monorepo example), install packages from npm:

```bash
npm install universal-data-layer @udl/plugin-source-contentful
```
