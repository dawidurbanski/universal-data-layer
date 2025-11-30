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
    <main className="p-8 font-sans">
      <Link
        href="/"
        className="text-blue-500 no-underline inline-flex items-center gap-2 mb-8"
      >
        &larr; Back to Products
      </Link>

      <div className="max-w-3xl">
        <h1 className="m-0 mb-2">{product.name}</h1>
        <p className="text-2xl font-bold m-0 mb-4">
          ${product.price.toFixed(2)}
        </p>
        <p className="text-gray-500 leading-relaxed m-0 mb-8">
          {product.description}
        </p>

        <section>
          <h2 className="m-0 mb-4">Variants</h2>
          {product.variants && product.variants.length > 0 ? (
            <div className="grid gap-4">
              {product.variants.map((variant) => (
                <div
                  key={variant.sku}
                  className="border border-gray-200 rounded-lg p-4 flex justify-between items-center"
                >
                  <div>
                    <p className="m-0 mb-1 font-medium">{variant.name}</p>
                    <p className="m-0 text-sm text-gray-500">
                      SKU: {variant.sku}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="m-0 mb-1 font-bold">
                      ${variant.price.toFixed(2)}
                    </p>
                    <p
                      className={`m-0 text-sm ${variant.inStock ? 'text-green-500' : 'text-red-500'}`}
                    >
                      {variant.inStock ? 'In Stock' : 'Out of Stock'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500">No variants available.</p>
          )}
        </section>

        <section className="mt-12">
          <h2>Example Query</h2>
          <pre className="bg-gray-100 p-4 rounded-lg overflow-auto">
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
