/**
 * Universal Data Layer - Main Export
 *
 * This is the main entry point for the universal-data-layer package.
 * Exports all public APIs for use by applications and plugins.
 */

// Re-export everything from the nodes module
export * from './nodes/index.js';

// Re-export loader functions and types
export {
  loadAppConfig,
  loadConfigFile,
  loadPlugins,
  defineConfig,
  type UDLConfig,
  type UDLConfigFile,
  type PluginSpec,
  type PluginType,
  type OnLoadContext,
  type LoadConfigFileOptions,
  type LoadPluginsOptions,
  type RegisterTypesContext,
  type CodegenConfig,
} from './loader.js';

// Re-export codegen integration
export { runCodegen, type RunCodegenOptions } from './codegen.js';

// Re-export codegen utilities
export {
  // Types
  type PrimitiveType,
  type ComplexType,
  type FieldType,
  type FieldDefinition,
  type ContentTypeDefinition,
  DEFAULT_CODEGEN_CONFIG,
  resolveCodegenConfig,
  // Registry
  SchemaRegistry,
  defaultRegistry,
  type RegisterTypesContext as CodegenRegisterTypesContext,
  // Inference
  inferSchemaFromStore,
  inferFieldType,
  inferFieldDefinition,
  mergeFieldDefinitions,
  type InferFromStoreOptions,
  type NodeStoreLike,
  introspectGraphQLSchema,
  parseIntrospectionResult,
  clearIntrospectionCache,
  type IntrospectOptions,
  inferSchemaFromResponse,
  mergeResponseInferences,
  inferSchemaFromJsonString,
  type InferFromResponseOptions,
  // Generators
  TypeScriptGenerator,
  generateTypeScript,
  type TypeScriptGeneratorOptions,
  TypeGuardGenerator,
  generateTypeGuards,
  type TypeGuardGeneratorOptions,
  // Output
  FileWriter,
  writeGeneratedFiles,
  type FileWriterOptions,
  type WriteResult,
  type GeneratedFile,
  type OutputMode,
} from './codegen/index.js';

// Re-export config functions
export { createConfig, getConfig, type Config } from './config.js';

// Re-export cache utilities
export {
  FileCacheStorage,
  type CacheStorage,
  type CachedData,
  type SerializedNode,
} from './cache/index.js';

// Re-export env utilities
export { loadEnv, type LoadEnvOptions, type LoadEnvResult } from './env.js';

// Re-export schema builder
export {
  s,
  InferSchema,
  type SchemaOption,
  type SchemaBuilder,
  z,
} from './schema-builder.js';

// Re-export GraphQL fetch utility
export {
  graphqlFetch,
  type GraphQLError,
  type GraphQLResponse,
} from './graphql-fetch.js';

// Re-export query utilities
export { udl, query, gql, createQuery, type QueryOptions } from './query.js';

// Re-export client utilities
export { resolveRefs, type NormalizedResponse } from './client/index.js';

// Re-export normalization utilities
export {
  normalizeResponse,
  normalizeGraphQLResult,
  defaultGetEntityKey,
  type NormalizeOptions,
  type NormalizedResponse as NormalizedGraphQLResponse,
} from './normalization/index.js';

// Export the default server for programmatic usage
export { default } from './server.js';
