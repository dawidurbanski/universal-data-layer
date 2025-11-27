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
    it('should return config object with config and onLoad', () => {
      const mockOnLoad = vi.fn();
      const result = defineConfig({
        config: {
          port: 3000,
          plugins: ['test-plugin'],
        },
        onLoad: mockOnLoad,
      });

      expect(result.config).toEqual({
        port: 3000,
        plugins: ['test-plugin'],
      });
      expect(result.onLoad).toBe(mockOnLoad);
    });

    it('should return config object without onLoad', () => {
      const result = defineConfig({
        config: {
          port: 4000,
          host: 'localhost',
        },
      });

      expect(result.config).toEqual({
        port: 4000,
        host: 'localhost',
      });
      expect(result.onLoad).toBeUndefined();
    });

    it('should preserve type information for typed options', () => {
      interface MyPluginOptions {
        apiKey: string;
        environment: 'dev' | 'prod';
      }

      const result = defineConfig<MyPluginOptions>({
        config: {
          plugins: ['my-plugin'],
        },
        onLoad: (context) => {
          // Type test - this should compile without errors
          const apiKey = context?.options?.apiKey;
          expect(apiKey).toBeUndefined(); // No context passed in this test
        },
      });

      expect(result.config).toEqual({
        plugins: ['my-plugin'],
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
  });
});
