import { ProductCard } from './components/ProductCard';
import { udl, gql } from './lib/udl';
import type { ContentfulProduct } from '@udl/plugin-source-contentful/generated';

async function getProducts(): Promise<ContentfulProduct[]> {
  try {
    return await udl.query<ContentfulProduct[]>(gql`
      {
        allContentfulProducts {
          name
          slug
          description
          price
        }
      }
    `);
  } catch (error) {
    console.error('Failed to fetch products from UDL:', error);
    // Return empty array if UDL server is not running
    return [];
  }
}

export default async function Home() {
  const products = await getProducts();

  return (
    <main className="p-8 font-sans">
      <h1>UDL Next.js Example</h1>
      <p className="text-gray-500 mb-8">
        This example demonstrates how to use Universal Data Layer with Next.js
        and Contentful.
      </p>

      <section>
        <h2>Products</h2>
        {products.length === 0 ? (
          <div className="p-8 bg-amber-100 border border-amber-400 rounded-lg mt-4">
            <p className="m-0 font-medium">
              No products found. Make sure the UDL server is running:
            </p>
            <pre className="bg-gray-100 px-4 py-2 rounded mt-2">
              npm run udl:dev
            </pre>
          </div>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-6 mt-4">
            {products.map((product) => (
              <ProductCard key={product.slug} product={product} />
            ))}
          </div>
        )}
      </section>

      <section className="mt-12">
        <h2>How It Works</h2>
        <p>This example includes:</p>
        <ul className="leading-relaxed">
          <li>
            <strong>UDL Server</strong> - Runs the Universal Data Layer GraphQL
            server (<code>npm run udl:dev</code>)
          </li>
          <li>
            <strong>MSW Mock Server</strong> - Intercepts Contentful API calls
            and returns mock data (in <code>mocks/</code>)
          </li>
          <li>
            <strong>UDL Configuration</strong> - Shows how to configure the
            Contentful plugin (in <code>udl.config.ts</code>)
          </li>
          <li>
            <strong>GraphQL Queries</strong> - Next.js pages query the UDL
            server using <code>udl.query()</code>
          </li>
        </ul>
      </section>

      <section className="mt-8">
        <h2>Running the Example</h2>
        <ol className="leading-loose">
          <li>
            Start the UDL server: <code>npm run udl:dev</code>
          </li>
          <li>
            In another terminal, start Next.js: <code>npm run dev</code>
          </li>
        </ol>
      </section>

      <section className="mt-8">
        <h2>Example Query</h2>
        <pre className="bg-gray-100 p-4 rounded-lg overflow-auto">
          {`import { udl, gql } from './lib/udl';

const products = await udl.query(gql\`
  {
    allContentfulProducts {
      name
      slug
      description
      price
    }
  }
\`);`}
        </pre>
      </section>
    </main>
  );
}
