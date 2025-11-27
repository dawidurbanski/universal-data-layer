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

// Re-export config functions
export { createConfig, getConfig, type Config } from './config.js';

// Re-export GraphQL fetch utility
export {
  graphqlFetch,
  type GraphQLError,
  type GraphQLResponse,
} from './graphql-fetch.js';

// Export the default server for programmatic usage
export { default } from './server.js';
