/**
 * Tests for packages/core/src/features.ts
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { join } from 'node:path';
import type { Dirent } from 'node:fs';
import type { PluginSpec } from '@/loader.js';

// Mock dependencies before importing the module
vi.mock('node:fs', () => ({
  existsSync: vi.fn(),
  readdirSync: vi.fn(),
}));

vi.mock('@/loader.js', () => ({
  loadConfigFile: vi.fn(),
  loadPlugins: vi.fn(),
}));

vi.mock('@/nodes/defaultStore.js', () => ({
  defaultStore: {
    getAll: vi.fn(() => []),
    getTypes: vi.fn(() => []),
  },
}));

vi.mock('tsx/esm/api', () => ({
  register: vi.fn(() => vi.fn()),
}));

import { existsSync, readdirSync } from 'node:fs';
import { loadConfigFile, loadPlugins } from '@/loader.js';
import { setMockCredentials, loadManualTestConfigs } from '@/features.js';

/**
 * Helper to create mock Dirent objects
 */
function createMockDirent(name: string, isDir: boolean): Dirent {
  return {
    name,
    isDirectory: () => isDir,
    isFile: () => !isDir,
    isBlockDevice: () => false,
    isCharacterDevice: () => false,
    isSymbolicLink: () => false,
    isFIFO: () => false,
    isSocket: () => false,
    parentPath: '',
  } as Dirent;
}

