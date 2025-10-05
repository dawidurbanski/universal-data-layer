import { loadAppConfig, loadPlugins } from '@/loader.js';
import { createConfig } from '@/config.js';
import server from '@/server.js';
import { rebuildHandler } from '@/handlers/graphql.js';
import { watch } from 'chokidar';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

export interface StartServerOptions {
  port?: number;
  configPath?: string;
  watch?: boolean;
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

  // Setup file watcher for hot reloading in dev mode
  if (options.watch !== false && process.env['NODE_ENV'] !== 'production') {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);

    // Watch the compiled dist directory since that's what gets loaded
    // TypeScript watch mode compiles changes, then we reload the schema
    const distDir = __dirname;

    console.log('👀 Watching for file changes in dist...');

    const watcher = watch(distDir, {
      ignored: /(^|[\\/])\../, // ignore dotfiles
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: 50,
        pollInterval: 10,
      },
    });

    let debounceTimer: NodeJS.Timeout | null = null;

    watcher.on('change', (path) => {
      // Normalize path to always use forward slashes
      const normalizedPath = path.replace(/\\/g, '/');
      // Ignore .map files from logging
      if (normalizedPath.endsWith('.map')) {
        return;
      }
      // Find the index of '/packages/' in the path
      const idx = normalizedPath.indexOf('/packages/');
      const displayPath =
        idx !== -1 ? normalizedPath.slice(idx) : normalizedPath;
      console.log(`📝 File changed: ${displayPath}`);

      // Debounce rapid changes
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }

      debounceTimer = setTimeout(async () => {
        try {
          await rebuildHandler();
        } catch (error) {
          console.error('❌ Failed to rebuild schema:', error);
        }
      }, 150);
    });

    // Clean up watcher on server close
    server.on('close', () => {
      watcher.close();
    });
  }

  server.listen(port);
  console.log(`🚀 Universal Data Layer server listening on port ${port}`);
  console.log(`📟 GraphQL server available at ${config.endpoint}`);
  console.log(
    `✨ GraphiQL interface available at http://${host}:${port}/graphiql`
  );

  return { server, config };
}
