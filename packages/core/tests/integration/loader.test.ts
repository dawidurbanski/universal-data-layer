import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

// Type augmentation for test globals
declare global {
  var __testLoadContext: unknown;
  var __localPluginLoaded: unknown;
  var __localPluginContext: unknown;
  var __pluginOptions: unknown;
  var __plugin1Loaded: unknown;
  var __plugin2Loaded: unknown;
  var __tsCompiledLoaded: unknown;
  var __shouldFailTsxImport: boolean;
  var __childObjPluginOptions: unknown;
  var __childCacheDir: unknown;
}

// Use vi.hoisted to create a mutable reference that can be changed during tests
const shouldFailTsxImport = vi.hoisted(() => ({ value: false }));
const shouldFailExistsSync = vi.hoisted(() => ({ value: false }));

// Mock tsx/esm/api to allow controlled failures
vi.mock('tsx/esm/api', async () => {
  const actual =
    await vi.importActual<typeof import('tsx/esm/api')>('tsx/esm/api');
  return {
    ...actual,
    register: () => {
      if (shouldFailTsxImport.value) {
        throw new Error('Simulated tsx import failure');
      }
      return actual.register();
    },
  };
});

// Mock node:fs to allow controlled failures in existsSync
vi.mock('node:fs', async () => {
  const actual = await vi.importActual<typeof import('node:fs')>('node:fs');
  return {
    ...actual,
    existsSync: (path: string) => {
      if (shouldFailExistsSync.value) {
        throw new Error('existsSync failed');
      }
      return actual.existsSync(path);
    },
  };
});

// Mock import.meta.resolve to make it work in Vitest
// Even with Vite 7, import.meta.resolve doesn't work properly in Vitest
vi.mock('../../src/utils/import-meta-resolve.js', async () => {
  const { createRequire } = await import('node:module');
  return {
    importMetaResolve: vi
      .fn()
      .mockImplementation(
        (specifier: string) =>
          `file://${createRequire(import.meta.url).resolve(specifier)}`
      ),
  };
});

import {
  loadConfigFile,
  loadAppConfig,
  loadPlugins,
  defineConfig,
} from '../../src/loader.js';

