/**
 * UDL Query Helper
 *
 * Provides a simple, typed interface for executing GraphQL queries against
 * the UDL server with automatic __typename injection and response unwrapping.
 */

import type { TypedDocumentNode } from '@graphql-typed-document-node/core';
import { type DocumentNode, print, parse } from 'graphql';
import { getConfig } from './config.js';
import { addTypenameToDocument } from './utils/addTypename.js';
import { resolveRefs, type NormalizedResponse } from './client/resolveRefs.js';

/**
 * Error type returned by query functions
 */
export interface QueryError {
  message: string;
  type: 'network' | 'graphql' | 'unknown';
  status?: number;
  graphqlErrors?: Array<{ message: string }>;
}

/**
 * Unwraps a query result type by extracting the value of the first (and typically only) field.
 * This matches the runtime behavior where `{ allProducts: Product[] }` becomes `Product[]`.
 */
export type UnwrapQueryResult<T> = T extends { [K in keyof T]: infer V }
  ? V
  : T;

/**
 * Result tuple type for query functions.
 * Returns [error, null] on failure or [null, data] on success.
 * The data type is unwrapped to extract the first field value.
 */
export type QueryResultTuple<T> =
  | [QueryError, null]
  | [null, UnwrapQueryResult<T>];

/**
 * Options for the query function (base interface)
 */
export interface QueryOptionsBase {
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
 * Options for the query function with explicit variables
 */
export interface QueryOptions extends QueryOptionsBase {
  /**
   * Variables to pass to the query
   */
  variables?: Record<string, unknown>;
}

/**
 * Options for TypedDocumentNode queries with typed variables
 */
export interface TypedQueryOptions<TVariables> extends QueryOptionsBase {
  /**
   * Variables to pass to the query (typed)
   */
  variables: TVariables;
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
 * Execute a GraphQL query against the UDL server.
 *
 * Returns a tuple `[error, data]` where:
 * - On success: `[null, data]` - data contains the query result
 * - On failure: `[error, null]` - error contains details about what went wrong
 *
 * Features:
 * - Automatically adds __typename to all selection sets for normalization
 * - Unwraps query responses to return just the data (no wrapper object)
 * - Returns resolved, denormalized data by default
 * - Never throws - always returns a tuple for predictable error handling
 *
 * @param query - GraphQL query as DocumentNode (from gql``) or string
 * @param options - Query options including variables and endpoint
 * @returns Promise resolving to `[error, null]` or `[null, data]`
 *
 * @example
 * ```ts
 * // Simple query
 * const [error, product] = await query(gql`{
 *   contentfulProduct(contentfulId: "abc123") {
 *     name
 *     price
 *   }
 * }`);
 *
 * if (error) {
 *   console.error('Query failed:', error.message);
 *   return;
 * }
 * // product is now typed as { name: string, price: number }
 *
 * // With variables
 * const [error, product] = await query(
 *   gql`query GetProduct($id: String!) {
 *     contentfulProduct(contentfulId: $id) {
 *       name
 *     }
 *   }`,
 *   { variables: { id: "abc123" } }
 * );
 *
 * // All items query (returns array)
 * const [error, products] = await query(gql`{
 *   allContentfulProducts {
 *     name
 *   }
 * }`);
 * // products is [{ name: "..." }, ...]
 *
 * // With TypedDocumentNode (auto-infers types)
 * import { GetProductQuery } from '@/generated/queries';
 * const [error, product] = await query(GetProductQuery, { variables: { slug: 'my-product' } });
 * // product is typed as GetProductResult
 * ```
 */

// Overload 1: TypedDocumentNode without variables (empty object or Record<string, never>)
// Returns unwrapped result type (extracts value from { fieldName: Value } wrapper)
export function query<TData>(
  document: TypedDocumentNode<TData, Record<string, never>>,
  options?: QueryOptionsBase
): Promise<[QueryError, null] | [null, UnwrapQueryResult<TData>]>;

// Overload 2: TypedDocumentNode with required variables
// Returns unwrapped result type (extracts value from { fieldName: Value } wrapper)
export function query<TData, TVariables extends Record<string, unknown>>(
  document: TypedDocumentNode<TData, TVariables>,
  options: TypedQueryOptions<TVariables>
): Promise<[QueryError, null] | [null, UnwrapQueryResult<TData>]>;

// Overload 3: Backward compatible - DocumentNode or string with manual type
// User provides the already-unwrapped result type directly
export function query<T = unknown>(
  queryInput: DocumentNode | string,
  options?: QueryOptions
): Promise<[QueryError, null] | [null, T]>;

// Implementation
export async function query<T = unknown>(
  queryInput: DocumentNode | TypedDocumentNode<T, unknown> | string,
  options: QueryOptions = {}
): Promise<QueryResultTuple<T>> {
  const { variables, resolveRefs: shouldResolve = true, endpoint } = options;

  try {
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
      return [
        {
          message: `GraphQL request failed: ${response.statusText}`,
          type: 'network',
          status: response.status,
        },
        null,
      ];
    }

    const result = (await response.json()) as NormalizedResponse & {
      errors?: Array<{ message: string }>;
    };

    // Handle GraphQL errors
    if (result.errors && result.errors.length > 0) {
      return [
        {
          message: `GraphQL error: ${result.errors[0]?.message}`,
          type: 'graphql',
          graphqlErrors: result.errors,
        },
        null,
      ];
    }

    // Get the root field name to determine unwrapping behavior
    let rootField: string | null = null;
    for (const definition of document.definitions) {
      if (definition.kind === 'OperationDefinition') {
        const firstSelection = definition.selectionSet.selections[0];
        if (firstSelection?.kind === 'Field') {
          rootField = firstSelection.name.value;
          break;
        }
      }
    }

    // Resolve refs if requested (default)
    let data: unknown;
    if (shouldResolve && result.$entities) {
      data = resolveRefs(result as NormalizedResponse);
    } else {
      data = result.data;
    }

    // Unwrap queries by extracting the root field value
    // For single item queries: { contentfulProduct: {...} } -> {...}
    // For collection queries: { allContentfulProducts: [...] } -> [...]
    if (rootField && typeof data === 'object' && data !== null) {
      const dataRecord = data as Record<string, unknown>;
      if (rootField in dataRecord) {
        return [null, dataRecord[rootField] as UnwrapQueryResult<T>];
      }
    }

    return [null, data as UnwrapQueryResult<T>];
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return [
      {
        message,
        type: 'unknown',
      },
      null,
    ];
  }
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
 * const [error, data] = await remoteQuery(gql`{ ... }`);
 * ```
 */
export function createQuery(endpoint: string) {
  return <T = unknown>(
    queryInput: DocumentNode | string,
    options: Omit<QueryOptions, 'endpoint'> = {}
  ): Promise<[QueryError, null] | [null, T]> => {
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
 * const [error, product] = await udl.query(gql`{
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
 *
 * if (error) {
 *   console.error('Failed:', error.message);
 *   return;
 * }
 * // product is available here
 * ```
 */
export const udl = {
  query,
  gql,
  createQuery,
};
