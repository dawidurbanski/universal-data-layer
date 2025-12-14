/**
 * Client-side entry point for universal-data-layer
 *
 * This module exports only browser-compatible utilities.
 * Use this in client-side code instead of the main entry point.
 *
 * @example
 * ```ts
 * import { udl, gql } from 'universal-data-layer/client';
 *
 * const [error, product] = await udl.query(gql`{
 *   product(id: "abc123") {
 *     name
 *   }
 * }`);
 *
 * if (error) {
 *   console.error('Failed:', error.message);
 *   return;
 * }
 * ```
 */

// Export query utilities
export {
  udl,
  query,
  gql,
  createQuery,
  type QueryOptions,
  type QueryError,
  type QueryResultTuple,
} from './src/query.js';

// Export client utilities
export { resolveRefs, type NormalizedResponse } from './src/client/index.js';

// Export GraphQL fetch utility for generated helpers
export {
  graphqlFetch,
  type GraphQLError,
  type GraphQLResponse,
} from './src/graphql-fetch.js';

// Export config utilities (browser-safe)
export { getConfig, createConfig, type Config } from './src/config.js';

// Export node types for generated code
export type { NodeInternal } from './src/nodes/types.js';
