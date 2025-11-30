import {
  loadAppConfig,
  loadPlugins,
  loadConfigFile,
  type CodegenConfig,
} from '@/loader.js';
import { createConfig } from '@/config.js';
import server from '@/server.js';
import { rebuildHandler } from '@/handlers/graphql.js';
import { runCodegen } from '@/codegen.js';
import { loadEnv } from '@/env.js';
import { startMockServer } from '@/mocks/index.js';
import { watch } from 'chokidar';
import { fileURLToPath } from 'node:url';
import { basename, dirname, join, resolve } from 'node:path';
import { existsSync, readdirSync } from 'node:fs';
import { defaultStore } from '@/nodes/defaultStore.js';

/**
 * Track codegen configs from loaded features for automatic generation
 */
interface FeatureCodegenInfo {
  config: CodegenConfig;
  basePath: string;
  /** Plugin names (resolved paths) that this feature loaded */
  pluginNames: string[];
}

export interface StartServerOptions {
  port?: number;
  configPath?: string;
  watch?: boolean;
}

/**
 * Discover and load configs from all manual test features
 * In dev mode, each feature directory is treated as its own app
 * Scans both the core package and sibling plugin packages
 * @returns Array of codegen configs to run after schema is built
 */
async function loadManualTestConfigs(
  rootDir: string
): Promise<FeatureCodegenInfo[]> {
  const codegenConfigs: FeatureCodegenInfo[] = [];

  // Collect all feature directories to scan
  const featuresDirs: string[] = [];

  // Add core package features directory
  const coreFeatures = join(rootDir, 'tests', 'manual', 'features');
  if (existsSync(coreFeatures)) {
    featuresDirs.push(coreFeatures);
  }

  // Scan sibling plugin packages for their manual test features
  const packagesDir = dirname(rootDir); // Go up to packages/
  if (existsSync(packagesDir)) {
    try {
      const packageDirs = readdirSync(packagesDir, { withFileTypes: true });
      for (const pkg of packageDirs) {
        if (!pkg.isDirectory()) continue;
        if (pkg.name === basename(rootDir)) continue; // Skip the core package itself

        const pluginFeaturesDir = join(
          packagesDir,
          pkg.name,
          'tests',
          'manual',
          'features'
        );
        if (existsSync(pluginFeaturesDir)) {
          featuresDirs.push(pluginFeaturesDir);
        }
      }
    } catch {
      // Ignore errors scanning packages directory
    }
  }

  if (featuresDirs.length === 0) {
    return codegenConfigs;
  }

  for (const featuresDir of featuresDirs) {
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
          // Load .env files from the feature directory
          loadEnv({ cwd: featurePath });

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

          // Track plugin names (basenames) for filtering codegen
          // Owner is set to basename in loader.ts, so we need to match that
          const pluginOwnerNames: string[] = [];

          // Load plugins defined in this feature's config
          if (config?.plugins && config.plugins.length > 0) {
            // Resolve plugin paths relative to the feature directory
            const resolvedPlugins = config.plugins.map((plugin) => {
              if (typeof plugin === 'string') {
                // If it's a relative path, resolve it relative to the feature dir
                if (plugin.startsWith('./') || plugin.startsWith('../')) {
                  const resolvedPath = resolve(featurePath, plugin);
                  // Owner is basename of the path (e.g., 'todo-source' from './plugins/todo-source')
                  pluginOwnerNames.push(basename(resolvedPath));
                  return resolvedPath;
                }
                pluginOwnerNames.push(basename(plugin));
                return plugin;
              } else {
                // Plugin object with name and options
                if (
                  plugin.name.startsWith('./') ||
                  plugin.name.startsWith('../')
                ) {
                  const resolvedPath = resolve(featurePath, plugin.name);
                  pluginOwnerNames.push(basename(resolvedPath));
                  return {
                    ...plugin,
                    name: resolvedPath,
                  };
                }
                pluginOwnerNames.push(basename(plugin.name));
                return plugin;
              }
            });

            // Respect the feature's cache setting (default to enabled)
            const featureCacheEnabled = config.cache !== false;

            const pluginResult = await loadPlugins(resolvedPlugins, {
              appConfig: config,
              store: defaultStore,
              cache: featureCacheEnabled,
              cacheDir: featurePath,
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

          // Track codegen config if present (after plugins so we have their names)
          // This is for feature-level codegen, which is separate from plugin-level codegen
          if (config?.codegen) {
            codegenConfigs.push({
              config: config.codegen,
              basePath: featurePath,
              pluginNames: pluginOwnerNames,
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

  return codegenConfigs;
}

export async function startServer(options: StartServerOptions = {}) {
  // Start mock server FIRST (before any plugins make API calls)
  // Only in dev mode - mocks are for internal development only
  if (process.env['NODE_ENV'] !== 'production') {
    await startMockServer();
  }

  // Load environment variables from .env files before loading config
  const configDir = options.configPath || process.cwd();
  loadEnv({ cwd: configDir });

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
    // Track plugin names before loading (use basename to match owner in nodes)
    for (const plugin of userConfig.plugins) {
      if (typeof plugin === 'string') {
        mainAppPluginNames.push(basename(plugin));
      } else {
        mainAppPluginNames.push(basename(plugin.name));
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

  // Track main app codegen config if present (after collecting plugin names)
  if (userConfig.codegen) {
    codegenConfigs.push({
      config: userConfig.codegen,
      basePath: options.configPath || process.cwd(),
      pluginNames: mainAppPluginNames,
    });
  }

  // In dev mode, also load configs from manual test features
  if (process.env['NODE_ENV'] !== 'production') {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    // Go up from dist/src to package root
    const packageRoot = resolve(__dirname, '..', '..');
    const featureConfigs = await loadManualTestConfigs(packageRoot);
    codegenConfigs.push(...featureConfigs);
  }

  // Rebuild the GraphQL schema after all plugins have sourced their nodes
  console.log('🔨 Building GraphQL schema from sourced nodes...');
  await rebuildHandler();

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
      });
    } catch (error) {
      console.error(`❌ Codegen failed for ${basePath}:`, error);
    }
  }

  // Setup file watcher for hot reloading in dev mode
  if (options.watch !== false && process.env['NODE_ENV'] !== 'production') {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);

    // Watch compiled source and manual tests
    // - dist/src: compiled core code (tsc --watch compiles these)
    // - tests/manual: source manual tests (loaded via tsx at runtime)
    const distSrc = __dirname;
    const manualTestsSrc = resolve(__dirname, '..', '..', 'tests', 'manual');

    console.log('👀 Watching for file changes...');

    const watcher = watch([distSrc, manualTestsSrc], {
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
          await rebuildHandler();

          // Only re-run codegen for affected configs
          const affectedConfigs = getAffectedCodegenConfigs(changedPaths);
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
