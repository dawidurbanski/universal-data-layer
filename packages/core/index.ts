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
