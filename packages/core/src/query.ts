/**
 * UDL Query Helper
 *
 * Provides a simple, typed interface for executing GraphQL queries against
 * the UDL server with automatic __typename injection and response unwrapping.
 */

import { type DocumentNode, print, parse } from 'graphql';
import { getConfig } from './config.js';
import { addTypenameToDocument } from './utils/addTypename.js';
import { resolveRefs, type NormalizedResponse } from './client/resolveRefs.js';

/**
 * Options for the query function
 */
export interface QueryOptions {
  /**
   * Variables to pass to the query
   */
  variables?: Record<string, unknown>;

  /**
   * Whether to resolve refs in the response (default: true)
   * When false, returns normalized response with $entities
   */
  resolveRefs?: boolean;

  /**
   * Custom endpoint URL (defaults to configured endpoint)
   */
  endpoint?: string;
}

/**
 * Result type for query - either resolved data or normalized response
 */
export type QueryResult<T> = T;

/**
 * GraphQL tagged template literal.
 * Parses a GraphQL query string into a DocumentNode.
 *
 * @example
 * ```ts
 * const query = gql`
 *   query GetProduct($id: String!) {
 *     contentfulProduct(contentfulId: $id) {
 *       name
 *       price
 *     }
 *   }
 * `;
 * ```
 */
export function gql(
  strings: TemplateStringsArray,
  ...values: unknown[]
): DocumentNode {
  // Combine template strings with interpolated values
  const query = strings.reduce((acc, str, i) => {
    return acc + str + (values[i] ?? '');
  }, '');

  return parse(query);
}

/**
 * Extracts the root query field name from a document.
 * Used to determine if we should unwrap the response.
 */
function getRootFieldName(document: DocumentNode): string | null {
  for (const definition of document.definitions) {
    if (definition.kind === 'OperationDefinition') {
      const firstSelection = definition.selectionSet.selections[0];
      if (firstSelection?.kind === 'Field') {
        return firstSelection.name.value;
      }
    }
  }
  return null;
}

/**
 * Execute a GraphQL query against the UDL server.
 *
 * Features:
 * - Automatically adds __typename to all selection sets for normalization
 * - Unwraps query responses to return just the data (no wrapper object)
 * - Returns resolved, denormalized data by default
 *
 * @param query - GraphQL query as DocumentNode (from gql``) or string
 * @param options - Query options including variables and endpoint
 * @returns Promise resolving to the query result
 *
 * @example
 * ```ts
 * // Simple query
 * const product = await query(gql`{
 *   contentfulProduct(contentfulId: "abc123") {
 *     name
 *     price
 *   }
 * }`);
 * // Returns: { name: "...", price: 99.99 }
 *
 * // With variables
 * const product = await query(
 *   gql`query GetProduct($id: String!) {
 *     contentfulProduct(contentfulId: $id) {
 *       name
 *     }
 *   }`,
 *   { variables: { id: "abc123" } }
 * );
 *
 * // All items query (returns array)
 * const products = await query(gql`{
 *   allContentfulProducts {
 *     name
 *   }
 * }`);
 * // Returns: [{ name: "..." }, ...]
 * ```
 */
export async function query<T = unknown>(
  queryInput: DocumentNode | string,
  options: QueryOptions = {}
): Promise<T> {
  const { variables, resolveRefs: shouldResolve = true, endpoint } = options;

  // Parse string queries
  const document =
    typeof queryInput === 'string' ? parse(queryInput) : queryInput;

  // Add __typename to all selection sets
  const documentWithTypename = addTypenameToDocument(document);

  // Convert to string for fetch
  const queryString = print(documentWithTypename);

  // Determine endpoint
  const config = getConfig();
  const fetchEndpoint = endpoint ?? config.endpoint;

  // Execute query
  const response = await fetch(fetchEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: queryString,
      variables,
    }),
  });

  if (!response.ok) {
    throw new Error(`GraphQL request failed: ${response.statusText}`);
  }

  const result = (await response.json()) as NormalizedResponse & {
    errors?: Array<{ message: string }>;
  };

  // Handle GraphQL errors
  if (result.errors && result.errors.length > 0) {
    throw new Error(`GraphQL error: ${result.errors[0]?.message}`);
  }

  // Get the root field name to determine unwrapping behavior
  const rootField = getRootFieldName(document);

  // Resolve refs if requested (default)
  let data: unknown;
  if (shouldResolve && result.$entities) {
    data = resolveRefs(result as NormalizedResponse);
  } else {
    data = result.data;
  }

  // Unwrap queries by extracting the root field value
  // For single item queries: { __typename: "Query", contentfulProduct: {...} } -> {...}
  // For collection queries: { __typename: "Query", allTodos: [...] } -> [...]
  if (rootField && typeof data === 'object' && data !== null) {
    const dataRecord = data as Record<string, unknown>;
    if (rootField in dataRecord) {
      return dataRecord[rootField] as T;
    }
  }

  return data as T;
}

/**
 * Create a query function bound to a specific endpoint.
 *
 * @param endpoint - The GraphQL endpoint URL
 * @returns A query function that uses the specified endpoint
 *
 * @example
 * ```ts
 * const remoteQuery = createQuery('https://api.example.com/graphql');
 * const data = await remoteQuery(gql`{ ... }`);
 * ```
 */
export function createQuery(endpoint: string) {
  return <T = unknown>(
    queryInput: DocumentNode | string,
    options: Omit<QueryOptions, 'endpoint'> = {}
  ): Promise<T> => {
    return query<T>(queryInput, { ...options, endpoint });
  };
}

/**
 * UDL client object providing query methods.
 *
 * @example
 * ```ts
 * import { udl, gql } from 'universal-data-layer';
 *
 * const product = await udl.query(gql`{
 *   contentfulProduct(contentfulId: "abc123") {
 *     name
 *     pageSections {
 *       ... on ContentfulPageSectionsContent {
 *         header
 *         blocks {
 *           ... on ContentfulBlockCallToAction {
 *             name
 *           }
 *         }
 *       }
 *     }
 *   }
 * }`);
 * ```
 */
export const udl = {
  query,
  gql,
  createQuery,
};
