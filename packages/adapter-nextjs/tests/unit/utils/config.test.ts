import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  COLORS,
  DEFAULT_NEXT_PORT,
  DEFAULT_UDL_PORT,
  UDL_ENDPOINT_ENV,
  loadPortFromConfig,
  buildUdlEndpoint,
  resolveUdlPort,
  createNextEnv,
} from '@/utils/config';

vi.mock('node:fs', () => ({
  existsSync: vi.fn(),
}));

describe('config utils', () => {
  describe('constants', () => {
    it('exports COLORS with correct ANSI codes', () => {
      expect(COLORS).toEqual({
        CYAN: '\x1b[36m',
        MAGENTA: '\x1b[35m',
        GREEN: '\x1b[32m',
        RESET: '\x1b[0m',
      });
    });

    it('exports DEFAULT_NEXT_PORT as 3000', () => {
      expect(DEFAULT_NEXT_PORT).toBe(3000);
    });

    it('exports DEFAULT_UDL_PORT as 4000', () => {
      expect(DEFAULT_UDL_PORT).toBe(4000);
    });

    it('exports UDL_ENDPOINT_ENV as "UDL_ENDPOINT"', () => {
      expect(UDL_ENDPOINT_ENV).toBe('UDL_ENDPOINT');
    });
  });

  describe('buildUdlEndpoint', () => {
    it('builds endpoint URL from port', () => {
      expect(buildUdlEndpoint(4000)).toBe('http://localhost:4000/graphql');
    });

    it('works with different ports', () => {
      expect(buildUdlEndpoint(5000)).toBe('http://localhost:5000/graphql');
    });
  });

  describe('createNextEnv', () => {
    it('creates env with UDL_ENDPOINT set', () => {
      const env = createNextEnv('http://localhost:4000/graphql');
      expect(env['UDL_ENDPOINT']).toBe('http://localhost:4000/graphql');
    });

    it('preserves existing environment variables', () => {
      const originalEnv = process.env;
      const testKey = '__TEST_VAR_CONFIG__';
      process.env[testKey] = 'test-value';

      try {
        const env = createNextEnv('http://localhost:4000/graphql');
        expect(env[testKey]).toBe('test-value');
      } finally {
        delete process.env[testKey];
        process.env = originalEnv;
      }
    });
  });

  describe('loadPortFromConfig', () => {
    const mockExistsSync = existsSync as ReturnType<typeof vi.fn>;

    beforeEach(() => {
      vi.resetModules();
      mockExistsSync.mockReset();
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('returns undefined when no config file exists', async () => {
      mockExistsSync.mockReturnValue(false);

      const port = await loadPortFromConfig();
      expect(port).toBeUndefined();
    });

    it('loads port from udl.config.ts file', async () => {
      const configPath = join(process.cwd(), 'udl.config.ts');
      mockExistsSync.mockImplementation((path) => path === configPath);

      // Mock tsx/esm/api
      vi.doMock('tsx/esm/api', () => ({
        register: () => vi.fn(), // returns unregister function
      }));

      // Mock dynamic import of config file
      const fileUrl = pathToFileURL(configPath).href;
      vi.doMock(fileUrl, () => ({
        config: { port: 5000 },
      }));

      const { loadPortFromConfig: loadFn } = await import('@/utils/config');
      const port = await loadFn();
      expect(port).toBe(5000);
    });

    it('loads port from udl.config.js file', async () => {
      const jsConfigPath = join(process.cwd(), 'udl.config.js');
      mockExistsSync.mockImplementation((path) => path === jsConfigPath);

      // Mock dynamic import of config file
      const fileUrl = pathToFileURL(jsConfigPath).href;
      vi.doMock(fileUrl, () => ({
        config: { port: 6000 },
      }));

      const { loadPortFromConfig: loadFn } = await import('@/utils/config');
      const port = await loadFn();
      expect(port).toBe(6000);
    });

    it('loads port from udl.config.mjs file', async () => {
      const mjsConfigPath = join(process.cwd(), 'udl.config.mjs');
      mockExistsSync.mockImplementation((path) => path === mjsConfigPath);

      // Mock dynamic import of config file
      const fileUrl = pathToFileURL(mjsConfigPath).href;
      vi.doMock(fileUrl, () => ({
        config: { port: 7000 },
      }));

      const { loadPortFromConfig: loadFn } = await import('@/utils/config');
      const port = await loadFn();
      expect(port).toBe(7000);
    });

    it('returns undefined when config has no port', async () => {
      const jsConfigPath = join(process.cwd(), 'udl.config.js');
      mockExistsSync.mockImplementation((path) => path === jsConfigPath);

      // Mock dynamic import of config file with no port
      const fileUrl = pathToFileURL(jsConfigPath).href;
      vi.doMock(fileUrl, () => ({
        config: {},
      }));

      const { loadPortFromConfig: loadFn } = await import('@/utils/config');
      const port = await loadFn();
      expect(port).toBeUndefined();
    });

    it('returns undefined when config is undefined', async () => {
      const jsConfigPath = join(process.cwd(), 'udl.config.js');
      mockExistsSync.mockImplementation((path) => path === jsConfigPath);

      // Mock dynamic import of config file with no config export
      const fileUrl = pathToFileURL(jsConfigPath).href;
      vi.doMock(fileUrl, () => ({}));

      const { loadPortFromConfig: loadFn } = await import('@/utils/config');
      const port = await loadFn();
      expect(port).toBeUndefined();
    });

    it('returns undefined when import throws an error', async () => {
      const jsConfigPath = join(process.cwd(), 'udl.config.js');
      mockExistsSync.mockImplementation((path) => path === jsConfigPath);

      // Mock dynamic import that throws
      const fileUrl = pathToFileURL(jsConfigPath).href;
      vi.doMock(fileUrl, () => {
        throw new Error('Module not found');
      });

      const { loadPortFromConfig: loadFn } = await import('@/utils/config');
      const port = await loadFn();
      expect(port).toBeUndefined();
    });

    it('returns undefined when tsx import throws an error', async () => {
      const tsConfigPath = join(process.cwd(), 'udl.config.ts');
      mockExistsSync.mockImplementation((path) => path === tsConfigPath);

      // Mock tsx/esm/api to throw
      vi.doMock('tsx/esm/api', () => {
        throw new Error('tsx not available');
      });

      const { loadPortFromConfig: loadFn } = await import('@/utils/config');
      const port = await loadFn();
      expect(port).toBeUndefined();
    });

    it('calls unregister after loading TS config', async () => {
      const tsConfigPath = join(process.cwd(), 'udl.config.ts');
      mockExistsSync.mockImplementation((path) => path === tsConfigPath);

      const unregisterMock = vi.fn();
      vi.doMock('tsx/esm/api', () => ({
        register: () => unregisterMock,
      }));

      const fileUrl = pathToFileURL(tsConfigPath).href;
      vi.doMock(fileUrl, () => ({
        config: { port: 5000 },
      }));

      const { loadPortFromConfig: loadFn } = await import('@/utils/config');
      await loadFn();
      expect(unregisterMock).toHaveBeenCalled();
    });

    it('calls unregister even when config import throws', async () => {
      const tsConfigPath = join(process.cwd(), 'udl.config.ts');
      mockExistsSync.mockImplementation((path) => path === tsConfigPath);

      const unregisterMock = vi.fn();
      vi.doMock('tsx/esm/api', () => ({
        register: () => unregisterMock,
      }));

      const fileUrl = pathToFileURL(tsConfigPath).href;
      vi.doMock(fileUrl, () => {
        throw new Error('Config parse error');
      });

      const { loadPortFromConfig: loadFn } = await import('@/utils/config');
      await loadFn();
      expect(unregisterMock).toHaveBeenCalled();
    });
  });

  describe('resolveUdlPort', () => {
    beforeEach(() => {
      vi.resetModules();
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('returns CLI port when provided', async () => {
      const port = await resolveUdlPort(5555);
      expect(port).toBe(5555);
    });

    it('returns config port when CLI port not provided', async () => {
      const mockExistsSync = existsSync as ReturnType<typeof vi.fn>;
      const jsConfigPath = join(process.cwd(), 'udl.config.js');
      mockExistsSync.mockImplementation((path) => path === jsConfigPath);

      const fileUrl = pathToFileURL(jsConfigPath).href;
      vi.doMock(fileUrl, () => ({
        config: { port: 6666 },
      }));

      const { resolveUdlPort: resolveFn } = await import('@/utils/config');
      const port = await resolveFn();
      expect(port).toBe(6666);
    });

    it('returns default port when neither CLI nor config port provided', async () => {
      const mockExistsSync = existsSync as ReturnType<typeof vi.fn>;
      mockExistsSync.mockReturnValue(false);

      const { resolveUdlPort: resolveFn } = await import('@/utils/config');
      const port = await resolveFn();
      expect(port).toBe(4000);
    });

    it('returns CLI port even when config has port', async () => {
      const mockExistsSync = existsSync as ReturnType<typeof vi.fn>;
      const jsConfigPath = join(process.cwd(), 'udl.config.js');
      mockExistsSync.mockImplementation((path) => path === jsConfigPath);

      const fileUrl = pathToFileURL(jsConfigPath).href;
      vi.doMock(fileUrl, () => ({
        config: { port: 6666 },
      }));

      // CLI port takes priority, so config should not be loaded
      const port = await resolveUdlPort(7777);
      expect(port).toBe(7777);
    });
  });
});
