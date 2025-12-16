/**
 * Codegen-only mode
 *
 * Runs the full UDL initialization (load configs, plugins, source nodes, build schema)
 * and generates types without starting the HTTP server.
 *
 * This is useful for:
 * - CI pipelines that need generated types before typecheck/tests
 * - Pre-build steps
 * - Manual codegen without running the dev server
 */

import {
  loadAppConfig,
  loadPlugins,
  loadConfigFile,
  type CodegenConfig,
} from '@/loader.js';
import { rebuildHandler } from '@/handlers/graphql.js';
import { runCodegen } from '@/codegen.js';
import { fileURLToPath } from 'node:url';
import { basename, dirname, join, resolve } from 'node:path';
import { existsSync, readdirSync } from 'node:fs';
import { defaultStore } from '@/nodes/defaultStore.js';
import { startMockServer, stopMockServer } from '@/mocks/index.js';

/**
 * Track codegen configs from loaded features for automatic generation
 */
interface FeatureCodegenInfo {
  config: CodegenConfig;
  basePath: string;
  /** Plugin names (resolved paths) that this feature loaded */
  pluginNames: string[];
}

export interface RunCodegenOnlyOptions {
  configPath?: string;
  /** Include manual test features (default: true in non-production) */
  includeManualTests?: boolean;
}

/**
 * Discover and load configs from all manual test features
 */
async function loadManualTestConfigs(
  rootDir: string
): Promise<FeatureCodegenInfo[]> {
  const featuresDir = join(rootDir, 'tests', 'manual', 'features');
  const codegenConfigs: FeatureCodegenInfo[] = [];

  if (!existsSync(featuresDir)) {
    return codegenConfigs;
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

        // Load feature-specific .env file if it exists
        const featureEnvPath = join(featurePath, '.env');
        if (existsSync(featureEnvPath)) {
          const { config: loadEnv } = await import('dotenv');
          loadEnv({ path: featureEnvPath });
        }

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
          config = await loadConfigFile(resolve(configPath), {
            context: { config: {} },
            store: defaultStore,
          });
        }

        const pluginOwnerNames: string[] = [];

        if (config?.plugins && config.plugins.length > 0) {
          const resolvedPlugins = config.plugins.map((plugin) => {
            if (typeof plugin === 'string') {
              if (plugin.startsWith('./') || plugin.startsWith('../')) {
                const resolvedPath = resolve(featurePath, plugin);
                pluginOwnerNames.push(basename(resolvedPath));
                return resolvedPath;
              }
              pluginOwnerNames.push(basename(plugin));
              return plugin;
            } else {
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

          const pluginResult = await loadPlugins(resolvedPlugins, {
            appConfig: config,
            store: defaultStore,
          });

          for (const pluginCodegen of pluginResult.codegenConfigs) {
            codegenConfigs.push({
              config: pluginCodegen.config,
              basePath: pluginCodegen.pluginPath,
              pluginNames: [pluginCodegen.pluginName],
            });
          }
        }

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

  return codegenConfigs;
}

/**
 * Run codegen without starting the server
 *
 * This performs the full UDL initialization:
 * 1. Load app config
 * 2. Load plugins (which source nodes)
 * 3. Build GraphQL schema
 * 4. Run codegen for all configs
 */
export async function runCodegenOnly(
  options: RunCodegenOnlyOptions = {}
): Promise<void> {
  const {
    configPath = process.cwd(),
    includeManualTests = process.env['NODE_ENV'] !== 'production',
  } = options;

  console.log('🔄 Running codegen...');

  // Start mock server to intercept API calls (same as dev server)
  if (process.env['NODE_ENV'] !== 'production') {
    await startMockServer();
  }

  const userConfig = await loadAppConfig(configPath);

  // Collect codegen configs
  const codegenConfigs: FeatureCodegenInfo[] = [];
  const mainAppPluginNames: string[] = [];

  // Load main app config plugins
  if (userConfig.plugins && userConfig.plugins.length > 0) {
    console.log('Loading plugins...');
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
    });

    for (const pluginCodegen of pluginResult.codegenConfigs) {
      codegenConfigs.push({
        config: pluginCodegen.config,
        basePath: pluginCodegen.pluginPath,
        pluginNames: [pluginCodegen.pluginName],
      });
    }
  }

  // Track main app codegen config
  if (userConfig.codegen) {
    codegenConfigs.push({
      config: userConfig.codegen,
      basePath: configPath,
      pluginNames: mainAppPluginNames,
    });
  }

  // Load configs from manual test features
  if (includeManualTests) {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const packageRoot = resolve(__dirname, '..', '..');

    // Load features from core package
    const featureConfigs = await loadManualTestConfigs(packageRoot);
    codegenConfigs.push(...featureConfigs);

    // Also scan sibling packages for test features
    const packagesDir = resolve(packageRoot, '..');
    if (existsSync(packagesDir)) {
      const packageDirs = readdirSync(packagesDir, { withFileTypes: true });
      for (const pkgDir of packageDirs) {
        if (!pkgDir.isDirectory()) continue;
        // Skip core (already scanned) and non-plugin directories
        if (pkgDir.name === 'core' || pkgDir.name === 'universal-data-layer')
          continue;

        const pkgPath = join(packagesDir, pkgDir.name);
        const siblingFeatureConfigs = await loadManualTestConfigs(pkgPath);
        codegenConfigs.push(...siblingFeatureConfigs);
      }
    }
  }

  // Build the GraphQL schema
  console.log('🔨 Building GraphQL schema from sourced nodes...');
  await rebuildHandler();

  // Run codegen for all configs
  let successCount = 0;
  let errorCount = 0;

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
      successCount++;
    } catch (error) {
      console.error(`❌ Codegen failed for ${basePath}:`, error);
      errorCount++;
    }
  }

  // Stop mock server
  stopMockServer();

  if (errorCount > 0) {
    console.log(
      `\n⚠️  Codegen completed with ${errorCount} error(s), ${successCount} success(es)`
    );
    process.exit(1);
  } else if (successCount > 0) {
    console.log(
      `\n✅ Codegen completed successfully (${successCount} configs)`
    );
  } else {
    console.log('\nℹ️  No codegen configs found');
  }
}
