import server from './src/server.js';
import { startServer } from './src/start-server.js';

export default server;
export { startServer };

// Export configuration types and helpers
export type {
  UDLConfig,
  UDLConfigFile,
  OnLoadContext,
  PluginSpec,
} from './src/loader.js';
export { defineConfig } from './src/loader.js';

// Export node types and context for plugins
export type { SourceNodesContext } from './src/nodes/index.js';

// Export utility functions
export {
  loadPackageJson,
  getPackageVersion,
  getPackageName,
  getPackageType,
} from './src/utils/package-info.js';

// Export GraphQL fetch utility for generated helpers
export {
  graphqlFetch,
  type GraphQLError,
  type GraphQLResponse,
} from './src/graphql-fetch.js';

// Export query utilities
export {
  udl,
  query,
  gql,
  createQuery,
  type QueryOptions,
} from './src/query.js';

// Export client utilities
export { resolveRefs, type NormalizedResponse } from './src/client/index.js';

// Export schema builder for type hints at createNode call sites
export {
  s,
  InferSchema,
  type SchemaOption,
  type SchemaBuilder,
  z,
} from './src/schema-builder.js';

// Export codegen extension types for extension packages
export type {
  CodegenExtension,
  CodegenExtensionContext,
  CodegenExtensionResult,
  CodegenExtensionSpec,
} from './src/codegen/types/extension.js';

// Export reference registry types for plugins
export type {
  ReferenceResolverConfig,
  ReferenceResolutionContext,
  EntityKeyConfig,
} from './src/references/types.js';

export {
  ReferenceRegistry,
  defaultRegistry,
  setDefaultRegistry,
  createRegistry,
} from './src/references/index.js';
