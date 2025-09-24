export interface Config {
  staticPath: string;
  endpoint: string;
  port?: number;
  host?: string;
}

let currentConfig: Config = {
  staticPath: '/static/',
  endpoint: 'http://localhost:4000/graphql',
  port: 4000,
  host: 'localhost',
};

export function createConfig(options?: Partial<Config>): Config {
  const port = options?.port || currentConfig.port || 4000;
  const host = options?.host || currentConfig.host || 'localhost';

  const config: Config = {
    staticPath: options?.staticPath || currentConfig.staticPath,
    endpoint: options?.endpoint || `http://${host}:${port}/graphql`,
    port,
    host,
  };

  currentConfig = config;
  return config;
}

export function getConfig(): Config {
  return currentConfig;
}

export default currentConfig;