describe('features.ts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Clear environment variables
    delete process.env['CONTENTFUL_SPACE_ID'];
    delete process.env['CONTENTFUL_ACCESS_TOKEN'];
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('setMockCredentials', () => {
    it('should set mock credentials when not already set', () => {
      setMockCredentials();

      expect(process.env['CONTENTFUL_SPACE_ID']).toBe('mock-space-id');
      expect(process.env['CONTENTFUL_ACCESS_TOKEN']).toBe('mock-access-token');
    });

    it('should not override existing CONTENTFUL_SPACE_ID', () => {
      process.env['CONTENTFUL_SPACE_ID'] = 'existing-space-id';

      setMockCredentials();

      expect(process.env['CONTENTFUL_SPACE_ID']).toBe('existing-space-id');
      expect(process.env['CONTENTFUL_ACCESS_TOKEN']).toBe('mock-access-token');
    });

    it('should not override existing CONTENTFUL_ACCESS_TOKEN', () => {
      process.env['CONTENTFUL_ACCESS_TOKEN'] = 'existing-token';

      setMockCredentials();

      expect(process.env['CONTENTFUL_SPACE_ID']).toBe('mock-space-id');
      expect(process.env['CONTENTFUL_ACCESS_TOKEN']).toBe('existing-token');
    });

    it('should not override either credential when both are set', () => {
      process.env['CONTENTFUL_SPACE_ID'] = 'existing-space-id';
      process.env['CONTENTFUL_ACCESS_TOKEN'] = 'existing-token';

      setMockCredentials();

      expect(process.env['CONTENTFUL_SPACE_ID']).toBe('existing-space-id');
      expect(process.env['CONTENTFUL_ACCESS_TOKEN']).toBe('existing-token');
    });
  });

  describe('loadManualTestConfigs', () => {
    const mockRootDir = '/packages/core';

    describe('getFeatureDirectories (internal)', () => {
      it('should return empty array when no feature directories exist', async () => {
        vi.mocked(existsSync).mockReturnValue(false);

        const result = await loadManualTestConfigs(mockRootDir);

        expect(result).toEqual([]);
      });

      it('should include core features directory when it exists', async () => {
        vi.mocked(existsSync).mockImplementation((path) => {
          return path === join(mockRootDir, 'tests', 'manual', 'features');
        });
        vi.mocked(readdirSync).mockReturnValue([]);

        const result = await loadManualTestConfigs(mockRootDir);

        expect(result).toEqual([]);
        expect(readdirSync).toHaveBeenCalledWith(
          join(mockRootDir, 'tests', 'manual', 'features'),
          { withFileTypes: true }
        );
      });

      it('should scan sibling plugin packages for features', async () => {
        const packagesDir = '/packages';
        vi.mocked(existsSync).mockImplementation((path) => {
          if (path === join(mockRootDir, 'tests', 'manual', 'features'))
            return true;
          if (path === packagesDir) return true;
          if (
            path ===
            join(
              packagesDir,
              'plugin-source-contentful',
              'tests',
              'manual',
              'features'
            )
          )
            return true;
          return false;
        });

        vi.mocked(readdirSync).mockImplementation(((path: string) => {
          if (path === packagesDir) {
            return [
              createMockDirent('core', true),
              createMockDirent('plugin-source-contentful', true),
              createMockDirent('somefile.txt', false),
            ];
          }
          return [];
        }) as unknown as typeof readdirSync);

        const result = await loadManualTestConfigs(mockRootDir);

        expect(result).toEqual([]);
      });

      it('should handle errors when scanning packages directory', async () => {
        vi.mocked(existsSync).mockImplementation((path) => {
          if (path === join(mockRootDir, 'tests', 'manual', 'features'))
            return true;
          if (path === '/packages') return true;
          return false;
        });

        vi.mocked(readdirSync).mockImplementation(((path: string) => {
          if (path === '/packages') {
            throw new Error('Permission denied');
          }
          return [];
        }) as unknown as typeof readdirSync);

        // Should not throw
        const result = await loadManualTestConfigs(mockRootDir);
        expect(result).toEqual([]);
      });
    });

    describe('loadFeature (internal)', () => {
      it('should skip features without config files', async () => {
        vi.mocked(existsSync).mockImplementation((path) => {
          if (path === join(mockRootDir, 'tests', 'manual', 'features'))
            return true;
          if (path === '/packages') return false;
          return false;
        });

        vi.mocked(readdirSync).mockReturnValue([
          createMockDirent('test-feature', true),
        ] as unknown as ReturnType<typeof readdirSync>);

        const result = await loadManualTestConfigs(mockRootDir);

        expect(result).toEqual([]);
      });

      it('should load TypeScript config files with tsx', async () => {
        const featurePath = join(
          mockRootDir,
          'tests',
          'manual',
          'features',
          'test-feature'
        );
        const tsConfigPath = join(featurePath, 'udl.config.ts');

        vi.mocked(existsSync).mockImplementation((path) => {
          if (path === join(mockRootDir, 'tests', 'manual', 'features'))
            return true;
          if (path === '/packages') return false;
          if (path === tsConfigPath) return true;
          return false;
        });

        vi.mocked(readdirSync).mockReturnValue([
          createMockDirent('test-feature', true),
        ] as unknown as ReturnType<typeof readdirSync>);

        vi.mocked(loadConfigFile).mockResolvedValue({
          plugins: [],
        });

        const consoleSpy = vi
          .spyOn(console, 'log')
          .mockImplementation(() => {});

        const result = await loadManualTestConfigs(mockRootDir);

        expect(result).toEqual([]);
        expect(consoleSpy).toHaveBeenCalledWith(
          '📦 Loading config from feature: test-feature'
        );
      });

      it('should load JavaScript config files directly', async () => {
        const featurePath = join(
          mockRootDir,
          'tests',
          'manual',
          'features',
          'test-feature'
        );
        const jsConfigPath = join(featurePath, 'udl.config.js');

        vi.mocked(existsSync).mockImplementation((path) => {
          if (path === join(mockRootDir, 'tests', 'manual', 'features'))
            return true;
          if (path === '/packages') return false;
          if (path === jsConfigPath) return true;
          return false;
        });

        vi.mocked(readdirSync).mockReturnValue([
          createMockDirent('test-feature', true),
        ] as unknown as ReturnType<typeof readdirSync>);

        vi.mocked(loadConfigFile).mockResolvedValue({
          plugins: [],
        });

        vi.spyOn(console, 'log').mockImplementation(() => {});

        const result = await loadManualTestConfigs(mockRootDir);

        expect(result).toEqual([]);
        expect(loadConfigFile).toHaveBeenCalled();
      });

      it('should call loadEnv when provided', async () => {
        const featurePath = join(
          mockRootDir,
          'tests',
          'manual',
          'features',
          'test-feature'
        );
        const tsConfigPath = join(featurePath, 'udl.config.ts');

        vi.mocked(existsSync).mockImplementation((path) => {
          if (path === join(mockRootDir, 'tests', 'manual', 'features'))
            return true;
          if (path === '/packages') return false;
          if (path === tsConfigPath) return true;
          return false;
        });

        vi.mocked(readdirSync).mockReturnValue([
          createMockDirent('test-feature', true),
        ] as unknown as ReturnType<typeof readdirSync>);

        vi.mocked(loadConfigFile).mockResolvedValue({
          plugins: [],
        });

        const loadEnv = vi.fn();
        vi.spyOn(console, 'log').mockImplementation(() => {});

        await loadManualTestConfigs(mockRootDir, { loadEnv });

        expect(loadEnv).toHaveBeenCalledWith({ cwd: featurePath });
      });

      it('should load plugins with resolved relative paths (string plugins)', async () => {
        const featurePath = join(
          mockRootDir,
          'tests',
          'manual',
          'features',
          'test-feature'
        );
        const tsConfigPath = join(featurePath, 'udl.config.ts');

        vi.mocked(existsSync).mockImplementation((path) => {
          if (path === join(mockRootDir, 'tests', 'manual', 'features'))
            return true;
          if (path === '/packages') return false;
          if (path === tsConfigPath) return true;
          return false;
        });

        vi.mocked(readdirSync).mockReturnValue([
          createMockDirent('test-feature', true),
        ] as unknown as ReturnType<typeof readdirSync>);

        vi.mocked(loadConfigFile).mockResolvedValue({
          plugins: [
            './local-plugin',
            '../sibling-plugin',
            '@universal-data-layer/external-plugin',
          ],
        });

        vi.mocked(loadPlugins).mockResolvedValue({
          codegenConfigs: [
            {
              config: { output: './generated' },
              pluginPath: '/some/path',
              pluginName: 'local-plugin',
            },
          ],
        });

        vi.spyOn(console, 'log').mockImplementation(() => {});

        const result = await loadManualTestConfigs(mockRootDir);

        expect(loadPlugins).toHaveBeenCalled();
        const loadPluginsCall = vi.mocked(loadPlugins).mock.calls[0]!;
        const resolvedPlugins = loadPluginsCall[0] as PluginSpec[];

        // Relative paths should be resolved
        expect(resolvedPlugins[0]).toContain('local-plugin');
        expect(resolvedPlugins[1]).toContain('sibling-plugin');
        // External plugins should remain unchanged
        expect(resolvedPlugins[2]).toBe(
          '@universal-data-layer/external-plugin'
        );

        // Should include codegen config from plugins
        expect(result).toHaveLength(1);
        expect(result[0]!.pluginNames).toEqual(['local-plugin']);
      });

      it('should load plugins with resolved relative paths (object plugins)', async () => {
        const featurePath = join(
          mockRootDir,
          'tests',
          'manual',
          'features',
          'test-feature'
        );
        const tsConfigPath = join(featurePath, 'udl.config.ts');

        vi.mocked(existsSync).mockImplementation((path) => {
          if (path === join(mockRootDir, 'tests', 'manual', 'features'))
            return true;
          if (path === '/packages') return false;
          if (path === tsConfigPath) return true;
          return false;
        });

        vi.mocked(readdirSync).mockReturnValue([
          createMockDirent('test-feature', true),
        ] as unknown as ReturnType<typeof readdirSync>);

        vi.mocked(loadConfigFile).mockResolvedValue({
          plugins: [
            { name: './local-plugin', options: { key: 'value' } },
            { name: '@universal-data-layer/external-plugin', options: {} },
          ],
        });

        vi.mocked(loadPlugins).mockResolvedValue({
          codegenConfigs: [],
        });

        vi.spyOn(console, 'log').mockImplementation(() => {});

        await loadManualTestConfigs(mockRootDir);

        expect(loadPlugins).toHaveBeenCalled();
        const loadPluginsCall = vi.mocked(loadPlugins).mock.calls[0]!;
        const resolvedPlugins = loadPluginsCall[0] as PluginSpec[];

        // Relative path in object should be resolved
        const firstPlugin = resolvedPlugins[0] as {
          name: string;
          options: Record<string, unknown>;
        };
        const secondPlugin = resolvedPlugins[1] as { name: string };
        expect(firstPlugin.name).toContain('local-plugin');
        expect(firstPlugin.options).toEqual({ key: 'value' });
        // External plugin should remain unchanged
        expect(secondPlugin.name).toBe('@universal-data-layer/external-plugin');
      });

      it('should respect cache settings', async () => {
        const featurePath = join(
          mockRootDir,
          'tests',
          'manual',
          'features',
          'test-feature'
        );
        const tsConfigPath = join(featurePath, 'udl.config.ts');

        vi.mocked(existsSync).mockImplementation((path) => {
          if (path === join(mockRootDir, 'tests', 'manual', 'features'))
            return true;
          if (path === '/packages') return false;
          if (path === tsConfigPath) return true;
          return false;
        });

        vi.mocked(readdirSync).mockReturnValue([
          createMockDirent('test-feature', true),
        ] as unknown as ReturnType<typeof readdirSync>);

        vi.mocked(loadConfigFile).mockResolvedValue({
          plugins: ['test-plugin'],
          cache: false,
        });

        vi.mocked(loadPlugins).mockResolvedValue({
          codegenConfigs: [],
        });

        vi.spyOn(console, 'log').mockImplementation(() => {});

        await loadManualTestConfigs(mockRootDir, { cache: true });

        const loadPluginsCall = vi.mocked(loadPlugins).mock.calls[0]!;
        // cache should be false because feature config has cache: false
        expect(loadPluginsCall[1]?.cache).toBe(false);
      });

      it('should use provided cacheDir', async () => {
        const featurePath = join(
          mockRootDir,
          'tests',
          'manual',
          'features',
          'test-feature'
        );
        const tsConfigPath = join(featurePath, 'udl.config.ts');

        vi.mocked(existsSync).mockImplementation((path) => {
          if (path === join(mockRootDir, 'tests', 'manual', 'features'))
            return true;
          if (path === '/packages') return false;
          if (path === tsConfigPath) return true;
          return false;
        });

        vi.mocked(readdirSync).mockReturnValue([
          createMockDirent('test-feature', true),
        ] as unknown as ReturnType<typeof readdirSync>);

        vi.mocked(loadConfigFile).mockResolvedValue({
          plugins: ['test-plugin'],
        });

        vi.mocked(loadPlugins).mockResolvedValue({
          codegenConfigs: [],
        });

        vi.spyOn(console, 'log').mockImplementation(() => {});

        await loadManualTestConfigs(mockRootDir, { cacheDir: '/custom/cache' });

        const loadPluginsCall = vi.mocked(loadPlugins).mock.calls[0]!;
        expect(loadPluginsCall[1]?.cacheDir).toBe('/custom/cache');
      });

      it('should include feature-level codegen config when present', async () => {
        const featurePath = join(
          mockRootDir,
          'tests',
          'manual',
          'features',
          'test-feature'
        );
        const tsConfigPath = join(featurePath, 'udl.config.ts');

        vi.mocked(existsSync).mockImplementation((path) => {
          if (path === join(mockRootDir, 'tests', 'manual', 'features'))
            return true;
          if (path === '/packages') return false;
          if (path === tsConfigPath) return true;
          return false;
        });

        vi.mocked(readdirSync).mockReturnValue([
          createMockDirent('test-feature', true),
        ] as unknown as ReturnType<typeof readdirSync>);

        vi.mocked(loadConfigFile).mockResolvedValue({
          plugins: ['./my-plugin'],
          codegen: {
            output: './generated',
            guards: true,
          },
        });

        vi.mocked(loadPlugins).mockResolvedValue({
          codegenConfigs: [],
        });

        vi.spyOn(console, 'log').mockImplementation(() => {});

        const result = await loadManualTestConfigs(mockRootDir);

        expect(result).toHaveLength(1);
        expect(result[0]!.config).toEqual({
          output: './generated',
          guards: true,
        });
        expect(result[0]!.basePath).toBe(featurePath);
        expect(result[0]!.pluginNames).toEqual(['my-plugin']);
      });

      it('should handle feature loading errors gracefully', async () => {
        const featurePath = join(
          mockRootDir,
          'tests',
          'manual',
          'features',
          'test-feature'
        );
        const tsConfigPath = join(featurePath, 'udl.config.ts');

        vi.mocked(existsSync).mockImplementation((path) => {
          if (path === join(mockRootDir, 'tests', 'manual', 'features'))
            return true;
          if (path === '/packages') return false;
          if (path === tsConfigPath) return true;
          return false;
        });

        vi.mocked(readdirSync).mockReturnValue([
          createMockDirent('test-feature', true),
        ] as unknown as ReturnType<typeof readdirSync>);

        vi.mocked(loadConfigFile).mockRejectedValue(
          new Error('Config load failed')
        );

        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        vi.spyOn(console, 'log').mockImplementation(() => {});

        const result = await loadManualTestConfigs(mockRootDir);

        expect(result).toEqual([]);
        expect(warnSpy).toHaveBeenCalledWith(
          'Failed to load config for feature test-feature:',
          expect.any(Error)
        );
      });

      it('should handle feature directory scan errors gracefully', async () => {
        vi.mocked(existsSync).mockImplementation((path) => {
          if (path === join(mockRootDir, 'tests', 'manual', 'features'))
            return true;
          if (path === '/packages') return false;
          return false;
        });

        vi.mocked(readdirSync).mockImplementation((() => {
          throw new Error('Directory scan failed');
        }) as unknown as typeof readdirSync);

        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        const result = await loadManualTestConfigs(mockRootDir);

        expect(result).toEqual([]);
        expect(warnSpy).toHaveBeenCalledWith(
          'Failed to scan manual test features:',
          expect.any(Error)
        );
      });

      it('should skip non-directory entries in features directory', async () => {
        vi.mocked(existsSync).mockImplementation((path) => {
          if (path === join(mockRootDir, 'tests', 'manual', 'features'))
            return true;
          if (path === '/packages') return false;
          return false;
        });

        vi.mocked(readdirSync).mockReturnValue([
          createMockDirent('some-file.txt', false),
          createMockDirent('.gitignore', false),
        ] as unknown as ReturnType<typeof readdirSync>);

        const result = await loadManualTestConfigs(mockRootDir);

        expect(result).toEqual([]);
        expect(loadConfigFile).not.toHaveBeenCalled();
      });
    });

    describe('edge cases', () => {
      it('should handle config with empty plugins array', async () => {
        const featurePath = join(
          mockRootDir,
          'tests',
          'manual',
          'features',
          'test-feature'
        );
        const tsConfigPath = join(featurePath, 'udl.config.ts');

        vi.mocked(existsSync).mockImplementation((path) => {
          if (path === join(mockRootDir, 'tests', 'manual', 'features'))
            return true;
          if (path === '/packages') return false;
          if (path === tsConfigPath) return true;
          return false;
        });

        vi.mocked(readdirSync).mockReturnValue([
          createMockDirent('test-feature', true),
        ] as unknown as ReturnType<typeof readdirSync>);

        vi.mocked(loadConfigFile).mockResolvedValue({
          plugins: [],
        });

        vi.spyOn(console, 'log').mockImplementation(() => {});

        const result = await loadManualTestConfigs(mockRootDir);

        expect(result).toEqual([]);
        expect(loadPlugins).not.toHaveBeenCalled();
      });

      it('should handle config with no plugins property', async () => {
        const featurePath = join(
          mockRootDir,
          'tests',
          'manual',
          'features',
          'test-feature'
        );
        const tsConfigPath = join(featurePath, 'udl.config.ts');

        vi.mocked(existsSync).mockImplementation((path) => {
          if (path === join(mockRootDir, 'tests', 'manual', 'features'))
            return true;
          if (path === '/packages') return false;
          if (path === tsConfigPath) return true;
          return false;
        });

        vi.mocked(readdirSync).mockReturnValue([
          createMockDirent('test-feature', true),
        ] as unknown as ReturnType<typeof readdirSync>);

        vi.mocked(loadConfigFile).mockResolvedValue({});

        vi.spyOn(console, 'log').mockImplementation(() => {});

        const result = await loadManualTestConfigs(mockRootDir);

        expect(result).toEqual([]);
        expect(loadPlugins).not.toHaveBeenCalled();
      });

      it('should handle loadConfigFile returning null', async () => {
        const featurePath = join(
          mockRootDir,
          'tests',
          'manual',
          'features',
          'test-feature'
        );
        const tsConfigPath = join(featurePath, 'udl.config.ts');

        vi.mocked(existsSync).mockImplementation((path) => {
          if (path === join(mockRootDir, 'tests', 'manual', 'features'))
            return true;
          if (path === '/packages') return false;
          if (path === tsConfigPath) return true;
          return false;
        });

        vi.mocked(readdirSync).mockReturnValue([
          createMockDirent('test-feature', true),
        ] as unknown as ReturnType<typeof readdirSync>);

        vi.mocked(loadConfigFile).mockResolvedValue(null);

        vi.spyOn(console, 'log').mockImplementation(() => {});

        const result = await loadManualTestConfigs(mockRootDir);

        expect(result).toEqual([]);
      });

      it('should process multiple features from multiple directories', async () => {
        vi.mocked(existsSync).mockImplementation((path) => {
          if (path === join(mockRootDir, 'tests', 'manual', 'features'))
            return true;
          if (path === '/packages') return true;
          if (
            path ===
            join('/packages', 'plugin-a', 'tests', 'manual', 'features')
          )
            return true;
          if (typeof path === 'string' && path.endsWith('udl.config.ts'))
            return true;
          return false;
        });

        vi.mocked(readdirSync).mockImplementation(((path: string) => {
          if (path === '/packages') {
            return [
              createMockDirent('core', true),
              createMockDirent('plugin-a', true),
            ];
          }
          if (path === join(mockRootDir, 'tests', 'manual', 'features')) {
            return [createMockDirent('feature-1', true)];
          }
          if (
            path ===
            join('/packages', 'plugin-a', 'tests', 'manual', 'features')
          ) {
            return [createMockDirent('feature-2', true)];
          }
          return [];
        }) as unknown as typeof readdirSync);

        vi.mocked(loadConfigFile).mockResolvedValue({
          codegen: { output: './generated' },
        });

        vi.spyOn(console, 'log').mockImplementation(() => {});

        const result = await loadManualTestConfigs(mockRootDir);

        // Two features, each with codegen config
        expect(result).toHaveLength(2);
      });

      it('should default options.cache to true', async () => {
        const featurePath = join(
          mockRootDir,
          'tests',
          'manual',
          'features',
          'test-feature'
        );
        const tsConfigPath = join(featurePath, 'udl.config.ts');

        vi.mocked(existsSync).mockImplementation((path) => {
          if (path === join(mockRootDir, 'tests', 'manual', 'features'))
            return true;
          if (path === '/packages') return false;
          if (path === tsConfigPath) return true;
          return false;
        });

        vi.mocked(readdirSync).mockReturnValue([
          createMockDirent('test-feature', true),
        ] as unknown as ReturnType<typeof readdirSync>);

        vi.mocked(loadConfigFile).mockResolvedValue({
          plugins: ['test-plugin'],
        });

        vi.mocked(loadPlugins).mockResolvedValue({
          codegenConfigs: [],
        });

        vi.spyOn(console, 'log').mockImplementation(() => {});

        // Call without options
        await loadManualTestConfigs(mockRootDir);

        const loadPluginsCall = vi.mocked(loadPlugins).mock.calls[0]!;
        // cache should be true by default
        expect(loadPluginsCall[1]?.cache).toBe(true);
      });
    });
  });
});