describe('loader integration tests', () => {
  const testDir = join(tmpdir(), 'udl-loader-test-' + Date.now());
  const pluginsDir = join(testDir, 'plugins');

  beforeAll(() => {
    // Create test directories
    mkdirSync(testDir, { recursive: true });
    mkdirSync(pluginsDir, { recursive: true });
  });

  afterAll(() => {
    // Cleanup test directories
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('defineConfig', () => {
    it('should return the config object directly', () => {
      const result = defineConfig({
        port: 3000,
        plugins: ['test-plugin'],
      });

      expect(result).toEqual({
        port: 3000,
        plugins: ['test-plugin'],
      });
    });

    it('should preserve all config properties', () => {
      const result = defineConfig({
        port: 4000,
        host: 'localhost',
        codegen: {
          output: './generated',
          guards: true,
        },
      });

      expect(result).toEqual({
        port: 4000,
        host: 'localhost',
        codegen: {
          output: './generated',
          guards: true,
        },
      });
    });

    it('should work with plugin type configs', () => {
      const result = defineConfig({
        type: 'source',
        name: 'my-plugin',
        indexes: ['slug'],
      });

      expect(result).toEqual({
        type: 'source',
        name: 'my-plugin',
        indexes: ['slug'],
      });
    });
  });

  describe('loadConfigFile', () => {
    it('should load a JavaScript config file', async () => {
      const configPath = join(testDir, 'test-config.js');

      writeFileSync(
        configPath,
        `
        export const config = {
          port: 3000,
          plugins: ['test-plugin']
        };
        `
      );

      const result = await loadConfigFile(configPath);

      expect(result).toEqual({
        port: 3000,
        plugins: ['test-plugin'],
      });
    });

    it('should return null and log error for malformed config file', async () => {
      const configPath = join(testDir, 'malformed-config.js');

      writeFileSync(
        configPath,
        `
        // This is invalid JavaScript - missing closing brace
        export const config = {
          port: 3000,
          plugins: ['test-plugin'
        ;
        `
      );

      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      const result = await loadConfigFile(configPath);

      expect(result).toBeNull();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to load UDL config from'),
        expect.anything()
      );

      consoleErrorSpy.mockRestore();
    });

    it('should handle config file without config export', async () => {
      const configPath = join(testDir, 'no-config-export.js');

      writeFileSync(
        configPath,
        `
        export const someOtherThing = {
          port: 3000
        };
        `
      );

      const result = await loadConfigFile(configPath);

      // Module loads successfully but config is undefined
      expect(result).toBeUndefined();
    });

    it('should execute onLoad hook with context', async () => {
      const configPath = join(testDir, 'test-config-with-hook.js');

      writeFileSync(
        configPath,
        `
        export const config = {
          port: 4000
        };

        let loadedContext = null;

        export function onLoad(context) {
          loadedContext = context;
          global.__testLoadContext = context;
        }
        `
      );

      const context = {
        options: { apiKey: 'test-key' },
        config: { port: 4000 },
      };

      await loadConfigFile(configPath, { context });

      expect(global.__testLoadContext).toEqual(context);

      // Cleanup
      delete global.__testLoadContext;
    });

    it('should return null for non-existent files', async () => {
      const result = await loadConfigFile(join(testDir, 'non-existent.js'));

      expect(result).toBeNull();
    });
  });

  describe('loadAppConfig', () => {
    it('should find and load udl.config.js', async () => {
      const appDir = join(testDir, 'app-js');
      mkdirSync(appDir, { recursive: true });

      writeFileSync(
        join(appDir, 'udl.config.js'),
        `
        export const config = {
          port: 5000,
          host: 'localhost'
        };
        `
      );

      const result = await loadAppConfig(appDir);

      expect(result).toEqual({
        port: 5000,
        host: 'localhost',
      });
    });

    it('should prioritize TypeScript config over JavaScript', async () => {
      const appDir = join(testDir, 'app-ts-priority');
      mkdirSync(appDir, { recursive: true });

      // Create both .ts and .js configs
      writeFileSync(
        join(appDir, 'udl.config.ts'),
        `
        export const config = {
          port: 6000,
          plugins: ['ts-plugin']
        };
        `
      );

      writeFileSync(
        join(appDir, 'udl.config.js'),
        `
        export const config = {
          port: 7000,
          plugins: ['js-plugin']
        };
        `
      );

      const result = await loadAppConfig(appDir);

      // TypeScript should be loaded first
      expect(result.port).toBe(6000);
      expect(result.plugins).toContain('ts-plugin');
    });

    it('should return empty object when no config exists', async () => {
      const appDir = join(testDir, 'app-no-config');
      mkdirSync(appDir, { recursive: true });

      const result = await loadAppConfig(appDir);

      expect(result).toEqual({});
    });

    it('should handle TypeScript config load failure gracefully', async () => {
      const appDir = join(testDir, 'app-ts-error');
      mkdirSync(appDir, { recursive: true });

      // Create a TypeScript config with syntax error
      writeFileSync(
        join(appDir, 'udl.config.ts'),
        `
        // Invalid TypeScript - syntax error
        export const config = {
          port: 6000,
          plugins: ['broken-plugin'
        ;
        `
      );

      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      const result = await loadAppConfig(appDir);

      // Should fallback to empty object
      expect(result).toEqual({});
      expect(consoleErrorSpy).toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });

    it('should fallback to JS config if TS config fails', async () => {
      const appDir = join(testDir, 'app-ts-fallback');
      mkdirSync(appDir, { recursive: true });

      // Create broken TypeScript config
      writeFileSync(
        join(appDir, 'udl.config.ts'),
        `
        export const config = { broken
        `
      );

      // Create working JavaScript config
      writeFileSync(
        join(appDir, 'udl.config.js'),
        `
        export const config = {
          port: 7000,
          plugins: ['working-plugin']
        };
        `
      );

      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      const result = await loadAppConfig(appDir);

      // Should load the JS config after TS fails
      expect(result).toEqual({
        port: 7000,
        plugins: ['working-plugin'],
      });

      consoleErrorSpy.mockRestore();
    });

    it('should catch errors during tsx import and continue', async () => {
      const appDir = join(testDir, 'app-tsx-import-error');
      mkdirSync(appDir, { recursive: true });

      // Create a valid TS config
      writeFileSync(
        join(appDir, 'udl.config.ts'),
        `
        export const config = {
          port: 8000
        };
        `
      );

      // Also create a JS fallback
      writeFileSync(
        join(appDir, 'udl.config.js'),
        `
        export const config = {
          port: 8001
        };
        `
      );

      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      // Enable tsx import failure using the hoisted reference
      shouldFailTsxImport.value = true;

      const result = await loadAppConfig(appDir);

      // Should fall back to JS config when tsx register fails
      expect(result.port).toBe(8001);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to load TypeScript config from'),
        expect.any(Error)
      );

      // Cleanup
      shouldFailTsxImport.value = false;
      consoleErrorSpy.mockRestore();
    });
  });

  describe('loadPlugins', () => {
    it('should load plugin from local path', async () => {
      const pluginDir = join(pluginsDir, 'local-plugin');
      mkdirSync(pluginDir, { recursive: true });

      writeFileSync(
        join(pluginDir, 'udl.config.js'),
        `
        export const config = {
          type: 'source',
          name: 'local-plugin'
        };

        export function onLoad(context) {
          global.__localPluginLoaded = true;
          global.__localPluginContext = context;
        }
        `
      );

      const appConfig = { port: 8000 };

      await loadPlugins([pluginDir], { appConfig });

      expect(global.__localPluginLoaded).toBe(true);
      expect(
        (global.__localPluginContext as { config: unknown }).config
      ).toEqual(appConfig);

      // Cleanup
      delete global.__localPluginLoaded;
      delete global.__localPluginContext;
    });

    it('should pass plugin options to onLoad hook', async () => {
      const pluginDir = join(pluginsDir, 'plugin-with-options');
      mkdirSync(pluginDir, { recursive: true });

      writeFileSync(
        join(pluginDir, 'udl.config.js'),
        `
        export const config = {
          name: 'plugin-with-options'
        };

        export function onLoad(context) {
          global.__pluginOptions = context.options;
        }
        `
      );

      const pluginOptions = {
        apiKey: 'secret-key',
        environment: 'production',
      };

      await loadPlugins([
        {
          name: pluginDir,
          options: pluginOptions,
        },
      ]);

      expect(global.__pluginOptions).toEqual(pluginOptions);

      // Cleanup
      delete global.__pluginOptions;
    });

    it('should load multiple plugins in sequence', async () => {
      const plugin1Dir = join(pluginsDir, 'plugin-1');
      const plugin2Dir = join(pluginsDir, 'plugin-2');

      mkdirSync(plugin1Dir, { recursive: true });
      mkdirSync(plugin2Dir, { recursive: true });

      writeFileSync(
        join(plugin1Dir, 'udl.config.js'),
        `
        export const config = { name: 'plugin-1' };
        export function onLoad() {
          global.__plugin1Loaded = true;
        }
        `
      );

      writeFileSync(
        join(plugin2Dir, 'udl.config.js'),
        `
        export const config = { name: 'plugin-2' };
        export function onLoad() {
          global.__plugin2Loaded = true;
        }
        `
      );

      await loadPlugins([plugin1Dir, plugin2Dir]);

      expect(global.__plugin1Loaded).toBe(true);
      expect(global.__plugin2Loaded).toBe(true);

      // Cleanup
      delete global.__plugin1Loaded;
      delete global.__plugin2Loaded;
    });

    it('should handle plugin load failures gracefully', async () => {
      const consoleWarnSpy = vi
        .spyOn(console, 'warn')
        .mockImplementation(() => {});
      const consoleLogSpy = vi
        .spyOn(console, 'log')
        .mockImplementation(() => {});

      // Try to load a non-existent plugin
      await loadPlugins(['non-existent-plugin']);

      expect(consoleWarnSpy).toHaveBeenCalled();

      consoleWarnSpy.mockRestore();
      consoleLogSpy.mockRestore();
    });

    it('should catch and log errors when plugin onLoad hook throws', async () => {
      const pluginDir = join(pluginsDir, 'error-plugin');
      mkdirSync(pluginDir, { recursive: true });

      // Create a plugin config that will throw an error
      writeFileSync(
        join(pluginDir, 'udl.config.js'),
        `
        export const config = {
          name: 'error-plugin'
        };

        export function onLoad() {
          throw new Error('Plugin initialization failed');
        }
        `
      );

      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      const consoleWarnSpy = vi
        .spyOn(console, 'warn')
        .mockImplementation(() => {});

      // Should not throw, should catch the error in loadConfigFile
      await loadPlugins([pluginDir]);

      // Error is caught in loadConfigFile, not loadPlugins
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to load config for plugin'),
        expect.any(Error)
      );

      consoleErrorSpy.mockRestore();
      consoleWarnSpy.mockRestore();
    });

    it('should handle malformed plugin config files', async () => {
      const pluginDir = join(pluginsDir, 'malformed-plugin');
      mkdirSync(pluginDir, { recursive: true });

      // Create a malformed plugin config
      writeFileSync(
        join(pluginDir, 'udl.config.js'),
        `
        // Syntax error - missing closing brace
        export const config = {
          name: 'malformed-plugin'
        ;
        `
      );

      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      const consoleWarnSpy = vi
        .spyOn(console, 'warn')
        .mockImplementation(() => {});

      await loadPlugins([pluginDir]);

      // Should get error from loadConfigFile and warning about missing plugin
      expect(consoleErrorSpy).toHaveBeenCalled();
      expect(consoleWarnSpy).toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
      consoleWarnSpy.mockRestore();
    });

    it('should handle plugin spec with object format', async () => {
      const pluginDir = join(pluginsDir, 'object-spec-plugin');
      mkdirSync(pluginDir, { recursive: true });

      writeFileSync(
        join(pluginDir, 'udl.config.js'),
        `
        export const config = {
          name: 'object-spec-plugin'
        };
        `
      );

      // Test with object plugin spec format
      await loadPlugins([{ name: pluginDir, options: { test: true } }]);

      // Should load successfully - just verifying the object format works
    });

    it('should handle plugin with extremely long path gracefully', async () => {
      const consoleWarnSpy = vi
        .spyOn(console, 'warn')
        .mockImplementation(() => {});
      const consoleLogSpy = vi
        .spyOn(console, 'log')
        .mockImplementation(() => {});

      // Create a very long plugin name (package name style, not a path)
      const longPluginName = 'plugin-' + 'x'.repeat(500);

      await loadPlugins([longPluginName]);

      // Should warn about missing plugin (not crash)
      expect(consoleWarnSpy).toHaveBeenCalled();

      consoleWarnSpy.mockRestore();
      consoleLogSpy.mockRestore();
    });

    it('should use import.meta.resolve path when available', async () => {
      // Test with a real package that exists in node_modules to hit line 210
      const consoleWarnSpy = vi
        .spyOn(console, 'warn')
        .mockImplementation(() => {});

      // Use 'vitest' package which definitely exists
      await loadPlugins(['vitest']);

      // Should warn about missing config (but the path resolution worked)
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          'Plugin vitest missing or failed to load config file'
        )
      );

      consoleWarnSpy.mockRestore();
    });

    it('should catch errors when existsSync throws with string plugin spec', async () => {
      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      // Enable existsSync to throw
      shouldFailExistsSync.value = true;

      await loadPlugins(['./fake-plugin']);

      // The outer catch should handle this
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to load plugin ./fake-plugin'),
        expect.any(Error)
      );

      // Cleanup
      shouldFailExistsSync.value = false;
      consoleErrorSpy.mockRestore();
    });

    it('should catch errors when existsSync throws with object plugin spec', async () => {
      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      // Enable existsSync to throw
      shouldFailExistsSync.value = true;

      await loadPlugins([{ name: './fake-plugin', options: { test: true } }]);

      // The outer catch should handle this - testing the pluginSpec.name branch
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to load plugin ./fake-plugin'),
        expect.any(Error)
      );

      // Cleanup
      shouldFailExistsSync.value = false;
      consoleErrorSpy.mockRestore();
    });

    it('should prefer compiled TypeScript config over source', async () => {
      const pluginDir = join(pluginsDir, 'ts-compiled-plugin');
      const distDir = join(pluginDir, 'dist');

      mkdirSync(distDir, { recursive: true });

      // Create source TypeScript config
      writeFileSync(
        join(pluginDir, 'udl.config.ts'),
        `
        export const config = {
          name: 'ts-plugin',
          version: '1.0.0'
        };
        `
      );

      // Create compiled JavaScript config
      writeFileSync(
        join(distDir, 'udl.config.js'),
        `
        export const config = {
          name: 'ts-plugin-compiled',
          version: '1.0.0'
        };

        export function onLoad() {
          global.__tsCompiledLoaded = true;
        }
        `
      );

      await loadPlugins([pluginDir]);

      // Should load the compiled version
      expect(global.__tsCompiledLoaded).toBe(true);

      // Cleanup
      delete global.__tsCompiledLoaded;
    });

    it('should execute registerTypes hook in loadConfigFile when context is provided', async () => {
      const configPath = join(testDir, 'register-types-config.js');

      writeFileSync(
        configPath,
        `
        export const config = {
          name: 'register-types-test'
        };

        export async function registerTypes(context) {
          context.registerType({ name: 'TestType', fields: [] });
        }
        `
      );

      const registeredTypes: unknown[] = [];
      const registerTypesContext = {
        registerType: (def: unknown) => registeredTypes.push(def),
        extendType: () => {},
        getType: () => undefined,
        getAllTypes: () => registeredTypes,
        options: undefined,
      };

      await loadConfigFile(configPath, {
        registerTypesContext,
      });

      expect(registeredTypes).toHaveLength(1);
      expect(registeredTypes[0]).toEqual({ name: 'TestType', fields: [] });
    });

    it('should register reference resolver from plugin config', async () => {
      const { defaultRegistry } = await import('@/references/index.js');

      // Clear any existing resolvers
      defaultRegistry.clear();

      const pluginDir = join(pluginsDir, 'reference-resolver-plugin');
      mkdirSync(pluginDir, { recursive: true });

      writeFileSync(
        join(pluginDir, 'udl.config.js'),
        `
        export const config = {
          name: 'reference-resolver-plugin'
        };

        export const referenceResolver = {
          id: 'test-reference-resolver',
          markerField: '_testRef',
          lookupField: 'testId',
          isReference: (value) => value && typeof value === 'object' && '_testRef' in value,
          getLookupValue: (ref) => ref.testId,
          getPossibleTypes: () => [],
        };
        `
      );

      await loadPlugins([pluginDir], { appConfig: {} });

      const resolver = defaultRegistry.getResolver('test-reference-resolver');
      expect(resolver).toBeDefined();
      expect(resolver?.markerField).toBe('_testRef');
      expect(resolver?.lookupField).toBe('testId');

      // Cleanup
      defaultRegistry.clear();
    });

    it('should register entity key config from plugin config', async () => {
      const { defaultRegistry } = await import('@/references/index.js');

      // Clear any existing configs
      defaultRegistry.clear();

      const pluginDir = join(pluginsDir, 'entity-key-plugin');
      mkdirSync(pluginDir, { recursive: true });

      writeFileSync(
        join(pluginDir, 'udl.config.js'),
        `
        export const config = {
          name: 'entity-key-plugin'
        };

        export const entityKeyConfig = {
          idField: 'customEntityId',
          priority: 10
        };
        `
      );

      await loadPlugins([pluginDir], { appConfig: {} });

      // Verify entity key config was registered by checking if it can extract entity keys
      const entityKey = defaultRegistry.getEntityKey({
        __typename: 'TestType',
        customEntityId: 'test-123',
      });
      expect(entityKey).toBe('TestType:test-123');

      // Cleanup
      defaultRegistry.clear();
    });

    it('should execute registerTypes hook in loadPlugins with context', async () => {
      const pluginDir = join(pluginsDir, 'register-types-plugin');
      mkdirSync(pluginDir, { recursive: true });

      writeFileSync(
        join(pluginDir, 'udl.config.js'),
        `
        export const config = {
          name: 'register-types-plugin'
        };

        export async function registerTypes(context) {
          context.registerType({ name: 'PluginType', fields: ['id', 'name'] });
        }
        `
      );

      const registeredTypes: unknown[] = [];
      const registerTypesContext = {
        registerType: (def: unknown) => registeredTypes.push(def),
        extendType: () => {},
        getType: () => undefined,
        getAllTypes: () => registeredTypes,
        options: undefined,
      };

      await loadPlugins([pluginDir], {
        appConfig: {},
        registerTypesContext,
      });

      expect(registeredTypes).toHaveLength(1);
      expect(registeredTypes[0]).toEqual({
        name: 'PluginType',
        fields: ['id', 'name'],
      });
    });

    it('should collect codegen configs from loaded plugins', async () => {
      const pluginDir = join(pluginsDir, 'codegen-plugin');
      mkdirSync(pluginDir, { recursive: true });

      writeFileSync(
        join(pluginDir, 'udl.config.js'),
        `
        export const config = {
          name: 'codegen-plugin',
          codegen: {
            output: './generated',
            guards: true,
            types: ['Product', 'Category']
          }
        };
        `
      );

      const result = await loadPlugins([pluginDir], { appConfig: {} });

      expect(result.codegenConfigs).toHaveLength(1);
      expect(result.codegenConfigs[0]?.config).toEqual({
        output: './generated',
        guards: true,
        types: ['Product', 'Category'],
      });
      expect(result.codegenConfigs[0]?.pluginName).toBe('codegen-plugin');
    });

    it('should stop loading when maximum plugin recursion depth is reached', async () => {
      const consoleWarnSpy = vi
        .spyOn(console, 'warn')
        .mockImplementation(() => {});

      // Create a plugin that would try to load itself recursively
      const pluginDir = join(pluginsDir, 'recursive-plugin');
      mkdirSync(pluginDir, { recursive: true });

      writeFileSync(
        join(pluginDir, 'udl.config.js'),
        `
        export const config = {
          name: 'recursive-plugin'
        };
        `
      );

      // Call loadPlugins at max depth (10)
      await loadPlugins([pluginDir], {
        appConfig: {},
        _depth: 10,
      });

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Maximum plugin recursion depth')
      );

      consoleWarnSpy.mockRestore();
    });

    it('should load nested plugins recursively and resolve relative paths', async () => {
      const parentPluginDir = join(pluginsDir, 'parent-plugin');
      const childPluginDir = join(parentPluginDir, 'child-plugin');
      mkdirSync(childPluginDir, { recursive: true });

      // Child plugin config
      writeFileSync(
        join(childPluginDir, 'udl.config.js'),
        `
        export const config = {
          name: 'child-plugin',
          codegen: {
            output: './child-generated'
          }
        };

        export async function sourceNodes({ actions, createNodeId }) {
          await actions.createNode({
            internal: {
              id: createNodeId('ChildNode', '1'),
              type: 'ChildNode',
            },
            parent: undefined,
            children: undefined,
            source: 'child',
          });
        }
        `
      );

      // Parent plugin with nested plugin using relative path
      writeFileSync(
        join(parentPluginDir, 'udl.config.js'),
        `
        export const config = {
          name: 'parent-plugin',
          plugins: ['./child-plugin'], // Relative path to child
          codegen: {
            output: './parent-generated'
          }
        };

        export async function sourceNodes({ actions, createNodeId }) {
          await actions.createNode({
            internal: {
              id: createNodeId('ParentNode', '1'),
              type: 'ParentNode',
            },
            parent: undefined,
            children: undefined,
            source: 'parent',
          });
        }
        `
      );

      const { NodeStore } = await import('@/nodes/index.js');
      const store = new NodeStore();

      const result = await loadPlugins([parentPluginDir], {
        appConfig: {},
        store,
        cache: false, // Disable cache for testing
      });

      // Both parent and child nodes should be created
      const nodes = store.getAll();
      expect(nodes).toHaveLength(2);

      const parentNode = nodes.find(
        (n) => (n as { source?: string }).source === 'parent'
      );
      const childNode = nodes.find(
        (n) => (n as { source?: string }).source === 'child'
      );

      expect(parentNode).toBeDefined();
      expect(childNode).toBeDefined();
      expect(childNode?.internal.owner).toBe('child-plugin');

      // Codegen configs from both should be collected
      expect(result.codegenConfigs).toHaveLength(2);
    });

    it('should resolve nested plugin paths with ../ relative paths', async () => {
      const pluginsBaseDir = join(pluginsDir, 'nested-test');
      const parentDir = join(pluginsBaseDir, 'parent');
      const siblingDir = join(pluginsBaseDir, 'sibling');
      mkdirSync(parentDir, { recursive: true });
      mkdirSync(siblingDir, { recursive: true });

      // Sibling plugin (at same level as parent)
      writeFileSync(
        join(siblingDir, 'udl.config.js'),
        `
        export const config = {
          name: 'sibling-plugin'
        };

        export async function sourceNodes({ actions, createNodeId }) {
          await actions.createNode({
            internal: {
              id: createNodeId('SiblingNode', '1'),
              type: 'SiblingNode',
            },
            parent: undefined,
            children: undefined,
          });
        }
        `
      );

      // Parent plugin referencing sibling with ../
      writeFileSync(
        join(parentDir, 'udl.config.js'),
        `
        export const config = {
          name: 'parent-with-sibling',
          plugins: ['../sibling'] // Relative path up and across
        };
        `
      );

      const { NodeStore } = await import('@/nodes/index.js');
      const store = new NodeStore();

      await loadPlugins([parentDir], {
        appConfig: {},
        store,
        cache: false,
      });

      const nodes = store.getAll();
      expect(nodes).toHaveLength(1);
      expect(nodes[0]?.internal.owner).toBe('sibling-plugin');
    });

    it('should resolve nested plugin with object format and relative path', async () => {
      const parentPluginDir = join(pluginsDir, 'parent-obj-plugin');
      const childPluginDir = join(parentPluginDir, 'child-obj-plugin');
      mkdirSync(childPluginDir, { recursive: true });

      // Child plugin
      writeFileSync(
        join(childPluginDir, 'udl.config.js'),
        `
        export const config = {
          name: 'child-obj-plugin'
        };

        export async function onLoad(context) {
          global.__childObjPluginOptions = context?.options;
        }
        `
      );

      // Parent plugin using object format with relative path
      writeFileSync(
        join(parentPluginDir, 'udl.config.js'),
        `
        export const config = {
          name: 'parent-obj-plugin',
          plugins: [
            {
              name: './child-obj-plugin',
              options: { nestedOption: 'value' }
            }
          ]
        };
        `
      );

      await loadPlugins([parentPluginDir], {
        appConfig: {},
        cache: false,
      });

      // Child plugin should have received options from parent config
      // Nested plugin options ARE passed through when specified in object format
      expect(global.__childObjPluginOptions).toEqual({ nestedOption: 'value' });

      // Cleanup
      delete global.__childObjPluginOptions;
    });

    it('should handle nested plugins with non-relative string paths (package names)', async () => {
      const parentPluginDir = join(pluginsDir, 'parent-with-package-plugin');
      mkdirSync(parentPluginDir, { recursive: true });

      // Parent plugin that references a non-existent package name (not relative path)
      writeFileSync(
        join(parentPluginDir, 'udl.config.js'),
        `
        export const config = {
          name: 'parent-with-package',
          plugins: ['some-external-package'] // Not a relative path, treated as package name
        };
        `
      );

      const consoleWarnSpy = vi
        .spyOn(console, 'warn')
        .mockImplementation(() => {});
      const consoleLogSpy = vi
        .spyOn(console, 'log')
        .mockImplementation(() => {});

      await loadPlugins([parentPluginDir], {
        appConfig: {},
        cache: false,
      });

      // Should warn about the missing package
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('missing or failed to load config file')
      );

      consoleWarnSpy.mockRestore();
      consoleLogSpy.mockRestore();
    });

    it('should handle nested plugins with non-relative object paths (package names)', async () => {
      const parentPluginDir = join(
        pluginsDir,
        'parent-with-obj-package-plugin'
      );
      mkdirSync(parentPluginDir, { recursive: true });

      // Parent plugin that references a non-existent package name in object format
      writeFileSync(
        join(parentPluginDir, 'udl.config.js'),
        `
        export const config = {
          name: 'parent-with-obj-package',
          plugins: [
            {
              name: 'some-external-package', // Not a relative path
              options: { test: true }
            }
          ]
        };
        `
      );

      const consoleWarnSpy = vi
        .spyOn(console, 'warn')
        .mockImplementation(() => {});
      const consoleLogSpy = vi
        .spyOn(console, 'log')
        .mockImplementation(() => {});

      await loadPlugins([parentPluginDir], {
        appConfig: {},
        cache: false,
      });

      // Should warn about the missing package
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('missing or failed to load config file')
      );

      consoleWarnSpy.mockRestore();
      consoleLogSpy.mockRestore();
    });

    it('should pass registerTypesContext to nested plugins', async () => {
      const parentPluginDir = join(pluginsDir, 'parent-register-types');
      const childPluginDir = join(parentPluginDir, 'child-register-types');
      mkdirSync(childPluginDir, { recursive: true });

      // Child plugin that registers types
      writeFileSync(
        join(childPluginDir, 'udl.config.js'),
        `
        export const config = {
          name: 'child-register-types'
        };

        export async function registerTypes(context) {
          context.registerType({ name: 'NestedType', fields: ['nestedField'] });
        }
        `
      );

      // Parent plugin with nested child
      writeFileSync(
        join(parentPluginDir, 'udl.config.js'),
        `
        export const config = {
          name: 'parent-register-types',
          plugins: ['./child-register-types']
        };

        export async function registerTypes(context) {
          context.registerType({ name: 'ParentType', fields: ['parentField'] });
        }
        `
      );

      const registeredTypes: unknown[] = [];
      const registerTypesContext = {
        registerType: (def: unknown) => registeredTypes.push(def),
        extendType: () => {},
        getType: () => undefined,
        getAllTypes: () => registeredTypes,
        options: undefined,
      };

      await loadPlugins([parentPluginDir], {
        appConfig: {},
        registerTypesContext,
        cache: false,
      });

      // Both parent and child should have registered their types
      expect(registeredTypes).toHaveLength(2);
      expect(registeredTypes).toContainEqual({
        name: 'ParentType',
        fields: ['parentField'],
      });
      expect(registeredTypes).toContainEqual({
        name: 'NestedType',
        fields: ['nestedField'],
      });
    });

    it('should load and save nodes from cache when caching is enabled', async () => {
      const pluginDir = join(pluginsDir, 'cached-plugin');
      const cacheDir = join(pluginDir, '.udl-cache');
      mkdirSync(pluginDir, { recursive: true });

      // Create a plugin that creates nodes
      writeFileSync(
        join(pluginDir, 'udl.config.js'),
        `
        let callCount = 0;
        export const config = {
          name: 'cached-plugin'
        };

        export async function sourceNodes({ actions, createNodeId }) {
          callCount++;
          // Only create node on first call
          // This simulates a real plugin that might skip work if cache is valid
          await actions.createNode({
            internal: {
              id: createNodeId('CachedNode', 'cached-1'),
              type: 'CachedNode',
            },
            parent: undefined,
            children: undefined,
            callNumber: callCount,
          });
        }
        `
      );

      const { NodeStore } = await import('@/nodes/index.js');

      // Suppress console logs for cleaner test output
      const consoleLogSpy = vi
        .spyOn(console, 'log')
        .mockImplementation(() => {});

      // First load - should create nodes and save cache
      const store1 = new NodeStore();
      await loadPlugins([pluginDir], {
        appConfig: {},
        store: store1,
        cache: true,
        cacheDir: pluginDir,
      });

      expect(store1.getAll()).toHaveLength(1);
      expect((store1.getAll()[0] as { callNumber?: number }).callNumber).toBe(
        1
      );

      // Verify cache file was created
      const { existsSync: fsExistsSync } = await import('node:fs');
      expect(fsExistsSync(join(cacheDir, 'nodes.json'))).toBe(true);

      // Second load - should load from cache first, then sourceNodes runs again
      // (creating a second node since the plugin doesn't check for existing nodes)
      const store2 = new NodeStore();
      await loadPlugins([pluginDir], {
        appConfig: {},
        store: store2,
        cache: true,
        cacheDir: pluginDir,
      });

      // With caching, the first node is loaded from cache, then sourceNodes adds another
      expect(store2.getAll().length).toBeGreaterThanOrEqual(1);

      consoleLogSpy.mockRestore();

      // Cleanup cache directory
      rmSync(cacheDir, { recursive: true, force: true });
    });

    it('should restore indexes from cache', async () => {
      const pluginDir = join(pluginsDir, 'cached-indexed-plugin');
      const cacheDir = join(pluginDir, '.udl-cache');
      mkdirSync(pluginDir, { recursive: true });

      writeFileSync(
        join(pluginDir, 'udl.config.js'),
        `
        export const config = {
          name: 'cached-indexed-plugin',
          indexes: ['slug']
        };

        export async function sourceNodes({ actions, createNodeId }) {
          await actions.createNode({
            internal: {
              id: createNodeId('IndexedNode', '1'),
              type: 'IndexedNode',
            },
            parent: undefined,
            children: undefined,
            slug: 'test-slug',
          });
        }
        `
      );

      const { NodeStore } = await import('@/nodes/index.js');
      const consoleLogSpy = vi
        .spyOn(console, 'log')
        .mockImplementation(() => {});

      // First load to create cache
      const store1 = new NodeStore();
      await loadPlugins([pluginDir], {
        appConfig: {},
        store: store1,
        cache: true,
        cacheDir: pluginDir,
      });

      // Verify index was registered
      expect(store1.getRegisteredIndexes('IndexedNode')).toContain('slug');

      // Second load should restore indexes from cache
      const store2 = new NodeStore();
      await loadPlugins([pluginDir], {
        appConfig: {},
        store: store2,
        cache: true,
        cacheDir: pluginDir,
      });

      // The index should be restored and queryable
      const bySlug = store2.getByField('IndexedNode', 'slug', 'test-slug');
      expect(bySlug).toBeDefined();

      consoleLogSpy.mockRestore();

      // Cleanup
      rmSync(cacheDir, { recursive: true, force: true });
    });

    it('should not cache when plugin config has cache: false', async () => {
      const pluginDir = join(pluginsDir, 'no-cache-plugin');
      const cacheDir = join(pluginDir, '.udl-cache');
      mkdirSync(pluginDir, { recursive: true });

      writeFileSync(
        join(pluginDir, 'udl.config.js'),
        `
        export const config = {
          name: 'no-cache-plugin',
          cache: false // Explicitly disable caching
        };

        export async function sourceNodes({ actions, createNodeId }) {
          await actions.createNode({
            internal: {
              id: createNodeId('NoCacheNode', '1'),
              type: 'NoCacheNode',
            },
            parent: undefined,
            children: undefined,
          });
        }
        `
      );

      const { NodeStore } = await import('@/nodes/index.js');
      const consoleLogSpy = vi
        .spyOn(console, 'log')
        .mockImplementation(() => {});

      const store = new NodeStore();
      await loadPlugins([pluginDir], {
        appConfig: {},
        store,
        cache: true, // Global cache enabled, but plugin disables it
        cacheDir: pluginDir,
      });

      expect(store.getAll()).toHaveLength(1);

      // Cache directory should not be created since plugin has cache: false
      const { existsSync: fsExistsSync } = await import('node:fs');
      expect(fsExistsSync(cacheDir)).toBe(false);

      consoleLogSpy.mockRestore();
    });

    it('should use cacheDir from parent plugin for nested plugins', async () => {
      const parentPluginDir = join(pluginsDir, 'parent-cache-plugin');
      const childPluginDir = join(parentPluginDir, 'child-cache-plugin');
      mkdirSync(childPluginDir, { recursive: true });

      // Child plugin
      writeFileSync(
        join(childPluginDir, 'udl.config.js'),
        `
        export const config = {
          name: 'child-cache-plugin'
        };

        export async function sourceNodes({ actions, createNodeId, cacheDir }) {
          // Store the cacheDir for verification
          global.__childCacheDir = cacheDir;
          await actions.createNode({
            internal: {
              id: createNodeId('ChildCacheNode', '1'),
              type: 'ChildCacheNode',
            },
            parent: undefined,
            children: undefined,
          });
        }
        `
      );

      // Parent plugin with nested child
      writeFileSync(
        join(parentPluginDir, 'udl.config.js'),
        `
        export const config = {
          name: 'parent-cache-plugin',
          plugins: ['./child-cache-plugin']
        };
        `
      );

      const { NodeStore } = await import('@/nodes/index.js');
      const consoleLogSpy = vi
        .spyOn(console, 'log')
        .mockImplementation(() => {});

      const store = new NodeStore();
      await loadPlugins([parentPluginDir], {
        appConfig: {},
        store,
        cache: false, // Disable cache to avoid file creation
      });

      // The child plugin should receive the parent plugin path as its cacheDir
      expect(global.__childCacheDir).toBe(parentPluginDir);

      consoleLogSpy.mockRestore();

      // Cleanup
      delete global.__childCacheDir;
    });
  });
});
