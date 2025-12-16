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
import { rebuildHandler } from '@/handlers/graphql.js';
import { runCodegen } from '@/codegen.js';
import { fileURLToPath } from 'node:url';
import { basename, dirname, resolve } from 'node:path';
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

    const featureConfigs = await loadManualTestConfigs(packageRoot);
    codegenConfigs.push(...featureConfigs);
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
