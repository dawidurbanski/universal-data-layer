import { existsSync } from 'node:fs';
import { join, resolve, basename } from 'node:path';
import { pathToFileURL } from 'node:url';
import { importMetaResolve } from '@/utils/import-meta-resolve.js';
import { NodeStore } from '@/nodes/store.js';
import { createNodeActions } from '@/nodes/actions/index.js';
import { createNodeId, createContentDigest } from '@/nodes/utils/index.js';
import { defaultStore } from '@/nodes/defaultStore.js';
import { FileCacheStorage } from '@/cache/file-cache.js';
import type { CacheStorage, CachedData } from '@/cache/types.js';
import { defaultRegistry } from '@/references/index.js';
import type {
  ReferenceResolverConfig,
  EntityKeyConfig,
} from '@/references/types.js';
import {
  defaultWebhookRegistry,
  registerDefaultWebhook,
  type WebhookRegistry,
  type WebhookRegistration,
  type WebhookHooksConfig,
  type DefaultWebhookHandlerConfig,
} from '@/webhooks/index.js';

export const pluginTypes = ['core', 'source', 'other'] as const;

export type PluginType = (typeof pluginTypes)[number];

type PluginSpecObject = {
  name: string;
  options?: Record<string, unknown> & {
    /** Fields to index for O(1) lookups in GraphQL queries */
    indexes?: string[];
  };
};

export type PluginSpec = string | PluginSpecObject;

/**
 * Configuration for automatic code generation
 *
 * Note: The full CodegenConfig is defined in codegen/types/schema.ts.
 * This is kept for backward compatibility.
 */
export interface CodegenConfig {
  /**
   * Output directory for generated code.
   * @default './generated'
   */
  output?: string;

  /**
   * Whether to generate type guard functions (is{Type}, assert{Type}).
   * @default false
   */
  guards?: boolean;

  /**
   * Whether to include JSDoc comments in generated code.
   * @default true
   */
  includeJsDoc?: boolean;

  /**
   * Whether to include the internal field with NodeInternal type in generated types.
   * When true, adds `import type { NodeInternal } from 'universal-data-layer/client'`.
   * @default true
   */
  includeInternal?: boolean;

  /**
   * Specific node types to generate code for.
   * If not specified, generates for all types in the store (or filtered by owners if available).
   * @example ['Todo', 'User']
   */
  types?: string[];

  /**
   * Codegen extensions to run after built-in generators.
   * Can be extension objects or package names (will be dynamically imported).
   * @example ['@universal-data-layer/codegen-typed-queries']
   */
  extensions?: (
    | import('@/codegen/types/extension.js').CodegenExtension
    | string
  )[];
}

/**
 * Configuration for an outbound webhook trigger.
 * Outbound webhooks are sent after batch processing to notify external systems.
 */
export interface OutboundWebhookTriggerConfig {
  /** URL to POST to */
  url: string;
  /**
   * Events to trigger on. '*' = all events.
   * @default ['*']
   */
  events?: string[];
  /** Custom headers to include in the request */
  headers?: Record<string, string>;
  /**
   * Number of retries on failure.
   * @default 3
   */
  retries?: number;
  /**
   * Base delay between retries in milliseconds.
   * Uses exponential backoff: retryDelayMs * (attempt + 1)
   * @default 1000
   */
  retryDelayMs?: number;
}

/**
 * Configuration for remote webhook handling.
 */
export interface RemoteWebhooksConfig {
  /**
   * Debounce period in milliseconds.
   * After each webhook, the queue waits this long for more webhooks before processing.
   * @default 5000
   */
  debounceMs?: number;

  /**
   * Maximum queue size before forced processing.
   * When the queue reaches this size, it will process immediately regardless of debounce.
   * @default 100
   */
  maxQueueSize?: number;

  /**
   * Lifecycle hooks for webhook processing.
   */
  hooks?: WebhookHooksConfig;

  /**
   * Outbound webhook triggers to notify after batch processing.
   * These webhooks are sent after a batch of incoming webhooks has been processed,
   * enabling the "30 webhooks → 1 build" optimization.
   *
   * @example
   * ```typescript
   * trigger: [
   *   {
   *     url: 'https://api.vercel.com/v1/integrations/deploy/...',
   *     headers: { 'Authorization': 'Bearer token' },
   *     retries: 3,
   *   }
   * ]
   * ```
   */
  trigger?: OutboundWebhookTriggerConfig[];
}

