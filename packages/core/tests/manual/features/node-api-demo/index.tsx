import { resolveRefs } from '@core/client';
import { useState } from 'react';

interface NodeDisplay {
  id: string;
  type: string;
  owner: string;
  fields: Record<string, unknown>;
}

interface StoreStats {
  totalNodes: number;
  nodeTypes: string[];
}

export default function NodeApiDemo() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [nodes, setNodes] = useState<NodeDisplay[]>([]);
  const [stats, setStats] = useState<StoreStats | null>(null);

  const queryGraphQL = async () => {
    setLoading(true);
    setError('');
    setNodes([]);
    setStats(null);

    try {
      // Query all Product nodes from the GraphQL endpoint
      const response = await fetch('http://localhost:4000/graphql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: `
            query {
              allProducts {
                name
                price
                inStock
                category
                priceCategory
                discountedPrice
                internal {
                  id
                  type
                  owner
                  contentDigest
                }
                externalId
                description
              }
            }
          `,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // TODO: This should be generated from the GraphQL schema
      // Should be handled by Issue #25: [1.3] Create Type System and GraphQL Schema Generation #25
      // See: https://github.com/dawidurbanski/universal-data-layer/issues/25
      type Product = {
        name: string;
        price: number;
        inStock: boolean;
        category: string;
        priceCategory: string;
        discountedPrice: number;
        internal: {
          id: string;
          type: string;
          owner: string;
          contentDigest: string;
        };
        externalId: string;
        description: string;
      };

      const result = await response.json();

      if (result.errors) {
        throw new Error(result.errors[0].message);
      }

      const data = resolveRefs<{ allProducts: Product[] }>(result);

      // Transform GraphQL results to node display format
      const products = (data.allProducts || []) as Product[];
      const nodeDisplays: NodeDisplay[] = products.map((product) => {
        const { internal, ...fields } = product;
        console.log('Product fields:', fields, product);
        return {
          id: internal.id,
          type: internal.type,
          owner: internal.owner,
          fields,
        };
      });

      setNodes(nodeDisplays);
      setStats({
        totalNodes: nodeDisplays.length,
        nodeTypes: ['Product'],
      });
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to query GraphQL';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-6xl">
      <div className="space-y-6">
        {/* Control Section */}
        <button
          onClick={queryGraphQL}
          disabled={loading}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium"
        >
          {loading ? 'Querying...' : 'Query GraphQL Endpoint'}
        </button>

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <h4 className="font-semibold text-red-900 mb-1">Error</h4>
            <p className="text-red-700 font-mono text-sm">{error}</p>
            <p className="text-red-600 text-sm mt-2">
              Make sure the UDL server is running on port 4000
            </p>
          </div>
        )}

        {/* Nodes Display */}
        {nodes.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h4 className="text-lg font-semibold text-gray-900 mb-4">
              Nodes in Store ({nodes.length} total)
            </h4>

            <div className="space-y-4">
              {nodes.map((node) => (
                <div
                  key={node.id}
                  className="border border-gray-300 rounded-lg p-4 bg-gray-50"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <span className="inline-block bg-blue-100 text-blue-800 text-xs font-semibold px-2 py-1 rounded">
                        {node.type}
                      </span>
                      <span className="inline-block bg-green-100 text-green-800 text-xs font-semibold px-2 py-1 rounded ml-2">
                        Owner: {node.owner}
                      </span>
                    </div>
                  </div>

                  <div className="text-xs text-gray-500 font-mono mb-2">
                    ID: {node.id}
                  </div>

                  <div className="bg-white rounded border border-gray-200 p-3">
                    <pre className="text-sm font-mono text-gray-800 overflow-x-auto">
                      {JSON.stringify(node.fields, null, 2)}
                    </pre>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Store Stats */}
        {stats && nodes.length > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-semibold text-blue-900 mb-2">
              Store Statistics
            </h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-blue-700 font-medium">Total Nodes:</span>{' '}
                <span className="text-blue-900">{stats.totalNodes}</span>
              </div>
              <div>
                <span className="text-blue-700 font-medium">Node Types:</span>{' '}
                <span className="text-blue-900">
                  {stats.nodeTypes.join(', ')}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
