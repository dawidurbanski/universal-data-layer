import Link from 'next/link';
import { notFound } from 'next/navigation';
import { udl, gql } from '../../lib/udl';

interface Variant {
  name: string;
  sku: string;
  price: number;
  inStock: boolean;
}

interface Product {
  name: string;
  slug: string;
  description: string;
  price: number;
  variants: Variant[];
}

async function getProduct(slug: string): Promise<Product | null> {
  try {
    const product = await udl.query<Product | null>(
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
      { slug }
    );
    return product;
  } catch (error) {
    console.error('Failed to fetch product from UDL:', error);
    return null;
  }
}

async function getAllProducts(): Promise<Array<{ slug: string }>> {
  try {
    const products = await udl.query<Array<{ slug: string }>>(gql`
      {
        allContentfulProducts {
          slug
        }
      }
    `);
    return products;
  } catch {
    return [];
  }
}

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function ProductPage({ params }: PageProps) {
  const { slug } = await params;
  const product = await getProduct(slug);

  if (!product) {
    notFound();
  }

  return (
    <main style={{ padding: '2rem', fontFamily: 'system-ui, sans-serif' }}>
      <Link
        href="/"
        style={{
          color: '#0070f3',
          textDecoration: 'none',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.5rem',
          marginBottom: '2rem',
        }}
      >
        &larr; Back to Products
      </Link>

      <div style={{ maxWidth: '800px' }}>
        <h1 style={{ margin: '0 0 0.5rem 0' }}>{product.name}</h1>
        <p
          style={{
            fontSize: '1.5rem',
            fontWeight: 'bold',
            margin: '0 0 1rem 0',
          }}
        >
          ${product.price.toFixed(2)}
        </p>
        <p style={{ color: '#666', lineHeight: 1.6, margin: '0 0 2rem 0' }}>
          {product.description}
        </p>

        <section>
          <h2 style={{ margin: '0 0 1rem 0' }}>Variants</h2>
          {product.variants && product.variants.length > 0 ? (
            <div style={{ display: 'grid', gap: '1rem' }}>
              {product.variants.map((variant) => (
                <div
                  key={variant.sku}
                  style={{
                    border: '1px solid #e0e0e0',
                    borderRadius: '8px',
                    padding: '1rem',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <div>
                    <p style={{ margin: '0 0 0.25rem 0', fontWeight: 500 }}>
                      {variant.name}
                    </p>
                    <p
                      style={{ margin: 0, fontSize: '0.875rem', color: '#666' }}
                    >
                      SKU: {variant.sku}
                    </p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ margin: '0 0 0.25rem 0', fontWeight: 'bold' }}>
                      ${variant.price.toFixed(2)}
                    </p>
                    <p
                      style={{
                        margin: 0,
                        fontSize: '0.875rem',
                        color: variant.inStock ? '#22c55e' : '#ef4444',
                      }}
                    >
                      {variant.inStock ? 'In Stock' : 'Out of Stock'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ color: '#666' }}>No variants available.</p>
          )}
        </section>

        <section style={{ marginTop: '3rem' }}>
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

const product = await udl.query(gql\`
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
\`, { slug: "${slug}" });`}
          </pre>
        </section>
      </div>
    </main>
  );
}

export async function generateStaticParams() {
  const products = await getAllProducts();
  return products.map((product) => ({
    slug: product.slug,
  }));
}
