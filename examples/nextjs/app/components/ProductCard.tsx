import Image from 'next/image';
import Link from 'next/link';

interface ProductCardProps {
  product: {
    name: string;
    slug: string;
    description: string;
    price: number;
    image: {
      file: {
        url: string;
      };
    };
  };
}

export function ProductCard({ product }: ProductCardProps) {
  return (
    <Link
      href={`/products/${product.slug}`}
      className="no-underline text-inherit"
    >
      <article className="border border-gray-200 rounded-lg cursor-pointer transition-shadow duration-200 hover:shadow-lg">
        <Image
          src={product.image.file.url}
          alt={product.name}
          width={300}
          height={400}
          className="w-full object-cover mb-4 rounded-md"
        />
        <div className="p-6">
          <h3 className="m-0 mb-2">{product.name}</h3>
          <p className="text-gray-500 text-sm m-0 mb-4">
            {product.description}
          </p>
          <p className="font-bold text-xl m-0">${product.price.toFixed(2)}</p>
        </div>
      </article>
    </Link>
  );
}
