import { loadAppConfig, loadPlugins } from './loader.js';
import { createConfig } from './config.js';
import server from './server.js';

export interface StartServerOptions {
  port?: number;
  configPath?: string;
}

export async function startServer(options: StartServerOptions = {}) {
  const userConfig = await loadAppConfig(options.configPath || process.cwd());

  const port = options.port || userConfig.port || 4000;
  const host = userConfig.host || 'localhost';
  const endpoint = userConfig.endpoint || `http://${host}:${port}/graphql`;

  if (isNaN(port) || port < 1 || port > 65535) {
    throw new Error(
      `Invalid port number "${port}". Port must be between 1 and 65535.`
    );
  }

  const config = createConfig({
    port,
    host,
    endpoint,
  });

  if (userConfig.plugins && userConfig.plugins.length > 0) {
    console.log('Loading plugins...');
    await loadPlugins(userConfig.plugins, userConfig);
  }

  server.listen(port);
  console.log(`Universal Data Layer server listening on port ${port}`);
  console.log(`GraphQL server available at ${config.endpoint}`);
  console.log(
    `GraphiQL interface available at http://${host}:${port}/graphiql`
  );

  return { server, config };
}
