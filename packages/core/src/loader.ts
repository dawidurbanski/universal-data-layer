import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export interface OnLoadContext {
  options?: Record<string, unknown>;
  config?: UDLConfig;
}

export interface UDLConfig {
  port?: number;
  host?: string;
  endpoint?: string;
  plugins?: (string | { name: string; options?: Record<string, unknown> })[];
}

export interface UDLConfigFile {
  config: UDLConfig;
  onLoad?: (context?: OnLoadContext) => void | Promise<void>;
}

/**
 * Core function: Loads a single UDL config file from the given path
 * Expects: export const config = { ... } and optionally export function onLoad({ options, plugins }) {}
 * @param configPath - Absolute path to the config file
 * @param context - Context to pass to onLoad hook (options and plugins info)
 * @returns The loaded config or null if file doesn't exist or fails to load
 */
export async function loadConfigFile(
  configPath: string,
  context?: OnLoadContext
): Promise<UDLConfig | null> {
  if (!existsSync(configPath)) {
    return null;
  }

  try {
    const fileUrl = pathToFileURL(configPath).href;
    const module: UDLConfigFile = await import(fileUrl);

    // Execute onLoad hook (named export) with context
    if (module.onLoad) {
      await module.onLoad(context);
    }

    return module.config;
  } catch (error) {
    console.error(`Failed to load UDL config from ${configPath}:`, error);
    return null;
  }
}

/**
 * High-level: Loads the application's UDL config from standard locations
 * Searches for udl.config.{js,mjs,cjs} and executes onLoad hook
 * @param cwd - Working directory to search for config (default: process.cwd())
 * @returns The loaded config or empty object if no config found
 */
export async function loadAppConfig(
  cwd: string = process.cwd()
): Promise<UDLConfig> {
  const configPaths = [
    join(cwd, 'udl.config.js'),
    join(cwd, 'udl.config.mjs'),
    join(cwd, 'udl.config.cjs'),
  ];

  for (const configPath of configPaths) {
    const absolutePath = resolve(configPath);
    // Pass empty context for app's onLoad
    const config = await loadConfigFile(absolutePath, { config: {} });

    if (config) {
      return config;
    }
  }

  return {};
}

/**
 * High-level: Loads and initializes plugins by executing their onLoad hooks
 * @param plugins - Array of plugin specifiers (package names, file paths, or plugin objects with name and options)
 */
export async function loadPlugins(
  plugins: (
    | string
    | { name: string; options?: Record<string, unknown> }
  )[] = [],
  appConfig?: UDLConfig
): Promise<void> {
  for (const pluginSpec of plugins) {
    try {
      // Handle both string and object plugin specs
      const pluginName =
        typeof pluginSpec === 'string' ? pluginSpec : pluginSpec.name;
      const pluginOptions =
        typeof pluginSpec === 'object' ? pluginSpec.options : undefined;

      let pluginPath: string;

      // Handle relative/absolute paths vs package names
      if (pluginName.startsWith('.') || pluginName.startsWith('/')) {
        pluginPath = resolve(pluginName);
      } else {
        try {
          const { fileURLToPath } = await import('node:url');
          const packageJsonUrl = import.meta.resolve(
            `${pluginName}/package.json`
          );
          const packageJsonPath = fileURLToPath(packageJsonUrl);
          const { dirname } = await import('node:path');
          pluginPath = dirname(packageJsonPath);
        } catch (err) {
          console.log(
            `Could not resolve ${pluginName} via import.meta.resolve, falling back to node_modules:`,
            err
          );
          pluginPath = resolve(process.cwd(), 'node_modules', pluginName);
        }
      }

      const udlConfigPath = join(pluginPath, 'udl.config.js');
      console.log(`Loading plugin from: ${udlConfigPath}`);

      // Build context for this plugin's onLoad
      const context: OnLoadContext = {};

      // Add plugin options if they exist
      if (pluginOptions !== undefined) {
        context.options = pluginOptions;
      }

      // Add app config if provided
      if (appConfig !== undefined) {
        context.config = appConfig;
      }

      // Execute onLoad for plugins with context
      const plugin = await loadConfigFile(udlConfigPath, context);

      if (!plugin) {
        console.warn(
          `Plugin ${pluginName} missing or failed to load udl.config.js file at ${udlConfigPath}`
        );
      }
    } catch (error) {
      console.error(
        `Failed to load plugin ${typeof pluginSpec === 'string' ? pluginSpec : pluginSpec.name}:`,
        error
      );
    }
  }
}
