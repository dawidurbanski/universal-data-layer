import { ProductCard } from './components/ProductCard';
import { udl, gql } from './lib/udl';

interface Product {
  name: string;
  slug: string;
  description: string;
  price: number;
}

async function getProducts(): Promise<Product[]> {
  try {
    const products = await udl.query<Product[]>(gql`
      {
        allContentfulProducts {
          name
          slug
          description
          price
        }
      }
    `);
    return products;
  } catch (error) {
    console.error('Failed to fetch products from UDL:', error);
    // Return empty array if UDL server is not running
    return [];
  }
}

export default async function Home() {
  const products = await getProducts();

  return (
    <main style={{ padding: '2rem', fontFamily: 'system-ui, sans-serif' }}>
      <h1>UDL Next.js Example</h1>
      <p style={{ color: '#666', marginBottom: '2rem' }}>
        This example demonstrates how to use Universal Data Layer with Next.js
        and Contentful.
      </p>

      <section>
        <h2>Products</h2>
        {products.length === 0 ? (
          <div
            style={{
              padding: '2rem',
              background: '#fff3cd',
              border: '1px solid #ffc107',
              borderRadius: '8px',
              marginTop: '1rem',
            }}
          >
            <p style={{ margin: 0, fontWeight: 500 }}>
              No products found. Make sure the UDL server is running:
            </p>
            <pre
              style={{
                background: '#f5f5f5',
                padding: '0.5rem 1rem',
                borderRadius: '4px',
                marginTop: '0.5rem',
              }}
            >
              npm run udl:dev
            </pre>
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
              gap: '1.5rem',
              marginTop: '1rem',
            }}
          >
            {products.map((product) => (
              <ProductCard key={product.slug} product={product} />
            ))}
          </div>
        )}
      </section>

      <section style={{ marginTop: '3rem' }}>
        <h2>How It Works</h2>
        <p>This example includes:</p>
        <ul style={{ lineHeight: 1.8 }}>
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

      <section style={{ marginTop: '2rem' }}>
        <h2>Running the Example</h2>
        <ol style={{ lineHeight: 2 }}>
          <li>
            Start the UDL server: <code>npm run udl:dev</code>
          </li>
          <li>
            In another terminal, start Next.js: <code>npm run dev</code>
          </li>
        </ol>
      </section>

      <section style={{ marginTop: '2rem' }}>
        <h2>Example Query</h2>
        <pre
          style={{
            background: '#f5f5f5',
            padding: '1rem',
            borderRadius: '8px',
            overflow: 'auto',
          }}
        >
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
