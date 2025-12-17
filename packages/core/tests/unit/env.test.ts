import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { existsSync } from 'node:fs';
import { config as dotenvConfig, type DotenvConfigOutput } from 'dotenv';
import { loadEnv } from '@/env.js';

vi.mock('node:fs', () => ({
  existsSync: vi.fn(),
}));

vi.mock('dotenv', () => ({
  config: vi.fn(),
}));

function createDotenvError(message: string): DotenvConfigOutput {
  return { error: new Error(message) } as DotenvConfigOutput;
}

describe('loadEnv', () => {
  const mockExistsSync = vi.mocked(existsSync);
  const mockDotenvConfig = vi.mocked(dotenvConfig);
  const originalEnv = process.env;
  const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

  beforeEach(() => {
    vi.resetAllMocks();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('uses process.cwd() as default cwd', () => {
    const cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue('/default/cwd');
    mockExistsSync.mockReturnValue(false);

    loadEnv();

    // Vitest sets NODE_ENV=test, so it checks for .env.test.local first
    expect(mockExistsSync).toHaveBeenCalledWith('/default/cwd/.env.test.local');
    cwdSpy.mockRestore();
  });

  it('uses provided cwd option', () => {
    mockExistsSync.mockReturnValue(false);

    loadEnv({ cwd: '/custom/path' });

    // Vitest sets NODE_ENV=test
    expect(mockExistsSync).toHaveBeenCalledWith('/custom/path/.env.test.local');
  });

  it('uses NODE_ENV for env file names', () => {
    process.env['NODE_ENV'] = 'production';
    mockExistsSync.mockReturnValue(false);

    loadEnv({ cwd: '/test' });

    expect(mockExistsSync).toHaveBeenCalledWith('/test/.env.production.local');
    expect(mockExistsSync).toHaveBeenCalledWith('/test/.env.local');
    expect(mockExistsSync).toHaveBeenCalledWith('/test/.env.production');
    expect(mockExistsSync).toHaveBeenCalledWith('/test/.env');
  });

  it('defaults NODE_ENV to development when not set', () => {
    delete process.env['NODE_ENV'];
    mockExistsSync.mockReturnValue(false);

    loadEnv({ cwd: '/test' });

    expect(mockExistsSync).toHaveBeenCalledWith('/test/.env.development.local');
  });

  it('loads first existing .env file in priority order', () => {
    mockExistsSync.mockImplementation((path) => {
      return path === '/test/.env.local';
    });
    mockDotenvConfig.mockReturnValue({ parsed: {} });

    const result = loadEnv({ cwd: '/test' });

    expect(result).toEqual({ loaded: true, path: '/test/.env.local' });
    expect(mockDotenvConfig).toHaveBeenCalledWith({
      path: '/test/.env.local',
      override: false,
    });
    expect(consoleSpy).toHaveBeenCalledWith(
      '📄 Loaded environment from .env.local'
    );
  });

  it('passes override option to dotenv', () => {
    mockExistsSync.mockImplementation((path) => path === '/test/.env');
    mockDotenvConfig.mockReturnValue({ parsed: {} });

    loadEnv({ cwd: '/test', override: true });

    expect(mockDotenvConfig).toHaveBeenCalledWith({
      path: '/test/.env',
      override: true,
    });
  });

  it('returns loaded: false when no .env files exist', () => {
    mockExistsSync.mockReturnValue(false);

    const result = loadEnv({ cwd: '/test' });

    expect(result).toEqual({ loaded: false });
  });

  it('skips file if dotenv returns an error and tries next file', () => {
    // Vitest sets NODE_ENV=test, so first file is .env.test.local
    mockExistsSync.mockImplementation((path) => {
      return path === '/test/.env.test.local' || path === '/test/.env';
    });
    mockDotenvConfig
      .mockReturnValueOnce(createDotenvError('Failed to parse'))
      .mockReturnValueOnce({ parsed: {} });

    const result = loadEnv({ cwd: '/test' });

    expect(result).toEqual({ loaded: true, path: '/test/.env' });
    expect(mockDotenvConfig).toHaveBeenCalledTimes(2);
    expect(consoleSpy).toHaveBeenCalledWith('📄 Loaded environment from .env');
  });

  it('returns loaded: false when all existing files have errors', () => {
    mockExistsSync.mockReturnValue(true);
    mockDotenvConfig.mockReturnValue(createDotenvError('Parse error'));

    const result = loadEnv({ cwd: '/test' });

    expect(result).toEqual({ loaded: false });
    expect(mockDotenvConfig).toHaveBeenCalledTimes(4);
  });

  it('checks files in correct priority order', () => {
    process.env['NODE_ENV'] = 'test';
    mockExistsSync.mockReturnValue(false);

    loadEnv({ cwd: '/project' });

    const calls = mockExistsSync.mock.calls.map((call) => call[0]);
    expect(calls).toEqual([
      '/project/.env.test.local',
      '/project/.env.local',
      '/project/.env.test',
      '/project/.env',
    ]);
  });

  it('stops checking after successfully loading a file', () => {
    // Vitest sets NODE_ENV=test, so first file is .env.test.local
    mockExistsSync.mockImplementation((path) => {
      return path === '/test/.env.test.local';
    });
    mockDotenvConfig.mockReturnValue({ parsed: {} });

    loadEnv({ cwd: '/test' });

    expect(mockDotenvConfig).toHaveBeenCalledTimes(1);
    expect(mockExistsSync).toHaveBeenCalledTimes(1);
  });
});
