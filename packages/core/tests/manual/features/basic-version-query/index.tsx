import { useState } from 'react';

export default function BasicVersionQuery() {
  const [version, setVersion] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [response, setResponse] = useState<string>('');

  const fetchVersion = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('http://localhost:4000/graphql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: `
            query {
              version
            }
          `,
        }),
      });

      const data = await response.json();

      if (data.errors) {
        setError(data.errors[0].message);
      } else {
        setVersion(data.data.version);
        setResponse(JSON.stringify(data, null, 2));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch version');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl">
      <div className="space-y-4">
        <button
          onClick={fetchVersion}
          disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          {loading ? 'Loading...' : 'Fetch Version'}
        </button>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <h4 className="font-semibold text-red-900 mb-1">Error</h4>
            <p className="text-red-700">{error}</p>
          </div>
        )}

        {version && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <h4 className="text-lg font-semibold text-green-900 mb-1">
              Success!
            </h4>
            <p className="text-green-900 mb-1">
              Current UDL version is:{' '}
              <span className="font-semibold">{version}</span>
            </p>
            <p className="text-green-900 mb-1">Full response:</p>
            <pre className="text-green-900 border-green-300 p-3 rounded border bg-green-100 overflow-x-auto">
              {response}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
