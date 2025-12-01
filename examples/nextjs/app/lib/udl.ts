import { parse, print, type DocumentNode } from 'graphql';

const UDL_ENDPOINT =
  process.env['UDL_ENDPOINT'] || 'http://localhost:4000/graphql';

/**
 * GraphQL tagged template literal.
 * Parses a GraphQL query string into a DocumentNode.
 */
export function gql(
  strings: TemplateStringsArray,
  ...values: unknown[]
): DocumentNode {
  const query = strings.reduce((acc, str, i) => {
    return acc + str + (values[i] ?? '');
  }, '');
  return parse(query);
}

/**
 * Execute a GraphQL query against the UDL server.
 * This is a lightweight client that works in Next.js without bundler issues.
 */
export async function query<T = unknown>(
  queryInput: DocumentNode | string,
  variables?: Record<string, unknown>
): Promise<T> {
  const queryString =
    typeof queryInput === 'string' ? queryInput : print(queryInput);

  const response = await fetch(UDL_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: queryString, variables }),
  });

  if (!response.ok) {
    throw new Error(`GraphQL request failed: ${response.statusText}`);
  }

  const result = (await response.json()) as {
    data?: Record<string, unknown>;
    errors?: Array<{ message: string }>;
  };

  if (result.errors && result.errors.length > 0) {
    throw new Error(`GraphQL error: ${result.errors[0]?.message}`);
  }

  // Unwrap the query response - extract the first field value
  if (result.data) {
    const keys = Object.keys(result.data);
    if (keys.length === 1) {
      return result.data[keys[0]!] as T;
    }
  }

  return result.data as T;
}

export const udl = { query, gql };
