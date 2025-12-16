/**
 * Manual Test Features Loading
 *
 * Shared utilities for loading manual test features in both
 * the dev server and codegen-only modes.
 */

import { loadPlugins, loadConfigFile, type CodegenConfig } from '@/loader.js';
import { basename, dirname, join, resolve } from 'node:path';
import { existsSync, readdirSync } from 'node:fs';
import { defaultStore } from '@/nodes/defaultStore.js';

/**
 * Track codegen configs from loaded features for automatic generation
 */
export interface FeatureCodegenInfo {
  config: CodegenConfig;
  basePath: string;
  /** Plugin names (resolved paths) that this feature loaded */
  pluginNames: string[];
}

/**
 * Options for loading manual test features
 */
export interface LoadFeaturesOptions {
  /** Optional function to load .env files from a directory */
  loadEnv?: (options: { cwd: string }) => void;
  /** Cache directory for plugins (defaults to feature path) */
  cacheDir?: string;
  /** Whether to enable caching (default: true) */
  cache?: boolean;
}

/**
 * Set mock credentials for plugins that require external API access.
 * MSW will intercept actual API calls, so these just need to pass validation.
 */
export function setMockCredentials(): void {
  if (!process.env['CONTENTFUL_SPACE_ID']) {
    process.env['CONTENTFUL_SPACE_ID'] = 'mock-space-id';
  }
  if (!process.env['CONTENTFUL_ACCESS_TOKEN']) {
    process.env['CONTENTFUL_ACCESS_TOKEN'] = 'mock-access-token';
  }
}

/**
 * Get all feature directories to scan, including sibling plugin packages
 */
function getFeatureDirectories(rootDir: string): string[] {
  const featuresDirs: string[] = [];

  // Add core package features directory
  const coreFeatures = join(rootDir, 'tests', 'manual', 'features');
  if (existsSync(coreFeatures)) {
    featuresDirs.push(coreFeatures);
  }

  // Scan sibling plugin packages for their manual test features
  const packagesDir = dirname(rootDir);
  if (existsSync(packagesDir)) {
    try {
      const packageDirs = readdirSync(packagesDir, { withFileTypes: true });
      for (const pkg of packageDirs) {
        if (!pkg.isDirectory()) continue;
        if (pkg.name === basename(rootDir)) continue; // Skip the root package itself

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

  return featuresDirs;
}

/**
 * Load a single feature's config and plugins
 */
async function loadFeature(
  featurePath: string,
  featureName: string,
  options: LoadFeaturesOptions
): Promise<FeatureCodegenInfo[]> {
  const codegenConfigs: FeatureCodegenInfo[] = [];

  const tsConfigPath = join(featurePath, 'udl.config.ts');
  const jsConfigPath = join(featurePath, 'udl.config.js');

  let configPath: string | null = null;
  if (existsSync(tsConfigPath)) {
    configPath = tsConfigPath;
  } else if (existsSync(jsConfigPath)) {
    configPath = jsConfigPath;
  }

  if (!configPath) return codegenConfigs;

  // Load .env files from the feature directory if loader provided
  if (options.loadEnv) {
    options.loadEnv({ cwd: featurePath });
  }

  // Set mock credentials for plugins that require them
  setMockCredentials();

  console.log(`📦 Loading config from feature: ${featureName}`);

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

  // Track plugin names for filtering codegen
  const pluginOwnerNames: string[] = [];

  // Load plugins defined in this feature's config
  if (config?.plugins && config.plugins.length > 0) {
    // Resolve plugin paths relative to the feature directory
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
        if (plugin.name.startsWith('./') || plugin.name.startsWith('../')) {
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
    const featureCacheEnabled =
      config.cache !== false && options.cache !== false;

    const pluginResult = await loadPlugins(resolvedPlugins, {
      appConfig: config,
      store: defaultStore,
      cache: featureCacheEnabled,
      cacheDir: options.cacheDir ?? featurePath,
    });

    // Add plugin codegen configs
    for (const pluginCodegen of pluginResult.codegenConfigs) {
      codegenConfigs.push({
        config: pluginCodegen.config,
        basePath: pluginCodegen.pluginPath,
        pluginNames: [pluginCodegen.pluginName],
      });
    }
  }

  // Track feature-level codegen config if present
  if (config?.codegen) {
    codegenConfigs.push({
      config: config.codegen,
      basePath: featurePath,
      pluginNames: pluginOwnerNames,
    });
  }

  return codegenConfigs;
}

/**
 * Discover and load configs from all manual test features.
 * Scans both the root package and sibling plugin packages.
 *
 * @param rootDir - The root directory of the package (e.g., packages/core)
 * @param options - Loading options
 * @returns Array of codegen configs from all loaded features
 */
export async function loadManualTestConfigs(
  rootDir: string,
  options: LoadFeaturesOptions = {}
): Promise<FeatureCodegenInfo[]> {
  const codegenConfigs: FeatureCodegenInfo[] = [];
  const featuresDirs = getFeatureDirectories(rootDir);

  if (featuresDirs.length === 0) {
    return codegenConfigs;
  }

  for (const featuresDir of featuresDirs) {
    try {
      const featureDirs = readdirSync(featuresDir, { withFileTypes: true });

      for (const featureDir of featureDirs) {
        if (!featureDir.isDirectory()) continue;

        const featurePath = join(featuresDir, featureDir.name);

        try {
          const featureConfigs = await loadFeature(
            featurePath,
            featureDir.name,
            options
          );
          codegenConfigs.push(...featureConfigs);
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
