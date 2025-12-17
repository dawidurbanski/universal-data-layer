import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock all dependencies before importing the module under test
vi.mock('@/loader.js', () => ({
  loadAppConfig: vi.fn(),
  loadPlugins: vi.fn(),
}));

vi.mock('@/handlers/graphql.js', () => ({
  rebuildHandler: vi.fn(),
}));

vi.mock('@/codegen.js', () => ({
  runCodegen: vi.fn(),
}));

vi.mock('@/nodes/defaultStore.js', () => ({
  defaultStore: {
    getAll: vi.fn(() => []),
    set: vi.fn(),
  },
}));

vi.mock('@/mocks/index.js', () => ({
  startMockServer: vi.fn(),
  stopMockServer: vi.fn(),
}));

vi.mock('@/features.js', () => ({
  loadManualTestConfigs: vi.fn(),
}));

// Import mocks for type-safe access
import { loadAppConfig, loadPlugins } from '@/loader.js';
import { rebuildHandler } from '@/handlers/graphql.js';
import { runCodegen } from '@/codegen.js';
import { startMockServer, stopMockServer } from '@/mocks/index.js';
import { loadManualTestConfigs } from '@/features.js';

// Import the function under test
import { runCodegenOnly } from '@/codegen-only.js';

describe('runCodegenOnly', () => {
  const mockLoadAppConfig = vi.mocked(loadAppConfig);
  const mockLoadPlugins = vi.mocked(loadPlugins);
  const mockRebuildHandler = vi.mocked(rebuildHandler);
  const mockRunCodegen = vi.mocked(runCodegen);
  const mockStartMockServer = vi.mocked(startMockServer);
  const mockStopMockServer = vi.mocked(stopMockServer);
  const mockLoadManualTestConfigs = vi.mocked(loadManualTestConfigs);

  // Store original values
  const originalEnv = { ...process.env };
  const originalCwd = process.cwd();
  const originalExit = process.exit;

  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock implementations
    mockLoadAppConfig.mockResolvedValue({});
    mockLoadPlugins.mockResolvedValue({ codegenConfigs: [] });
    mockRebuildHandler.mockResolvedValue(undefined);
    mockRunCodegen.mockResolvedValue(undefined);
    mockStartMockServer.mockResolvedValue(undefined);
    mockStopMockServer.mockReturnValue(undefined);
    mockLoadManualTestConfigs.mockResolvedValue([]);

    // Mock process.exit to prevent test from exiting
    process.exit = vi.fn() as never;

    // Mock console methods
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    // Restore original environment
    process.env = { ...originalEnv };
    process.exit = originalExit;
    vi.restoreAllMocks();
  });

  describe('basic execution flow', () => {
    it('should run codegen with default options', async () => {
      await runCodegenOnly();

      expect(mockLoadAppConfig).toHaveBeenCalledWith(originalCwd);
      expect(mockRebuildHandler).toHaveBeenCalled();
      expect(mockStopMockServer).toHaveBeenCalled();
    });

    it('should use custom configPath when provided', async () => {
      const customPath = '/custom/config/path';

      await runCodegenOnly({ configPath: customPath });

      expect(mockLoadAppConfig).toHaveBeenCalledWith(customPath);
    });

    it('should start mock server in non-production environment', async () => {
      process.env['NODE_ENV'] = 'development';

      await runCodegenOnly();

      expect(mockStartMockServer).toHaveBeenCalled();
    });

    it('should NOT start mock server in production environment', async () => {
      process.env['NODE_ENV'] = 'production';

      await runCodegenOnly();

      expect(mockStartMockServer).not.toHaveBeenCalled();
    });

    it('should always stop mock server after execution', async () => {
      await runCodegenOnly();

      expect(mockStopMockServer).toHaveBeenCalled();
    });
  });

  describe('plugin loading', () => {
    it('should load plugins when config has plugins array', async () => {
      const mockConfig = {
        plugins: [
          '@universal-data-layer/plugin-source-contentful',
          { name: './local-plugin', options: { key: 'value' } },
        ],
      };
      mockLoadAppConfig.mockResolvedValue(mockConfig);
      mockLoadPlugins.mockResolvedValue({ codegenConfigs: [] });

      await runCodegenOnly();

      expect(mockLoadPlugins).toHaveBeenCalledWith(mockConfig.plugins, {
        appConfig: mockConfig,
        store: expect.anything(),
      });
    });

    it('should NOT load plugins when plugins array is empty', async () => {
      mockLoadAppConfig.mockResolvedValue({ plugins: [] });

      await runCodegenOnly();

      expect(mockLoadPlugins).not.toHaveBeenCalled();
    });

    it('should NOT load plugins when plugins is undefined', async () => {
      mockLoadAppConfig.mockResolvedValue({});

      await runCodegenOnly();

      expect(mockLoadPlugins).not.toHaveBeenCalled();
    });

    it('should extract plugin names from string plugin specs', async () => {
      const mockConfig = {
        plugins: ['/path/to/my-plugin'],
        codegen: { output: './generated' },
      };
      mockLoadAppConfig.mockResolvedValue(mockConfig);
      mockLoadPlugins.mockResolvedValue({ codegenConfigs: [] });

      await runCodegenOnly();

      // Verify runCodegen was called with the plugin name extracted using basename
      expect(mockRunCodegen).toHaveBeenCalledWith(
        expect.objectContaining({
          owners: ['my-plugin'],
        })
      );
    });

    it('should extract plugin names from object plugin specs', async () => {
      const mockConfig = {
        plugins: [{ name: '/path/to/another-plugin', options: {} }],
        codegen: { output: './generated' },
      };
      mockLoadAppConfig.mockResolvedValue(mockConfig);
      mockLoadPlugins.mockResolvedValue({ codegenConfigs: [] });

      await runCodegenOnly();

      expect(mockRunCodegen).toHaveBeenCalledWith(
        expect.objectContaining({
          owners: ['another-plugin'],
        })
      );
    });

    it('should collect codegen configs from loaded plugins', async () => {
      const mockPluginCodegenConfig = {
        config: { output: './plugin-generated' },
        pluginPath: '/path/to/plugin',
        pluginName: 'test-plugin',
      };

      mockLoadAppConfig.mockResolvedValue({
        plugins: ['test-plugin'],
      });
      mockLoadPlugins.mockResolvedValue({
        codegenConfigs: [mockPluginCodegenConfig],
      });

      await runCodegenOnly();

      expect(mockRunCodegen).toHaveBeenCalledWith(
        expect.objectContaining({
          config: mockPluginCodegenConfig.config,
          basePath: mockPluginCodegenConfig.pluginPath,
          owners: [mockPluginCodegenConfig.pluginName],
        })
      );
    });
  });

  describe('codegen config handling', () => {
    it('should run codegen for main app config when codegen is defined', async () => {
      const mockCodegenConfig = { output: './app-generated' };
      mockLoadAppConfig.mockResolvedValue({
        codegen: mockCodegenConfig,
      });

      await runCodegenOnly({ configPath: '/app/path' });

      expect(mockRunCodegen).toHaveBeenCalledWith(
        expect.objectContaining({
          config: mockCodegenConfig,
          basePath: '/app/path',
          owners: [],
        })
      );
    });

    it('should NOT run codegen when no codegen config exists', async () => {
      mockLoadAppConfig.mockResolvedValue({});

      await runCodegenOnly();

      expect(mockRunCodegen).not.toHaveBeenCalled();
    });

    it('should collect codegen configs from multiple sources', async () => {
      const pluginCodegenConfig = {
        config: { output: './plugin-out' },
        pluginPath: '/plugin/path',
        pluginName: 'my-plugin',
      };
      const appCodegenConfig = { output: './app-out' };

      mockLoadAppConfig.mockResolvedValue({
        plugins: ['my-plugin'],
        codegen: appCodegenConfig,
      });
      mockLoadPlugins.mockResolvedValue({
        codegenConfigs: [pluginCodegenConfig],
      });

      await runCodegenOnly({ configPath: '/app' });

      // Should have 2 calls: one for plugin, one for app
      expect(mockRunCodegen).toHaveBeenCalledTimes(2);
    });
  });

  describe('manual test configs', () => {
    it('should load manual test configs when includeManualTests is true', async () => {
      process.env['NODE_ENV'] = 'development';

      await runCodegenOnly({ includeManualTests: true });

      expect(mockLoadManualTestConfigs).toHaveBeenCalled();
    });

    it('should NOT load manual test configs when includeManualTests is false', async () => {
      await runCodegenOnly({ includeManualTests: false });

      expect(mockLoadManualTestConfigs).not.toHaveBeenCalled();
    });

    it('should load manual test configs by default in non-production', async () => {
      process.env['NODE_ENV'] = 'development';

      await runCodegenOnly();

      expect(mockLoadManualTestConfigs).toHaveBeenCalled();
    });

    it('should NOT load manual test configs by default in production', async () => {
      process.env['NODE_ENV'] = 'production';

      await runCodegenOnly();

      expect(mockLoadManualTestConfigs).not.toHaveBeenCalled();
    });

    it('should include manual test codegen configs in codegen run', async () => {
      const featureCodegenConfig = {
        config: { output: './feature-generated' },
        basePath: '/feature/path',
        pluginNames: ['feature-plugin'],
      };
      mockLoadManualTestConfigs.mockResolvedValue([featureCodegenConfig]);

      await runCodegenOnly({ includeManualTests: true });

      expect(mockRunCodegen).toHaveBeenCalledWith(
        expect.objectContaining({
          config: featureCodegenConfig.config,
          basePath: featureCodegenConfig.basePath,
          owners: featureCodegenConfig.pluginNames,
        })
      );
    });
  });

  describe('success and error handling', () => {
    it('should log success message when all codegen runs succeed', async () => {
      mockLoadAppConfig.mockResolvedValue({
        codegen: { output: './out' },
      });
      mockRunCodegen.mockResolvedValue(undefined);

      await runCodegenOnly();

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Codegen completed successfully')
      );
      expect(process.exit).not.toHaveBeenCalled();
    });

    it('should log error and exit with code 1 when codegen fails', async () => {
      const error = new Error('Codegen failed');
      mockLoadAppConfig.mockResolvedValue({
        codegen: { output: './out' },
      });
      mockRunCodegen.mockRejectedValue(error);

      await runCodegenOnly();

      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('Codegen failed'),
        error
      );
      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('should count successful and failed codegen runs', async () => {
      const pluginCodegenConfigs = [
        {
          config: { output: './out1' },
          pluginPath: '/path1',
          pluginName: 'plugin1',
        },
        {
          config: { output: './out2' },
          pluginPath: '/path2',
          pluginName: 'plugin2',
        },
      ];

      mockLoadAppConfig.mockResolvedValue({
        plugins: ['plugin1', 'plugin2'],
      });
      mockLoadPlugins.mockResolvedValue({
        codegenConfigs: pluginCodegenConfigs,
      });

      // First succeeds, second fails
      mockRunCodegen
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('Failed'));

      await runCodegenOnly();

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('1 error(s), 1 success(es)')
      );
      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('should log info message when no codegen configs found', async () => {
      mockLoadAppConfig.mockResolvedValue({});

      await runCodegenOnly({ includeManualTests: false });

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('No codegen configs found')
      );
    });
  });

  describe('console output', () => {
    it('should log running codegen message at start', async () => {
      await runCodegenOnly();

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Running codegen')
      );
    });

    it('should log loading plugins message when plugins exist', async () => {
      mockLoadAppConfig.mockResolvedValue({
        plugins: ['test-plugin'],
      });
      mockLoadPlugins.mockResolvedValue({ codegenConfigs: [] });

      await runCodegenOnly();

      expect(console.log).toHaveBeenCalledWith('Loading plugins...');
    });

    it('should log building schema message', async () => {
      await runCodegenOnly();

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Building GraphQL schema')
      );
    });
  });
});
