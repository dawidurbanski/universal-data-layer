import { loadAppConfig, loadPlugins, loadConfigFile } from '@/loader.js';
import { createConfig } from '@/config.js';
import server from '@/server.js';
import { rebuildHandler } from '@/handlers/graphql.js';
import { watch } from 'chokidar';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { existsSync, readdirSync } from 'node:fs';
import { defaultStore } from '@/nodes/defaultStore.js';

export interface StartServerOptions {
  port?: number;
  configPath?: string;
  watch?: boolean;
}

/**
 * Discover and load configs from all manual test features
 * In dev mode, each feature directory is treated as its own app
 */
async function loadManualTestConfigs(rootDir: string): Promise<void> {
  const featuresDir = join(rootDir, 'tests', 'manual', 'features');

  if (!existsSync(featuresDir)) {
    return;
  }

  try {
    const featureDirs = readdirSync(featuresDir, { withFileTypes: true });

    for (const featureDir of featureDirs) {
      if (!featureDir.isDirectory()) continue;

      const featurePath = join(featuresDir, featureDir.name);
      const tsConfigPath = join(featurePath, 'udl.config.ts');
      const jsConfigPath = join(featurePath, 'udl.config.js');

      let configPath: string | null = null;
      if (existsSync(tsConfigPath)) {
        configPath = tsConfigPath;
      } else if (existsSync(jsConfigPath)) {
        configPath = jsConfigPath;
      }

      if (!configPath) continue;

      try {
        console.log(`📦 Loading config from feature: ${featureDir.name}`);

        let config = null;

        // Load TypeScript configs with tsx
        if (configPath.endsWith('.ts')) {
          const { register } = await import('tsx/esm/api');
          const unregister = register();

          try {
            config = await loadConfigFile(resolve(configPath), {
              context: { config: {} },
              store: defaultStore,
            });
          } finally {
            unregister();
          }
        } else {
          // Load JavaScript configs directly
          config = await loadConfigFile(resolve(configPath), {
            context: { config: {} },
            store: defaultStore,
          });
        }

        // Load plugins defined in this feature's config
        if (config?.plugins && config.plugins.length > 0) {
          // Resolve plugin paths relative to the feature directory
          const resolvedPlugins = config.plugins.map((plugin) => {
            if (typeof plugin === 'string') {
              // If it's a relative path, resolve it relative to the feature dir
              if (plugin.startsWith('./') || plugin.startsWith('../')) {
                return resolve(featurePath, plugin);
              }
              return plugin;
            } else {
              // Plugin object with name and options
              if (
                plugin.name.startsWith('./') ||
                plugin.name.startsWith('../')
              ) {
                return {
                  ...plugin,
                  name: resolve(featurePath, plugin.name),
                };
              }
              return plugin;
            }
          });

          await loadPlugins(resolvedPlugins, {
            appConfig: config,
            store: defaultStore,
          });
        }
      } catch (error) {
        console.warn(
          `Failed to load config for feature ${featureDir.name}:`,
          error
        );
      }
    }
  } catch (error) {
    console.warn('Failed to scan manual test features:', error);
  }
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

  // Load main app config plugins
  if (userConfig.plugins && userConfig.plugins.length > 0) {
    console.log('Loading plugins...');
    await loadPlugins(userConfig.plugins, { appConfig: userConfig });
  }

  // In dev mode, also load configs from manual test features
  if (process.env['NODE_ENV'] !== 'production') {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    // Go up from dist/src to package root
    const packageRoot = resolve(__dirname, '..', '..');
    await loadManualTestConfigs(packageRoot);
  }

  // Rebuild the GraphQL schema after all plugins have sourced their nodes
  console.log('🔨 Building GraphQL schema from sourced nodes...');
  await rebuildHandler();

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
