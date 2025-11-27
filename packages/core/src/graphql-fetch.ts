/**
 * GraphQL Fetch Utility
 *
 * A typed fetch helper for executing GraphQL queries against the UDL server.
 * Automatically uses the configured server endpoint.
 */

import { getConfig } from './config.js';

/**
 * GraphQL error structure
 */
export interface GraphQLError {
  message: string;
  locations?: Array<{ line: number; column: number }>;
  path?: Array<string | number>;
}

/**
 * GraphQL response structure
 */
export interface GraphQLResponse<T> {
  data?: T;
  errors?: GraphQLError[];
}

/**
 * Execute a GraphQL query against the UDL server.
 *
 * Uses the server's configured endpoint automatically.
 *
 * @param query - The GraphQL query string
 * @param variables - Optional variables for the query
 * @returns Promise resolving to the query result
 * @throws Error if the request fails or GraphQL returns errors
 *
 * @example
 * ```ts
 * const data = await graphqlFetch<{ allTodo: Todo[] }>(
 *   `{ allTodo { id title completed } }`
 * );
 * console.log(data.allTodo);
 * ```
 */
export async function graphqlFetch<T>(
  query: string,
  variables?: Record<string, unknown>
): Promise<T> {
  const config = getConfig();
  const endpoint = config.endpoint;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    throw new Error(`GraphQL request failed: ${response.statusText}`);
  }

  const result = (await response.json()) as GraphQLResponse<T>;

  if (result.errors && result.errors.length > 0) {
    throw new Error(`GraphQL error: ${result.errors[0]?.message}`);
  }

  if (!result.data) {
    throw new Error('No data returned from GraphQL query');
  }

  return result.data;
}
