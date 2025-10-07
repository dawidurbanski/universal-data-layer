import { existsSync } from 'node:fs';
import { join, resolve, basename } from 'node:path';
import { pathToFileURL } from 'node:url';
import { importMetaResolve } from '@/utils/import-meta-resolve.js';
import { NodeStore } from '@/nodes/store.js';
import { createNodeActions } from '@/nodes/actions/index.js';
import { createNodeId, createContentDigest } from '@/nodes/utils/index.js';
import { defaultStore } from '@/nodes/defaultStore.js';

export const pluginTypes = ['core', 'source', 'other'] as const;

export type PluginType = (typeof pluginTypes)[number];

type PluginSpecObject = {
  name: string;
  options?: Record<string, unknown>;
};

export type PluginSpec = string | PluginSpecObject;

/**
 * Core UDL configuration object
 */
export interface UDLConfig {
  /** Plugin type */
  type?: PluginType;
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
  options?: T | undefined;
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
  /** Optional lifecycle hook for sourcing nodes at build time */
  sourceNodes?: <T = Record<string, unknown>>(
    context?: import('@/nodes/index.js').SourceNodesContext<T>
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
 * Options for loadConfigFile
 */
export interface LoadConfigFileOptions {
  /** Context to pass to onLoad hook */
  context?: OnLoadContext;
  /** Plugin name (used for sourceNodes owner tracking) */
  pluginName?: string;
  /** Node store to use for sourceNodes (if not provided, sourceNodes won't execute) */
  store?: NodeStore;
}

/**
 * Core function: Loads a single UDL config file from the given path
 * Expects: export const config = { ... } and optionally export function onLoad({ options, plugins }) {}
 * @param configPath - Absolute path to the config file
 * @param options - Configuration options
 * @returns The loaded config or null if file doesn't exist or fails to load
 */
export async function loadConfigFile(
  configPath: string,
  options?: LoadConfigFileOptions
): Promise<UDLConfig | null> {
  if (!existsSync(configPath)) {
    return null;
  }

  try {
    const fileUrl = pathToFileURL(configPath).href;
    const module: UDLConfigFile = await import(fileUrl);

    // Execute onLoad hook (named export) with context
    if (module.onLoad) {
      await module.onLoad(options?.context);
    }

    // Execute sourceNodes hook with node actions bound to this plugin
    if (module.sourceNodes && options?.pluginName && options?.store) {
      const actions = createNodeActions(options.store, options.pluginName);

      await module.sourceNodes({
        actions,
        createNodeId,
        createContentDigest,
        options: options.context?.options,
      });
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
            const config = await loadConfigFile(absolutePath, {
              context: { config: {} },
            });
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
        const config = await loadConfigFile(absolutePath, {
          context: { config: {} },
        });
        if (config) {
          return config;
        }
      }
    }
  }

  return {};
}

/**
 * High-level: Loads and initializes plugins by executing their onLoad and sourceNodes hooks
 * @param plugins - Array of plugin specifiers (package names, file paths, or plugin objects with name and options)
 * @param appConfig - The application's UDL config to pass to plugin onLoad hooks
 * @param store - Optional node store for sourceNodes hook. If not provided, uses the defaultStore singleton
 */
export async function loadPlugins(
  plugins: PluginSpec[] = [],
  appConfig?: UDLConfig,
  store?: NodeStore
) {
  // Use provided store or fall back to the default singleton
  const nodeStore = store ?? defaultStore;

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

      // Check for config files in order of preference
      const tsConfigPath = join(pluginPath, 'udl.config.ts');
      const jsConfigPath = join(pluginPath, 'udl.config.js');
      const tsCompiledPath = join(pluginPath, 'dist', 'udl.config.js');

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

      let plugin: UDLConfig | null = null;
      let configFilePath: string | null = null;

      // Determine which config file exists
      if (existsSync(tsCompiledPath)) {
        configFilePath = tsCompiledPath;
      } else if (existsSync(tsConfigPath)) {
        configFilePath = tsConfigPath;
      } else if (existsSync(jsConfigPath)) {
        configFilePath = jsConfigPath;
      }

      if (configFilePath) {
        try {
          // Load config file to get the plugin's name from config.name
          const fileUrl = pathToFileURL(resolve(configFilePath)).href;

          let module: UDLConfigFile;

          if (configFilePath.endsWith('.ts')) {
            const { register } = await import('tsx/esm/api');
            const unregister = register();

            try {
              module = await import(fileUrl);
            } finally {
              unregister();
            }
          } else {
            module = await import(fileUrl);
          }

          // Use the plugin's config.name if available, otherwise derive from path
          const actualPluginName = module.config?.name || basename(pluginPath);

          // Now execute hooks with the actual plugin name
          if (module.onLoad) {
            await module.onLoad(context);
          }

          if (module.sourceNodes && nodeStore) {
            const actions = createNodeActions(nodeStore, actualPluginName);

            await module.sourceNodes({
              actions,
              createNodeId,
              createContentDigest,
              options: context?.options,
            });
          }

          plugin = module.config;
        } catch (error) {
          console.error(
            `Failed to load config for plugin ${pluginName}:`,
            error
          );
        }
      }

      if (!plugin) {
        console.warn(
          `Plugin ${pluginName} missing or failed to load config file`
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
