import { useState } from 'react';

const GRAPHQL_ENDPOINT = 'http://localhost:4000/graphql';

interface ContentfulNode {
  contentfulId: string;
  sys: {
    id: string;
    type: string;
    createdAt: string;
    updatedAt: string;
  };
  internal: {
    id: string;
    type: string;
  };
  [key: string]: unknown;
}

export default function ContentfulDemo() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [nodeTypes, setNodeTypes] = useState<string[]>([]);
  const [selectedType, setSelectedType] = useState<string>('');
  const [nodes, setNodes] = useState<ContentfulNode[]>([]);
  const [introspectionDone, setIntrospectionDone] = useState(false);

  const fetchNodeTypes = async () => {
    setLoading(true);
    setError('');
    setNodeTypes([]);
    setNodes([]);

    try {
      // Introspect the schema to find Contentful types
      const response = await fetch(GRAPHQL_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `{
            __schema {
              types {
                name
                kind
              }
            }
          }`,
        }),
      });

      const json = await response.json();

      if (json.errors) {
        throw new Error(json.errors[0]?.message || 'GraphQL error');
      }

      // Filter for Contentful types (those starting with "Contentful" and are OBJECT types)
      const types = json.data.__schema.types
        .filter(
          (t: { name: string; kind: string }) =>
            t.name.startsWith('Contentful') &&
            t.kind === 'OBJECT' &&
            !t.name.startsWith('ContentfulInternal')
        )
        .map((t: { name: string }) => t.name)
        .sort();

      setNodeTypes(types);
      setIntrospectionDone(true);

      if (types.length > 0) {
        setSelectedType(types[0]);
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to fetch types';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const fetchNodes = async () => {
    if (!selectedType) return;

    setLoading(true);
    setError('');
    setNodes([]);

    try {
      // Query for all nodes of the selected type
      const queryName = `all${selectedType}`;
      const response = await fetch(GRAPHQL_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `{
            ${queryName} {
              contentfulId
              sys {
                id
                type
                createdAt
                updatedAt
              }
              internal {
                id
                type
              }
            }
          }`,
        }),
      });

      const json = await response.json();

      if (json.errors) {
        throw new Error(json.errors[0]?.message || 'GraphQL error');
      }

      setNodes(json.data[queryName] || []);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to fetch nodes';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-6xl">
      <div className="space-y-6">
        {/* Configuration Info */}
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

        {/* Environment Variables */}
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

        {/* Connection Test */}
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <h4 className="font-semibold text-gray-900 mb-3">Test Connection</h4>
          <p className="text-sm text-gray-600 mb-3">
            Make sure the UDL server is running with the Contentful plugin
            configured, then click to discover available content types.
          </p>
          <button
            onClick={fetchNodeTypes}
            disabled={loading}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium"
          >
            {loading ? 'Loading...' : 'Discover Content Types'}
          </button>
        </div>

        {/* Error Display */}
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

        {/* Node Types */}
        {introspectionDone && nodeTypes.length === 0 && !error && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <h4 className="font-semibold text-yellow-900 mb-1">
              No Contentful Types Found
            </h4>
            <p className="text-yellow-700 text-sm">
              The server is running but no Contentful types were found. Make
              sure the plugin is configured correctly and has synced content.
            </p>
          </div>
        )}

        {nodeTypes.length > 0 && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <h4 className="font-semibold text-green-900 mb-3">
              Discovered Content Types ({nodeTypes.length})
            </h4>
            <div className="flex flex-wrap gap-2 mb-4">
              {nodeTypes.map((type) => (
                <button
                  key={type}
                  onClick={() => setSelectedType(type)}
                  className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                    selectedType === type
                      ? 'bg-green-600 text-white'
                      : 'bg-green-100 text-green-800 hover:bg-green-200'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>

            {selectedType && (
              <button
                onClick={fetchNodes}
                disabled={loading}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium text-sm"
              >
                {loading ? 'Loading...' : `Fetch ${selectedType} Nodes`}
              </button>
            )}
          </div>
        )}

        {/* Nodes Display */}
        {nodes.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h4 className="text-lg font-semibold text-gray-900 mb-4">
              {selectedType} Nodes ({nodes.length} total)
            </h4>

            <div className="space-y-3">
              {nodes.slice(0, 10).map((node) => (
                <div
                  key={node.internal.id}
                  className="border border-gray-200 rounded-lg p-4 bg-gray-50"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="inline-block bg-blue-100 text-blue-800 text-xs font-semibold px-2 py-1 rounded">
                          {node.internal.type}
                        </span>
                        <span className="inline-block bg-gray-100 text-gray-600 text-xs font-mono px-2 py-1 rounded">
                          {node.contentfulId}
                        </span>
                      </div>
                      <div className="text-xs text-gray-500 space-y-1">
                        <p>
                          <span className="font-medium">Node ID:</span>{' '}
                          {node.internal.id}
                        </p>
                        <p>
                          <span className="font-medium">Created:</span>{' '}
                          {new Date(node.sys.createdAt).toLocaleString()}
                        </p>
                        <p>
                          <span className="font-medium">Updated:</span>{' '}
                          {new Date(node.sys.updatedAt).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              {nodes.length > 10 && (
                <p className="text-gray-500 text-sm text-center">
                  ... and {nodes.length - 10} more nodes
                </p>
              )}
            </div>
          </div>
        )}

        {/* Features */}
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