/**
 * Configuration for remote data synchronization.
 */
export interface RemoteConfig {
  /**
   * Webhook queue and processing configuration.
   */
  webhooks?: RemoteWebhooksConfig;
}

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
  /**
   * The unique identifier field for nodes from this source plugin.
   * This field is used by the default webhook handler to look up existing nodes
   * when processing update/delete operations from external systems.
   *
   * The idField is automatically indexed for O(1) lookups.
   *
   * @example 'externalId' - for generic external IDs
   * @example 'contentfulId' - for Contentful entries
   * @example 'shopifyId' - for Shopify resources
   */
  idField?: string;

  /** Additional indexed fields for this plugin (for source plugins) */
  indexes?: string[];
  /** Code generation configuration - when set, automatically generates types after sourceNodes */
  codegen?: CodegenConfig;
  /**
   * Cache storage for persisting nodes across server restarts.
   * - `undefined` (default): Uses FileCacheStorage (stores in .udl-cache/nodes.json)
   * - `false`: Disables caching entirely
   * - Custom `CacheStorage`: Use a custom cache implementation (e.g., Redis, SQLite)
   */
  cache?: CacheStorage | false;
  /**
   * Configuration for remote data synchronization (webhooks, etc.).
   */
  remote?: RemoteConfig;
  /**
   * Configuration for automatic default webhook handlers.
   * When enabled, registers a default 'sync' webhook endpoint for each loaded plugin
   * that accepts standardized create/update/delete/upsert payloads.
   *
   * @example
   * ```typescript
   * defineConfig({
   *   defaultWebhook: {
   *     enabled: true,
   *     path: 'sync', // Default endpoint path for all plugins
   *     plugins: {
   *       // Customize path for specific plugin
   *       'contentful': { path: 'content-sync' },
   *       // Disable for a specific plugin
   *       'legacy-plugin': false,
   *     },
   *   },
   * });
   * ```
   */
  defaultWebhook?: DefaultWebhookHandlerConfig;
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
 * Context passed to registerTypes hook.
 * Use SchemaRegistry.createContext() to create this context.
 */
export interface RegisterTypesContext<T = Record<string, unknown>> {
  /** Register a new content type definition */
  registerType(def: unknown): void;
  /** Extend an existing content type with additional fields */
  extendType(typeName: string, fields: unknown[]): void;
  /** Get a registered content type definition by name */
  getType(name: string): unknown | undefined;
  /** Get all registered content type definitions */
  getAllTypes(): unknown[];
  /** Plugin-specific options */
  options: T | undefined;
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
  /** Optional lifecycle hook for registering type definitions (for codegen) */
  registerTypes?: <T = Record<string, unknown>>(
    context?: RegisterTypesContext<T>
  ) => void | Promise<void>;
  /**
   * Optional reference resolver configuration.
   * Defines how references from this plugin are identified and resolved.
   */
  referenceResolver?: ReferenceResolverConfig;
  /**
   * Optional entity key configuration for normalization.
   * Defines how to extract unique entity keys from this plugin's nodes.
   */
  entityKeyConfig?: EntityKeyConfig;
}

/**
 * Helper function for defining UDL configs with TypeScript support.
 * Provides autocomplete and type-checking for configuration options.
 *
 * @example
 * ```ts
 * // udl.config.ts
 * import { defineConfig } from 'universal-data-layer';
 *
 * export const config = defineConfig({
 *   plugins: ['@universal-data-layer/plugin-source-contentful'],
 *   codegen: {
 *     output: './generated',
 *   },
 * });
 * ```
 */
