import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { runBuild } from '@/commands/build.js';
import * as spawnModule from '@/utils/spawn.js';
import { EventEmitter } from 'node:events';
import type { ChildProcess } from 'node:child_process';

// Mock the spawn module
vi.mock('@/utils/spawn.js', () => ({
  spawnWithPrefix: vi.fn(),
  killAll: vi.fn().mockResolvedValue(undefined),
}));

// Mock wait-for-ready module - but make it available for import
vi.mock('@/utils/wait-for-ready.js', async (importOriginal) => {
  const original =
    await importOriginal<typeof import('@/utils/wait-for-ready.js')>();
  return {
    ...original,
    waitForServer: vi.fn().mockResolvedValue(undefined),
  };
});

const mockSpawnWithPrefix = vi.mocked(spawnModule.spawnWithPrefix);
const mockKillAll = vi.mocked(spawnModule.killAll);

/**
 * Creates a mock ChildProcess for testing.
 */
function createMockProcess(exitCode: number = 0): ChildProcess {
  const emitter = new EventEmitter();

  Object.defineProperty(emitter, 'exitCode', {
    value: null,
    writable: true,
    configurable: true,
  });
  Object.defineProperty(emitter, 'killed', {
    value: false,
    writable: true,
    configurable: true,
  });
  Object.defineProperty(emitter, 'pid', {
    value: 1234,
    writable: true,
    configurable: true,
  });

  (emitter as ChildProcess).kill = vi.fn();

  // Auto-emit exit after a tick
  setImmediate(() => {
    emitter.emit('exit', exitCode, null);
  });

  return emitter as ChildProcess;
}

