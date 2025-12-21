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

import { loadAppConfig, loadPlugins } from '@/loader.js';
import { rebuildHandler, getCurrentSchema } from '@/handlers/graphql.js';
import { runCodegen } from '@/codegen.js';
import { loadEnv } from '@/env.js';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { defaultStore } from '@/nodes/defaultStore.js';
import { startMockServer, stopMockServer } from '@/mocks/index.js';
import { loadManualTestConfigs, type FeatureCodegenInfo } from '@/features.js';

export interface RunCodegenOnlyOptions {
  configPath?: string;
  /** Include manual test features (default: true in non-production) */
  includeManualTests?: boolean;
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

  // Load environment variables from .env files FIRST
  // This must happen before startMockServer so credentials can be detected
  loadEnv({ cwd: configPath });

  // Start mock server (it will decide whether to use mocks based on:
  // 1. Credentials provided → no mocks
  // 2. UDL_USE_MOCKS env var
  // 3. NODE_ENV=development → mocks)
  await startMockServer();

  const userConfig = await loadAppConfig(configPath);

  // Collect codegen configs
  const codegenConfigs: FeatureCodegenInfo[] = [];
  const mainAppPluginNames: string[] = [];

  // Determine if caching is enabled
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
      cacheDir: configPath,
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

  // Load configs from manual test features (only when running from within UDL development)
  // Skip when running from a consumer's app (configPath outside the package)
  if (includeManualTests) {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const packageRoot = resolve(__dirname, '..', '..');

    // Only load manual tests if cwd is within the UDL monorepo
    const isWithinMonorepo =
      configPath.startsWith(packageRoot) ||
      configPath.startsWith(resolve(packageRoot, '..', '..'));

    if (isWithinMonorepo) {
      const featureConfigs = await loadManualTestConfigs(packageRoot);
      codegenConfigs.push(...featureConfigs);
    }
  }

  // Build the GraphQL schema
  console.log('🔨 Building GraphQL schema from sourced nodes...');
  await rebuildHandler();

  // Get the current schema for query generation
  const schema = await getCurrentSchema();

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
        schema,
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
