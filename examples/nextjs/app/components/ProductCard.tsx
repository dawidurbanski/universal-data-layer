'use client';

import Link from 'next/link';

interface Product {
  name: string;
  slug: string;
  description: string;
  price: number;
}

export function ProductCard({ product }: { product: Product }) {
  return (
    <Link
      href={`/products/${product.slug}`}
      style={{ textDecoration: 'none', color: 'inherit' }}
    >
      <article
        style={{
          border: '1px solid #e0e0e0',
          borderRadius: '8px',
          padding: '1.5rem',
          cursor: 'pointer',
          transition: 'box-shadow 0.2s ease',
        }}
        onMouseOver={(e) =>
          (e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)')
        }
        onMouseOut={(e) => (e.currentTarget.style.boxShadow = 'none')}
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
    </Link>
  );
}
