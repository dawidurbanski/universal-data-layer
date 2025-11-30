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
      className="no-underline text-inherit"
    >
      <article className="border border-gray-200 rounded-lg p-6 cursor-pointer transition-shadow duration-200 hover:shadow-lg">
        <h3 className="m-0 mb-2">{product.name}</h3>
        <p className="text-gray-500 text-sm m-0 mb-4">{product.description}</p>
        <p className="font-bold text-xl m-0">${product.price.toFixed(2)}</p>
      </article>
    </Link>
  );
}
