import { loadConfig } from './src/config-loader.js';
import { createConfig } from './src/config.js';
import server from './src/server.js';

export default server;

// Only start server if this module is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const userConfig = await loadConfig(process.cwd());

  const port = userConfig.port || 4000;
  const host = userConfig.host || 'localhost';
  const endpoint = userConfig.endpoint || `http://${host}:${port}/graphql`;

  if (isNaN(port) || port < 1 || port > 65535) {
    console.error(
      `Error: Invalid port number "${port}". Port must be between 1 and 65535.`
    );
    process.exit(1);
  }

  const config = createConfig({
    port,
    host,
    endpoint,
  });

  server.listen(port);
  console.log(`Universal Data Layer server listening on port ${port}`);
  console.log(`GraphQL server available at ${config.endpoint}`);
  console.log(
    `GraphiQL interface available at http://${host}:${port}/graphiql`
  );
}
