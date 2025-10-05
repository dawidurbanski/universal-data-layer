import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { importMetaResolve } from '@/utils/import-meta-resolve.js';

/**
 * Plugin specification - can be a simple string (package name) or an object with options
 */
export type PluginSpec =
  | string
  | {
      name: string;
      options?: Record<string, unknown>;
    };

/**
 * Core UDL configuration object
 */
export interface UDLConfig {
  /** Plugin type */
  type?: 'core' | 'source';
  /** Plugin name */
  name?: string;
  /** Plugin version */
  version?: string;
  /** Server port (default: 4000) */
  port?: number;
  /** Server host (default: 'localhost') */
  host?: string;
  /** GraphQL endpoint path (default: '/graphql') */
  endpoint?: string;
  /** Static files path (default: '/static/') */
  staticPath?: string;
  /** List of plugins to load */
  plugins?: PluginSpec[];
}

/**
 * Context passed to the onLoad hook
 */
export interface OnLoadContext<T = Record<string, unknown>> {
  /** Plugin-specific options passed from the config */
  options?: T;
  /** The application's UDL config */
  config?: UDLConfig;
}

/**
 * UDL Config File structure
 * Used for both app and plugin config files
 */
export interface UDLConfigFile {
  /** The config object exported from udl.config.{ts,js} */
  config: UDLConfig;
  /** Optional lifecycle hook called when config is loaded */
  onLoad?: <T = Record<string, unknown>>(
    context?: OnLoadContext<T>
  ) => void | Promise<void>;
}

/**
 * Helper function for defining plugin configs with typed options
 * Provides better type inference and autocomplete for plugin configurations
 *
 * @example
 * ```ts
 * // In your plugin's udl.config.ts
 * import { defineConfig, OnLoadContext } from 'universal-data-layer';
 *
 * interface MyPluginOptions {
 *   apiKey: string;
 *   environment: 'dev' | 'prod';
 * }
 *
 * export const { config, onLoad } = defineConfig<MyPluginOptions>({
 *   config: {
 *     plugins: []
 *   },
 *   onLoad: async (context) => {
 *     // context.options is now typed as MyPluginOptions
 *     console.log(context?.options?.apiKey);
 *   }
 * });
 * ```
 */
export function defineConfig<T = Record<string, unknown>>(configFile: {
  config: UDLConfig;
  onLoad?: (context?: OnLoadContext<T>) => void | Promise<void>;
}): UDLConfigFile {
  return configFile as UDLConfigFile;
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
 * Searches for udl.config.{ts,js,mjs,cjs} and executes onLoad hook
 * For TypeScript configs, uses tsx to load them at runtime
 * @param cwd - Working directory to search for config (default: process.cwd())
 * @returns The loaded config or empty object if no config found
 */
export async function loadAppConfig(
  cwd: string = process.cwd()
): Promise<UDLConfig> {
  const configFiles = [
    'udl.config.ts',
    'udl.config.js',
    'udl.config.mjs',
    'udl.config.cjs',
  ];

  for (const configFile of configFiles) {
    const configPath = join(cwd, configFile);

    if (existsSync(configPath)) {
      const absolutePath = resolve(configPath);

      // Use tsx for .ts files, regular import for others
      if (configFile.endsWith('.ts')) {
        try {
          // Use tsx to register TypeScript loader
          const { register } = await import('tsx/esm/api');
          const unregister = register();

          try {
            const config = await loadConfigFile(absolutePath, { config: {} });
            if (config) {
              return config;
            }
          } finally {
            unregister();
          }
        } catch (error) {
          console.error(
            `Failed to load TypeScript config from ${absolutePath}:`,
            error
          );
        }
      } else {
        const config = await loadConfigFile(absolutePath, { config: {} });
        if (config) {
          return config;
        }
      }
    }
  }

  return {};
}

/**
 * High-level: Loads and initializes plugins by executing their onLoad hooks
 * @param plugins - Array of plugin specifiers (package names, file paths, or plugin objects with name and options)
 * @param appConfig - The application's UDL config to pass to plugin onLoad hooks
 */
export async function loadPlugins(
  plugins: PluginSpec[] = [],
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
          const packageJsonUrl = importMetaResolve(
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

      // Check for TypeScript config first (compiled), then fallback to JS
      const tsConfigSource = join(pluginPath, 'udl.config.ts');
      const tsConfigCompiled = join(pluginPath, 'dist', 'udl.config.js');
      const jsConfigPath = join(pluginPath, 'udl.config.js');

      let udlConfigPath: string;

      // Prefer compiled TypeScript config if source exists
      if (existsSync(tsConfigSource)) {
        udlConfigPath = tsConfigCompiled;
      } else {
        udlConfigPath = jsConfigPath;
      }

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
          `Plugin ${pluginName} missing or failed to load config file at ${udlConfigPath}`
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
