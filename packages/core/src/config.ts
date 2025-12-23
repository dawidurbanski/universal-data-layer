export interface Config {
  staticPath: string;
  endpoint: string;
  port?: number;
  host?: string;
}

/** Default port for UDL server */
export const DEFAULT_UDL_PORT = 4000;

/** Environment variable name for endpoint override */
export const UDL_ENDPOINT_ENV = 'UDL_ENDPOINT';

let currentConfig: Config = {
  staticPath: '/static/',
  endpoint: `http://localhost:${DEFAULT_UDL_PORT}/graphql`,
  port: DEFAULT_UDL_PORT,
  host: 'localhost',
};

/** Tracks whether config was explicitly set via createConfig */
let configInitialized = false;

export function createConfig(options?: Partial<Config>): Config {
  const port = options?.port || currentConfig.port || DEFAULT_UDL_PORT;
  const host = options?.host || currentConfig.host || 'localhost';

  const config: Config = {
    staticPath: options?.staticPath || currentConfig.staticPath,
    endpoint: options?.endpoint || `http://${host}:${port}/graphql`,
    port,
    host,
  };

  currentConfig = config;
  configInitialized = true;
  return config;
}

/**
 * Get the current config.
 * If config hasn't been explicitly set, checks for UDL_ENDPOINT env var.
 */
export function getConfig(): Config {
  // If config was explicitly set, use it
  if (configInitialized) {
    return currentConfig;
  }

  // Check for environment variable override (Node.js only)
  if (typeof process !== 'undefined' && process.env?.[UDL_ENDPOINT_ENV]) {
    return {
      ...currentConfig,
      endpoint: process.env[UDL_ENDPOINT_ENV],
    };
  }

  return currentConfig;
}

/**
 * Check if config was explicitly initialized via createConfig.
 */
export function isConfigInitialized(): boolean {
  return configInitialized;
}

/**
 * Reset config state (primarily for testing).
 */
export function resetConfig(): void {
  currentConfig = {
    staticPath: '/static/',
    endpoint: `http://localhost:${DEFAULT_UDL_PORT}/graphql`,
    port: DEFAULT_UDL_PORT,
    host: 'localhost',
  };
  configInitialized = false;
}

export default currentConfig;
