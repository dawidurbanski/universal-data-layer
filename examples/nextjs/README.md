# Next.js + Universal Data Layer Example

This example demonstrates how to use Universal Data Layer (UDL) with Next.js and Contentful.

## Setup

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Configure Contentful**

   Copy the example environment file:

   ```bash
   cp .env.example .env.local
   ```

   Then add your Contentful credentials to `.env.local`:

   ```bash
   CONTENTFUL_SPACE_ID=your_space_id
   CONTENTFUL_ACCESS_TOKEN=your_delivery_api_access_token
   CONTENTFUL_ENVIRONMENT=master
   ```

   You can find these values in your Contentful space under **Settings > API Keys**.

3. **Run the development server**

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000) to see the result.

## Usage

Query your Contentful data using UDL:

```tsx
import { udl, gql } from 'universal-data-layer';

export default async function Page() {
  const posts = await udl.query(gql`
    {
      allContentfulBlogPost {
        title
        slug
        publishedAt
      }
    }
  `);

  return (
    <ul>
      {posts.map((post) => (
        <li key={post.slug}>{post.title}</li>
      ))}
    </ul>
  );
}
```

## For Real Projects

When using UDL in your own projects (not this monorepo example), install packages from npm:

```bash
npm install universal-data-layer @udl/plugin-source-contentful
```
