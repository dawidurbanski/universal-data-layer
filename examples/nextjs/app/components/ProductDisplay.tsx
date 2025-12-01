'use client';

import Image from 'next/image';
import { useState } from 'react';
import { ImageSlider } from './ImageSlider';
import {
  ContentfulProduct,
  ContentfulVariant,
} from '@udl/plugin-source-contentful/generated';

function getVariantImages(variant: ContentfulVariant): string[] {
  const images: string[] = [];

  if (variant.mainImage?.file?.url) {
    images.push(variant.mainImage.file.url);
  }
  for (const img of variant.images || []) {
    if (img.file?.url) {
      images.push(img.file.url);
    }
  }

  return images;
}

interface ProductDisplayProps {
  product: ContentfulProduct;
}

export function ProductDisplay({ product }: ProductDisplayProps) {
  const [currentVariantIndex, setCurrentVariantIndex] = useState(0);
  const currentVariant = product.variants?.[currentVariantIndex];

  const variantImages = currentVariant ? getVariantImages(currentVariant) : [];

  return (
    <>
      <div className="grid md:grid-cols-2 gap-8 mb-8">
        <ImageSlider
          images={variantImages}
          alt={currentVariant?.name || product.name}
        />
        <div>
          <h1 className="m-0 mb-2">{currentVariant?.name || product.name}</h1>
          <p className="text-2xl font-bold m-0 mb-4">
            ${(currentVariant?.price ?? product.price).toFixed(2)}
          </p>
          <p className="text-gray-500 leading-relaxed m-0">
            {product.description}
          </p>
          {currentVariant && (
            <p
              className={`mt-4 text-sm font-medium ${currentVariant.inStock ? 'text-green-600' : 'text-red-600'}`}
            >
              {currentVariant.inStock ? 'In Stock' : 'Out of Stock'}
            </p>
          )}
        </div>
      </div>

      <section>
        <h2 className="m-0 mb-4">Variants</h2>
        {product.variants && product.variants.length > 0 ? (
          <div className="grid gap-4">
            {product.variants.map((variant, index) => (
              <button
                key={variant.sku}
                onClick={() => setCurrentVariantIndex(index)}
                className={`border rounded-lg p-4 flex items-center gap-4 text-left transition-all cursor-pointer ${
                  index === currentVariantIndex
                    ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
                    : 'border-gray-200 hover:border-gray-300 bg-white'
                }`}
              >
                {variant.mainImage?.file?.url && (
                  <Image
                    src={variant.mainImage.file.url}
                    alt={variant.name}
                    width={64}
                    height={64}
                    className="w-16 h-16 object-cover rounded"
                  />
                )}
                <div className="flex-1">
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
              </button>
            ))}
          </div>
        ) : (
          <p className="text-gray-500">No variants available.</p>
        )}
      </section>
    </>
  );
}
