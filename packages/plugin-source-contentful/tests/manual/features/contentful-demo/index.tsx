import { useEffect, useState } from 'react';
import { udl, gql } from 'universal-data-layer/client';
import type { ContentfulProduct } from '@udl/plugin-source-contentful/generated';

export default function ContentfulDemo() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [product, setProduct] = useState<unknown>(null);

  useEffect(() => {
    async function fetchProduct() {
      setProduct(
        await udl.query<ContentfulProduct[]>(gql`
          {
            contentfulProduct(slug: "classic-t-shirt") {
              name
              slug
              description
              price
            }
          }
        `)
      );
    }

    try {
      setLoading(true);
      setError('');
      fetchProduct();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch product');
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <div className="max-w-6xl">
      <div className="space-y-6">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="font-semibold text-blue-900 mb-2">
            Plugin Configuration
          </h4>
          <p className="text-sm text-blue-700 mb-3">
            Configure the Contentful source plugin in your{' '}
            <code>udl.config.ts</code>:
          </p>
          <div className="bg-blue-900 text-blue-100 rounded p-3 font-mono text-sm overflow-x-auto whitespace-pre">
            {`{
  resolve: '@udl/plugin-source-contentful',
  options: {
    spaceId: process.env.CONTENTFUL_SPACE_ID,
    accessToken: process.env.CONTENTFUL_ACCESS_TOKEN,
  },
}`}
          </div>
        </div>

        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <h4 className="font-semibold text-yellow-900 mb-2">
            Required Environment Variables
          </h4>
          <ul className="text-sm text-yellow-800 space-y-1">
            <li>
              <code>CONTENTFUL_SPACE_ID</code> - Your Contentful space ID
            </li>
            <li>
              <code>CONTENTFUL_ACCESS_TOKEN</code> - Delivery API access token
            </li>
          </ul>
          <p className="text-xs text-yellow-700 mt-2">
            Get these from:{' '}
            <span className="font-mono">
              app.contentful.com → Settings → API keys
            </span>
          </p>
        </div>

        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <h4 className="font-semibold text-gray-900 mb-2">Product</h4>
          {loading ? (
            <p className="text-gray-700">Loading product...</p>
          ) : (
            <pre>{JSON.stringify(product, null, 2)}</pre>
          )}
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <h4 className="font-semibold text-red-900 mb-1">Error</h4>
            <p className="text-red-700 font-mono text-sm">{error}</p>
            <p className="text-red-600 text-sm mt-2">
              Make sure the UDL server is running on port 4000 with the
              Contentful plugin configured.
            </p>
          </div>
        )}

        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
          <h4 className="font-semibold text-purple-900 mb-2">
            Plugin Features
          </h4>
          <ul className="text-sm text-purple-800 space-y-2">
            <li>
              ✓ <strong>Sync API</strong> - Efficient incremental updates
            </li>
            <li>
              ✓ <strong>Auto-discovery</strong> - All content types sourced
              automatically
            </li>
            <li>
              ✓ <strong>Reference handling</strong> - Linked entries/assets
              stored as references
            </li>
            <li>
              ✓ <strong>Rich text support</strong> - Raw JSON with extracted
              references
            </li>
            <li>
              ✓ <strong>Multiple spaces</strong> - Use nodePrefix for different
              spaces
            </li>
            <li>
              ✓ <strong>Preview mode</strong> - Fetch draft content with preview
              API
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