export function defineConfig(config: UDLConfig): UDLConfig {
  return config;
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
  /** Context to pass to registerTypes hook (from SchemaRegistry) */
  registerTypesContext?: RegisterTypesContext;
  /**
   * Webhook registry for plugins to register webhook handlers.
   * If not provided, uses the defaultWebhookRegistry singleton.
   */
  webhookRegistry?: WebhookRegistry;
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
      const actions = createNodeActions({
        store: options.store,
        owner: options.pluginName,
      });
      const webhookRegistry = options.webhookRegistry ?? defaultWebhookRegistry;

      // Create a bound registerWebhook function for this plugin
      const registerWebhook = (webhook: WebhookRegistration): void => {
        webhookRegistry.register(options.pluginName!, webhook);
      };

      await module.sourceNodes({
        actions,
        createNodeId,
        createContentDigest,
        options: options.context?.options,
        registerWebhook,
      });
    }

    // Execute registerTypes hook if context provided (for codegen integration)
    if (module.registerTypes && options?.registerTypesContext) {
      await module.registerTypes(options.registerTypesContext);
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
 * Information about a plugin's codegen configuration
 */
export interface PluginCodegenInfo {
  /** The codegen configuration from the plugin */
  config: CodegenConfig;
  /** Absolute path to the plugin folder (used as basePath for output) */
  pluginPath: string;
  /** The plugin's name (from config.name, used for owner filtering) */
  pluginName: string;
}

/**
 * Result of loading plugins, including collected codegen configs
 */
export interface LoadPluginsResult {
  /** Codegen configurations collected from all loaded plugins (including nested) */
  codegenConfigs: PluginCodegenInfo[];
}

/**
 * Options for loadPlugins function
 */
export interface LoadPluginsOptions {
  /** The application's UDL config to pass to plugin onLoad hooks */
  appConfig?: UDLConfig;
  /** Node store for sourceNodes hook. If not provided, uses the defaultStore singleton */
  store?: NodeStore;
  /** Context for registerTypes hook (from SchemaRegistry.createContext()) */
  registerTypesContext?: RegisterTypesContext;
  /** Current recursion depth (for preventing infinite loops) */
  _depth?: number;
  /**
   * Enable per-plugin caching. When true, each plugin loads/saves its nodes
   * from the cacheDir directory. Set to false to disable caching entirely.
   * @default true
   */
  cache?: boolean;
  /**
   * Directory where cache files should be stored.
   * This should be the directory containing the udl.config.ts that specifies the plugins.
   * Each plugin will store its cache in `cacheDir/.udl-cache/`.
   */
  cacheDir?: string;
  /**
   * Webhook registry for plugins to register webhook handlers.
   * If not provided, uses the defaultWebhookRegistry singleton.
   */
  webhookRegistry?: WebhookRegistry;
}

/** Maximum recursion depth for nested plugins */
const MAX_PLUGIN_DEPTH = 10;

/**
 * Resolve a plugin specifier to an absolute path
 */
async function resolvePluginPath(pluginName: string): Promise<string> {
  // Handle relative/absolute paths vs package names
  if (pluginName.startsWith('.') || pluginName.startsWith('/')) {
    return resolve(pluginName);
  }

  try {
    const { fileURLToPath } = await import('node:url');
    const packageJsonUrl = importMetaResolve(`${pluginName}/package.json`);
    const packageJsonPath = fileURLToPath(packageJsonUrl);
    const { dirname } = await import('node:path');
    return dirname(packageJsonPath);
  } catch (err) {
    console.log(
      `Could not resolve ${pluginName} via import.meta.resolve, falling back to node_modules:`,
      err
    );
    return resolve(process.cwd(), 'node_modules', pluginName);
  }
}

/**
 * Find the config file path for a plugin
 */
function findConfigFilePath(pluginPath: string): string | null {
  const tsConfigPath = join(pluginPath, 'udl.config.ts');
  const jsConfigPath = join(pluginPath, 'udl.config.js');
  const tsCompiledPath = join(pluginPath, 'dist', 'udl.config.js');

  if (existsSync(tsCompiledPath)) return tsCompiledPath;
  if (existsSync(tsConfigPath)) return tsConfigPath;
  if (existsSync(jsConfigPath)) return jsConfigPath;
  return null;
}

/**
 * Load a plugin module from a config file path
 */
async function loadPluginModule(
  configFilePath: string
): Promise<UDLConfigFile> {
  const fileUrl = pathToFileURL(resolve(configFilePath)).href;

  if (configFilePath.endsWith('.ts')) {
    const { register } = await import('tsx/esm/api');
    const unregister = register();
    try {
      return await import(fileUrl);
    } finally {
      unregister();
    }
  }

  return await import(fileUrl);
}

/**
 * Register indexes for node types created by a plugin
 */
function registerPluginIndexes(
  nodeStore: NodeStore,
  pluginName: string,
  indexes: string[]
): void {
  const nodeTypes = nodeStore.getTypes();
  for (const nodeType of nodeTypes) {
    const sampleNode = nodeStore.getByType(nodeType)[0];
    if (sampleNode?.internal.owner === pluginName) {
      for (const fieldName of indexes) {
        nodeStore.registerIndex(nodeType, fieldName);
      }
    }
  }
}

/**
 * Resolve nested plugin paths relative to parent plugin directory
 */
function resolveNestedPluginPaths(
  nestedPlugins: PluginSpec[],
  parentPath: string
): PluginSpec[] {
  return nestedPlugins.map((nestedPlugin) => {
    if (typeof nestedPlugin === 'string') {
      if (nestedPlugin.startsWith('./') || nestedPlugin.startsWith('../')) {
        return resolve(parentPath, nestedPlugin);
      }
      return nestedPlugin;
    }

    if (
      nestedPlugin.name.startsWith('./') ||
      nestedPlugin.name.startsWith('../')
    ) {
      return {
        ...nestedPlugin,
        name: resolve(parentPath, nestedPlugin.name),
      };
    }
    return nestedPlugin;
  });
}

/**
 * High-level: Loads and initializes plugins by executing their onLoad, sourceNodes, and registerTypes hooks
 * @param plugins - Array of plugin specifiers (package names, file paths, or plugin objects with name and options)
 * @param options - Configuration options including appConfig, store, and registerTypesContext
 * @returns Result containing collected codegen configs from all loaded plugins
 */
export async function loadPlugins(
  plugins: PluginSpec[] = [],
  options?: LoadPluginsOptions
): Promise<LoadPluginsResult> {
  const {
    appConfig,
    store,
    registerTypesContext,
    _depth = 0,
    cache: cacheEnabled = true,
    cacheDir,
    webhookRegistry = defaultWebhookRegistry,
  } = options ?? {};
  const nodeStore = store ?? defaultStore;
  const codegenConfigs: PluginCodegenInfo[] = [];

  if (_depth >= MAX_PLUGIN_DEPTH) {
    console.warn(
      `Maximum plugin recursion depth (${MAX_PLUGIN_DEPTH}) reached. Skipping nested plugins.`
    );
    return { codegenConfigs };
  }

  for (const pluginSpec of plugins) {
    try {
      const pluginName =
        typeof pluginSpec === 'string' ? pluginSpec : pluginSpec.name;
      const pluginOptions =
        typeof pluginSpec === 'object' ? pluginSpec.options : undefined;

      const pluginPath = await resolvePluginPath(pluginName);
      const configFilePath = findConfigFilePath(pluginPath);

      if (!configFilePath) {
        console.warn(
          `Plugin ${pluginName} missing or failed to load config file`
        );
        continue;
      }

      // Build context for plugin hooks
      const context: OnLoadContext = {
        ...(pluginOptions !== undefined && { options: pluginOptions }),
        ...(appConfig !== undefined && { config: appConfig }),
      };

      let pluginLoaded = false;
      try {
        const module = await loadPluginModule(configFilePath);
        const actualPluginName = module.config?.name || basename(pluginPath);

        // Register reference resolver if provided
        if (module.referenceResolver) {
          defaultRegistry.registerResolver(module.referenceResolver);
          // Also set the store on the registry if not already set
          if (!defaultRegistry.getStore()) {
            defaultRegistry.setStore(nodeStore);
          }
        }

        // Register entity key config if provided
        if (module.entityKeyConfig) {
          defaultRegistry.registerEntityKeyConfig(
            actualPluginName,
            module.entityKeyConfig
          );
        }

        // Execute onLoad hook
        if (module.onLoad) {
          await module.onLoad(context);
        }

        // Execute sourceNodes hook and register indexes
        if (module.sourceNodes && nodeStore) {
          // Get the idField from plugin config (used for webhook lookups)
          const pluginIdField = module.config?.idField;

          // Build indexes: idField is always indexed if specified
          const pluginDefaultIndexes = module.config?.indexes || [];
          const userIndexes =
            (pluginOptions as { indexes?: string[] })?.indexes || [];
          const allIndexes = [
            ...new Set([
              ...(pluginIdField ? [pluginIdField] : []),
              ...pluginDefaultIndexes,
              ...userIndexes,
            ]),
          ];

          // Determine if caching is enabled for this plugin
          const pluginCacheDisabled = module.config?.cache === false;
          const shouldCache = cacheEnabled && !pluginCacheDisabled;

          // Cache is stored in the config directory that specified the plugin,
          // not in the plugin's own directory. This ensures that when a feature
          // uses a plugin, the cache lives alongside the feature's config.
          // For nested plugins, the cache is stored in the parent plugin's directory.
          const cacheLocation = cacheDir ?? pluginPath;

          // Load plugin's cached nodes before sourceNodes
          let pluginCache: FileCacheStorage | null = null;
          if (shouldCache) {
            pluginCache = new FileCacheStorage(cacheLocation);
            const cached = await pluginCache.load();
            if (cached && cached.nodes.length > 0) {
              console.log(
                `📂 [${actualPluginName}] Loading ${cached.nodes.length} nodes from cache...`
              );
              // Only load nodes owned by this plugin
              const pluginNodes = cached.nodes.filter(
                (node) => node.internal.owner === actualPluginName
              );
              for (const node of pluginNodes) {
                nodeStore.set(node);
              }
              // Restore indexes for this plugin
              for (const [nodeType, fieldNames] of Object.entries(
                cached.indexes
              )) {
                for (const fieldName of fieldNames) {
                  nodeStore.registerIndex(nodeType, fieldName);
                }
              }
            }
          }

          const actions = createNodeActions({
            store: nodeStore,
            owner: actualPluginName,
          });

          // Create a bound registerWebhook function for this plugin
          const registerWebhook = (webhook: WebhookRegistration): void => {
            webhookRegistry.register(actualPluginName, webhook);
          };

          await module.sourceNodes({
            actions,
            createNodeId,
            createContentDigest,
            options: context?.options,
            cacheDir: cacheLocation,
            registerWebhook,
          });

          registerPluginIndexes(nodeStore, actualPluginName, allIndexes);

          // Register default webhook handler if enabled in config
          if (appConfig?.defaultWebhook) {
            registerDefaultWebhook(
              webhookRegistry,
              actualPluginName,
              appConfig.defaultWebhook,
              pluginIdField
            );
          }

          // Save plugin's nodes after sourceNodes
          if (shouldCache && pluginCache) {
            // Get only nodes owned by this plugin
            const allNodes = nodeStore.getAll();
            const pluginNodes = allNodes.filter(
              (node) => node.internal.owner === actualPluginName
            );

            // Get indexes for node types owned by this plugin
            const pluginNodeTypes = new Set(
              pluginNodes.map((n) => n.internal.type)
            );
            const indexes: Record<string, string[]> = {};
            for (const nodeType of pluginNodeTypes) {
              const registeredIndexes =
                nodeStore.getRegisteredIndexes(nodeType);
              if (registeredIndexes.length > 0) {
                indexes[nodeType] = registeredIndexes;
              }
            }

            const cacheData: CachedData = {
              nodes: pluginNodes,
              indexes,
              meta: {
                version: 1,
                createdAt: Date.now(),
                updatedAt: Date.now(),
              },
            };
            await pluginCache.save(cacheData);
            console.log(
              `💾 [${actualPluginName}] Cached ${pluginNodes.length} nodes to disk`
            );
          }
        }

        // Execute registerTypes hook
        if (module.registerTypes && registerTypesContext) {
          const typesContext: RegisterTypesContext = {
            ...registerTypesContext,
            options: context?.options,
          };
          await module.registerTypes(typesContext);
        }

        // Collect codegen config
        if (module.config?.codegen) {
          codegenConfigs.push({
            config: module.config.codegen,
            pluginPath,
            pluginName: actualPluginName,
          });
        }

        // Handle nested plugins recursively
        if (module.config?.plugins && module.config.plugins.length > 0) {
          const resolvedNestedPlugins = resolveNestedPluginPaths(
            module.config.plugins,
            pluginPath
          );

          const nestedResult = await loadPlugins(resolvedNestedPlugins, {
            appConfig: module.config,
            store: nodeStore,
            ...(registerTypesContext && { registerTypesContext }),
            _depth: _depth + 1,
            cache: cacheEnabled,
            // Nested plugins store their cache in the parent plugin's directory
            cacheDir: pluginPath,
            webhookRegistry,
          });

          codegenConfigs.push(...nestedResult.codegenConfigs);
        }

        pluginLoaded = true;
      } catch (error) {
        console.error(`Failed to load config for plugin ${pluginName}:`, error);
      }

      if (!pluginLoaded) {
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

  return { codegenConfigs };
}
