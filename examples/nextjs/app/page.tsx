// Mock product data for demonstration
// In a real app, you would fetch this from the UDL server:
// import { udl, gql } from 'universal-data-layer';
// const products = await udl.query(gql`{ allContentfulProduct { ... } }`);

interface Product {
  name: string;
  slug: string;
  description: string;
  price: number;
}

const mockProducts: Product[] = [
  {
    name: 'Classic T-Shirt',
    slug: 'classic-t-shirt',
    description:
      'A comfortable cotton t-shirt perfect for everyday wear. Made from 100% organic cotton.',
    price: 29.99,
  },
  {
    name: 'Denim Jacket',
    slug: 'denim-jacket',
    description:
      'A timeless denim jacket that never goes out of style. Features classic button closure and chest pockets.',
    price: 89.99,
  },
];

export default function Home() {
  const products = mockProducts;

  return (
    <main style={{ padding: '2rem', fontFamily: 'system-ui, sans-serif' }}>
      <h1>UDL Next.js Example</h1>
      <p style={{ color: '#666', marginBottom: '2rem' }}>
        This example demonstrates how to use Universal Data Layer with Next.js
        and Contentful.
      </p>

      <section>
        <h2>Products</h2>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
            gap: '1.5rem',
            marginTop: '1rem',
          }}
        >
          {products.map((product) => (
            <article
              key={product.slug}
              style={{
                border: '1px solid #e0e0e0',
                borderRadius: '8px',
                padding: '1.5rem',
              }}
            >
              <h3 style={{ margin: '0 0 0.5rem 0' }}>{product.name}</h3>
              <p
                style={{
                  color: '#666',
                  fontSize: '0.9rem',
                  margin: '0 0 1rem 0',
                }}
              >
                {product.description}
              </p>
              <p style={{ fontWeight: 'bold', fontSize: '1.25rem', margin: 0 }}>
                ${product.price.toFixed(2)}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section style={{ marginTop: '3rem' }}>
        <h2>How It Works</h2>
        <p>This example includes:</p>
        <ul style={{ lineHeight: 1.8 }}>
          <li>
            <strong>MSW Mock Server</strong> - Intercepts Contentful API calls
            and returns mock data (in <code>mocks/</code>)
          </li>
          <li>
            <strong>UDL Configuration</strong> - Shows how to configure the
            Contentful plugin (in <code>udl.config.ts</code>)
          </li>
          <li>
            <strong>Mock Fixtures</strong> - Product and Variant content types
            with sample data
          </li>
        </ul>
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
          {`import { udl, gql } from 'universal-data-layer';

const products = await udl.query(gql\`
  {
    allContentfulProduct {
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