describe('runBuild', () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let exitCode: number | null;

  const mockExit = ((code: number): never => {
    exitCode = code;
    return undefined as never;
  }) as (code: number) => never;

  const mockWaitForServer = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    vi.clearAllMocks();
    exitCode = null;
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Default: all processes exit successfully
    mockSpawnWithPrefix.mockImplementation(() => ({
      process: createMockProcess(0),
      name: 'npx',
      prefix: '[test]',
    }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should spawn UDL server with default port', async () => {
    await runBuild({}, [], {
      exit: mockExit,
      waitForServer: mockWaitForServer,
    });

    expect(mockSpawnWithPrefix).toHaveBeenCalledWith(
      'npx',
      ['universal-data-layer', '--port', '4000'],
      expect.stringContaining('[udl]')
    );
  });

  it('should spawn UDL server with custom port', async () => {
    await runBuild({ port: 5000 }, [], {
      exit: mockExit,
      waitForServer: mockWaitForServer,
    });

    expect(mockSpawnWithPrefix).toHaveBeenCalledWith(
      'npx',
      ['universal-data-layer', '--port', '5000'],
      expect.stringContaining('[udl]')
    );
  });

  it('should wait for UDL server to be ready', async () => {
    await runBuild({ port: 5000 }, [], {
      exit: mockExit,
      waitForServer: mockWaitForServer,
    });

    expect(mockWaitForServer).toHaveBeenCalledWith(5000);
  });

  it('should run codegen after UDL is ready', async () => {
    await runBuild({}, [], {
      exit: mockExit,
      waitForServer: mockWaitForServer,
    });

    expect(mockSpawnWithPrefix).toHaveBeenCalledWith(
      'npx',
      ['udl-codegen'],
      expect.stringContaining('[codegen]')
    );
  });

  it('should run next build after codegen', async () => {
    await runBuild({}, [], {
      exit: mockExit,
      waitForServer: mockWaitForServer,
    });

    expect(mockSpawnWithPrefix).toHaveBeenCalledWith(
      'npx',
      ['next', 'build'],
      expect.stringContaining('[next]')
    );
  });

  it('should pass extra args to next build', async () => {
    await runBuild({}, ['--debug'], {
      exit: mockExit,
      waitForServer: mockWaitForServer,
    });

    expect(mockSpawnWithPrefix).toHaveBeenCalledWith(
      'npx',
      ['next', 'build', '--debug'],
      expect.stringContaining('[next]')
    );
  });

  it('should cleanup and exit with 0 on success', async () => {
    await runBuild({}, [], {
      exit: mockExit,
      waitForServer: mockWaitForServer,
    });

    expect(mockKillAll).toHaveBeenCalled();
    expect(exitCode).toBe(0);
  });

  it('should exit with codegen exit code on codegen failure', async () => {
    let callCount = 0;
    mockSpawnWithPrefix.mockImplementation(() => {
      callCount++;
      // First call is UDL (stays running), second is codegen (fails)
      const code = callCount === 2 ? 2 : 0;
      return {
        process: createMockProcess(code),
        name: 'npx',
        prefix: '[test]',
      };
    });

    await runBuild({}, [], {
      exit: mockExit,
      waitForServer: mockWaitForServer,
    });

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Codegen failed with exit code 2')
    );
    expect(mockKillAll).toHaveBeenCalled();
    expect(exitCode).toBe(2);
  });

  it('should exit with next build exit code on build failure', async () => {
    let callCount = 0;
    mockSpawnWithPrefix.mockImplementation(() => {
      callCount++;
      // First call is UDL, second is codegen (success), third is next build (fails)
      const code = callCount === 3 ? 3 : 0;
      return {
        process: createMockProcess(code),
        name: 'npx',
        prefix: '[test]',
      };
    });

    await runBuild({}, [], {
      exit: mockExit,
      waitForServer: mockWaitForServer,
    });

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Next.js build failed with exit code 3')
    );
    expect(mockKillAll).toHaveBeenCalled();
    expect(exitCode).toBe(3);
  });

  it('should exit with 1 when waitForServer throws', async () => {
    const failingWaitForServer = vi
      .fn()
      .mockRejectedValue(new Error('Server timeout'));

    await runBuild({}, [], {
      exit: mockExit,
      waitForServer: failingWaitForServer,
    });

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Build failed: Server timeout')
    );
    expect(mockKillAll).toHaveBeenCalled();
    expect(exitCode).toBe(1);
  });

  it('should log progress messages', async () => {
    await runBuild({}, [], {
      exit: mockExit,
      waitForServer: mockWaitForServer,
    });

    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('Starting UDL server')
    );
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('Waiting for UDL server')
    );
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('UDL server is ready')
    );
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('Running codegen')
    );
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('Codegen completed')
    );
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('Building Next.js')
    );
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('Next.js build completed')
    );
  });

  it('should handle process error events by resolving with exit code 1', async () => {
    let callCount = 0;
    mockSpawnWithPrefix.mockImplementation(() => {
      callCount++;
      const emitter = new EventEmitter();

      Object.defineProperty(emitter, 'exitCode', {
        value: null,
        writable: true,
        configurable: true,
      });
      Object.defineProperty(emitter, 'killed', {
        value: false,
        writable: true,
        configurable: true,
      });
      Object.defineProperty(emitter, 'pid', {
        value: 1234,
        writable: true,
        configurable: true,
      });

      (emitter as ChildProcess).kill = vi.fn();

      // First is UDL (exits normally), second is codegen (emits error)
      setImmediate(() => {
        if (callCount === 2) {
          // Add an error handler to prevent uncaught exception
          emitter.on('error', () => {});
          emitter.emit('error', new Error('spawn error'));
        } else {
          emitter.emit('exit', 0, null);
        }
      });

      return {
        process: emitter as ChildProcess,
        name: 'npx',
        prefix: '[test]',
      };
    });

    await runBuild({}, [], {
      exit: mockExit,
      waitForServer: mockWaitForServer,
    });

    // Codegen fails due to error event, should cleanup
    expect(mockKillAll).toHaveBeenCalled();
    expect(exitCode).toBe(1);
  });

  it('should use default process.exit when no exit function provided', async () => {
    const processExitSpy = vi.spyOn(process, 'exit').mockImplementation(((
      code: string | number | null | undefined
    ) => {
      exitCode = typeof code === 'number' ? code : null;
    }) as (code?: string | number | null | undefined) => never);

    await runBuild({}, [], {
      waitForServer: mockWaitForServer,
    });

    expect(processExitSpy).toHaveBeenCalledWith(0);
    processExitSpy.mockRestore();
  });

  it('should handle non-Error thrown values', async () => {
    const failingWaitForServer = vi.fn().mockRejectedValue('string error');

    await runBuild({}, [], {
      exit: mockExit,
      waitForServer: failingWaitForServer,
    });

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Build failed: string error')
    );
    expect(exitCode).toBe(1);
  });

  it('should use default waitForServer when not provided', async () => {
    // Import the mocked module to verify it's called
    const waitForReadyModule = await import('@/utils/wait-for-ready.js');
    const mockedWaitForServer = vi.mocked(waitForReadyModule.waitForServer);
    mockedWaitForServer.mockResolvedValue(undefined);

    await runBuild({}, [], {
      exit: mockExit,
      // Note: NOT passing waitForServer, so it should use the default
    });

    // The mocked waitForServer should have been called
    expect(mockedWaitForServer).toHaveBeenCalledWith(4000);
  });

  it('should handle null exit code from process', async () => {
    let callCount = 0;
    mockSpawnWithPrefix.mockImplementation(() => {
      callCount++;
      const emitter = new EventEmitter();

      Object.defineProperty(emitter, 'exitCode', {
        value: null,
        writable: true,
        configurable: true,
      });
      Object.defineProperty(emitter, 'killed', {
        value: false,
        writable: true,
        configurable: true,
      });
      Object.defineProperty(emitter, 'pid', {
        value: 1234,
        writable: true,
        configurable: true,
      });

      (emitter as ChildProcess).kill = vi.fn();

      // Codegen exits with null code (killed by signal)
      setImmediate(() => {
        if (callCount === 2) {
          emitter.emit('exit', null, 'SIGTERM');
        } else {
          emitter.emit('exit', 0, null);
        }
      });

      return {
        process: emitter as ChildProcess,
        name: 'npx',
        prefix: '[test]',
      };
    });

    await runBuild({}, [], {
      exit: mockExit,
      waitForServer: mockWaitForServer,
    });

    // Null code should be treated as 1
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Codegen failed with exit code 1')
    );
    expect(exitCode).toBe(1);
  });
});
