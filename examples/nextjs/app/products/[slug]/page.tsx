import Link from 'next/link';
import { notFound } from 'next/navigation';
import { udl, gql } from 'universal-data-layer/client';
import { ProductDisplay } from '../../components/ProductDisplay';
import { GetProductBySlug } from '@/generated';

async function getAllProducts(): Promise<Array<{ slug: string }>> {
  const [error, products] = await udl.query<Array<{ slug: string }>>(gql`
    {
      allContentfulProducts {
        slug
      }
    }
  `);

  if (error) {
    return [];
  }

  return products;
}

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function ProductPage({ params }: PageProps) {
  const { slug } = await params;
  const [error, product] = await udl.query(GetProductBySlug, {
    variables: { slug },
  });

  if (error) {
    console.error('Failed to fetch product from UDL:', error);
    throw new Error('Failed to load product.');
  }

  if (!product) {
    notFound();
  }

  return (
    <main className="p-8 font-sans max-w-4xl mx-auto">
      <Link
        href="/"
        className="text-blue-500 no-underline inline-flex items-center gap-2 mb-8"
      >
        &larr; Back to Products
      </Link>

      <ProductDisplay product={product} />

      <section className="mt-12">
        <h2>Example Query</h2>
        <pre className="bg-gray-100 p-4 rounded-lg overflow-auto text-sm">
          {`import { udl, gql } from './lib/udl';

const product = await udl.query(gql\`
  query GetProduct($slug: String!) {
    contentfulProduct(slug: $slug) {
      name
      slug
      description
      price
      image {
        ... on ContentfulAsset {
          file { url }
        }
      }
      variants {
        ... on ContentfulVariant {
          name
          sku
          price
          inStock
          mainImage {
            ... on ContentfulAsset {
              file { url }
            }
          }
          images {
            ... on ContentfulAsset {
              file { url }
            }
          }
        }
      }
    }
  }
\`, { slug: "${slug}" });`}
        </pre>
      </section>
    </main>
  );
}

export async function generateStaticParams() {
  const products = await getAllProducts();
  return products.map((product) => ({
    slug: product.slug,
  }));
}
