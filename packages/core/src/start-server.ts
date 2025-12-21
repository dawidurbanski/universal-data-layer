import { loadAppConfig, loadPlugins } from '@/loader.js';
import { createConfig } from '@/config.js';
import server from '@/server.js';
import { rebuildHandler, getCurrentSchema } from '@/handlers/graphql.js';
import { setReady } from '@/handlers/readiness.js';
import { runCodegen } from '@/codegen.js';
import { loadEnv } from '@/env.js';
import { startMockServer } from '@/mocks/index.js';
import { watch } from 'chokidar';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { defaultStore } from '@/nodes/defaultStore.js';
import { loadManualTestConfigs, type FeatureCodegenInfo } from '@/features.js';

export interface StartServerOptions {
  port?: number;
  configPath?: string;
  watch?: boolean;
}

export async function startServer(options: StartServerOptions = {}) {
  // Load environment variables from .env files FIRST
  // This must happen before startMockServer so credentials can be detected
  const configDir = options.configPath || process.cwd();
  loadEnv({ cwd: configDir });

  // Start mock server (it will decide whether to use mocks based on:
  // 1. Credentials provided → no mocks
  // 2. UDL_USE_MOCKS env var
  // 3. NODE_ENV=development → mocks)
  await startMockServer();

  const userConfig = await loadAppConfig(configDir);

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

  // Collect codegen configs to run after schema is built
  const codegenConfigs: FeatureCodegenInfo[] = [];

  // Track main app plugin owner names (basenames) for codegen filtering
  const mainAppPluginNames: string[] = [];

  // Determine if caching is enabled (per-plugin caching is handled in loadPlugins)
  const cacheEnabled = userConfig.cache !== false;

  // Load main app config plugins
  if (userConfig.plugins && userConfig.plugins.length > 0) {
    console.log('Loading plugins...');
    // Track plugin names before loading
    // Note: The actual owner name is determined by the plugin's config.name or basename
    // For npm packages like '@universal-data-layer/plugin-source-contentful', the plugin's config.name is used
    for (const plugin of userConfig.plugins) {
      if (typeof plugin === 'string') {
        // For package names, use the full name (not basename)
        // The plugin will use its config.name if available, or basename of resolved path
        mainAppPluginNames.push(plugin);
      } else {
        mainAppPluginNames.push(plugin.name);
      }
    }
    const pluginResult = await loadPlugins(userConfig.plugins, {
      appConfig: userConfig,
      store: defaultStore,
      cache: cacheEnabled,
      cacheDir: configDir,
    });

    // Add plugin codegen configs (from plugins themselves)
    for (const pluginCodegen of pluginResult.codegenConfigs) {
      codegenConfigs.push({
        config: pluginCodegen.config,
        basePath: pluginCodegen.pluginPath,
        pluginNames: [pluginCodegen.pluginName],
      });
    }
  }

  // Mark node store as ready after plugins have loaded
  setReady('nodeStore', true);

  // Track main app codegen config if present (after collecting plugin names)
  if (userConfig.codegen) {
    codegenConfigs.push({
      config: userConfig.codegen,
      basePath: options.configPath || process.cwd(),
      pluginNames: mainAppPluginNames,
    });
  }

  // In dev mode, also load configs from manual test features
  // Only when explicitly in development mode (internal development only)
  if (process.env['NODE_ENV'] === 'development') {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    // Go up from dist/src to package root
    const packageRoot = resolve(__dirname, '..', '..');
    const featureConfigs = await loadManualTestConfigs(packageRoot, {
      loadEnv,
      cache: cacheEnabled,
    });
    codegenConfigs.push(...featureConfigs);
  }

  // Rebuild the GraphQL schema after all plugins have sourced their nodes
  console.log('🔨 Building GraphQL schema from sourced nodes...');
  await rebuildHandler();

  // Mark GraphQL as ready after schema is built
  setReady('graphql', true);

  // Get the current schema for query generation
  const schema = await getCurrentSchema();

  // Run codegen for all configs that have it enabled
  for (const {
    config: codegenConfig,
    basePath,
    pluginNames,
  } of codegenConfigs) {
    try {
      await runCodegen({
        config: codegenConfig,
        store: defaultStore,
        basePath,
        owners: pluginNames,
        schema,
      });
    } catch (error) {
      console.error(`❌ Codegen failed for ${basePath}:`, error);
    }
  }

  // Setup file watcher for hot reloading in dev mode
  // Only when explicitly in development mode
  if (options.watch !== false && process.env['NODE_ENV'] === 'development') {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);

    // Watch compiled source and manual tests
    // - dist/src: compiled core code (tsc --watch compiles these)
    // - tests/manual: source manual tests (loaded via tsx at runtime)
    const distSrc = __dirname;
    const manualTestsSrc = resolve(__dirname, '..', '..', 'tests', 'manual');

    // Collect paths to watch for .graphql files
    // Include all basePaths from codegen configs that have extensions
    const graphqlWatchPaths: string[] = [];
    for (const codegenInfo of codegenConfigs) {
      if (codegenInfo.config.extensions?.length) {
        graphqlWatchPaths.push(codegenInfo.basePath);
      }
    }

    console.log('👀 Watching for file changes...');
    if (graphqlWatchPaths.length > 0) {
      console.log(
        '👀 Watching for .graphql file changes in:',
        graphqlWatchPaths
      );
    }

    const watcher = watch([distSrc, manualTestsSrc, ...graphqlWatchPaths], {
      ignored: (path: string) => {
        // Ignore dotfiles
        if (/(^|[\\/])\./.test(path)) return true;
        // Ignore generated folders (codegen output)
        if (path.includes('/generated/') || path.includes('\\generated\\')) {
          return true;
        }
        // Ignore if path ends with /generated or \generated (the folder itself)
        if (path.endsWith('/generated') || path.endsWith('\\generated')) {
          return true;
        }
        return false;
      },
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: 50,
        pollInterval: 10,
      },
    });

    let debounceTimer: NodeJS.Timeout | null = null;
    let pendingChangedPaths: Set<string> = new Set();

    /**
     * Find codegen configs affected by a changed file path.
     * Returns only the configs whose basePath matches the changed file's feature directory.
     * If no specific feature is detected, returns all configs (core code change).
     */
    function getAffectedCodegenConfigs(
      changedPaths: Set<string>
    ): FeatureCodegenInfo[] {
      const affectedConfigs: FeatureCodegenInfo[] = [];
      const matchedBasePaths = new Set<string>();

      for (const changedPath of changedPaths) {
        // Check if this is a manual test feature file
        // Path pattern: .../tests/manual/features/{feature-name}/...
        const featureMatch = changedPath.match(
          /tests\/manual\/features\/([^/]+)/
        );

        if (featureMatch) {
          const featureName = featureMatch[1];
          // Find matching codegen config by feature name in basePath
          for (const codegenInfo of codegenConfigs) {
            if (
              codegenInfo.basePath.includes(`/features/${featureName}`) &&
              !matchedBasePaths.has(codegenInfo.basePath)
            ) {
              affectedConfigs.push(codegenInfo);
              matchedBasePaths.add(codegenInfo.basePath);
            }
          }
        } else {
          // Core code change - affects all configs
          return codegenConfigs;
        }
      }

      return affectedConfigs.length > 0 ? affectedConfigs : codegenConfigs;
    }

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

      // Track changed paths for determining which codegen configs to run
      pendingChangedPaths.add(normalizedPath);

      // Debounce rapid changes
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }

      debounceTimer = setTimeout(async () => {
        const changedPaths = pendingChangedPaths;
        pendingChangedPaths = new Set();

        try {
          // Check if only .graphql files changed (no schema rebuild needed)
          const onlyGraphqlChanges = [...changedPaths].every(
            (p) => p.endsWith('.graphql') || p.endsWith('.gql')
          );

          // Only rebuild schema if non-graphql files changed
          if (!onlyGraphqlChanges) {
            await rebuildHandler();
          }

          // Get the current schema for query generation
          const currentSchema = await getCurrentSchema();

          // Find affected codegen configs
          // For .graphql changes, find configs whose basePath contains the changed file
          const affectedConfigs = onlyGraphqlChanges
            ? codegenConfigs.filter((codegenInfo) => {
                return [...changedPaths].some((changedPath) =>
                  changedPath.startsWith(codegenInfo.basePath)
                );
              })
            : getAffectedCodegenConfigs(changedPaths);

          for (const {
            config: codegenConfig,
            basePath,
            pluginNames,
          } of affectedConfigs) {
            try {
              await runCodegen({
                config: codegenConfig,
                store: defaultStore,
                basePath,
                owners: pluginNames,
                schema: currentSchema,
              });
            } catch (error) {
              console.error(`❌ Codegen failed for ${basePath}:`, error);
            }
          }
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
