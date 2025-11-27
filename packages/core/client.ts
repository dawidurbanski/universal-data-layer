/**
 * Client-side entry point for universal-data-layer
 *
 * This module exports only browser-compatible utilities.
 * Use this in client-side code instead of the main entry point.
 */

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
