import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { runDev } from '@/commands/dev.js';
import * as spawnModule from '@/utils/spawn.js';
import { EventEmitter } from 'node:events';
import type { ChildProcess } from 'node:child_process';

// Mock the spawn module
vi.mock('@/utils/spawn.js', () => ({
  spawnWithPrefix: vi.fn(),
  killAll: vi.fn().mockResolvedValue(undefined),
}));

// Mock the config module
vi.mock('@/utils/config.js', () => ({
  COLORS: {
    CYAN: '\x1b[36m',
    MAGENTA: '\x1b[35m',
    GREEN: '\x1b[32m',
    RESET: '\x1b[0m',
  },
  DEFAULT_NEXT_PORT: 3000,
  DEFAULT_UDL_PORT: 4000,
  UDL_ENDPOINT_ENV: 'UDL_ENDPOINT',
  // Mock resolveUdlPort to return default port (simulating no config file)
  resolveUdlPort: vi.fn(async (cliPort?: number) => cliPort ?? 4000),
  buildUdlEndpoint: vi.fn((port: number) => `http://localhost:${port}/graphql`),
  createNextEnv: vi.fn((udlEndpoint: string) => ({
    ...process.env,
    UDL_ENDPOINT: udlEndpoint,
  })),
}));

const mockSpawnWithPrefix = vi.mocked(spawnModule.spawnWithPrefix);
const mockKillAll = vi.mocked(spawnModule.killAll);

/**
 * Creates a mock ChildProcess for testing.
 */
function createMockProcess(): ChildProcess {
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

  return emitter as ChildProcess;
}

describe('runDev', () => {
  let mockUdlProcess: ChildProcess;
  let mockNextProcess: ChildProcess;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let signalHandlers: Map<string, () => void>;
  let exitCode: number | null;
  let abortController: AbortController;

  const mockExit = ((code: number): never => {
    exitCode = code;
    // Abort the runDev promise so the test can continue
    abortController.abort();
    // Return type is 'never' but we don't actually throw in tests
    return undefined as never;
  }) as (code: number) => never;

  beforeEach(() => {
    vi.clearAllMocks();
    exitCode = null;
    abortController = new AbortController();

    mockUdlProcess = createMockProcess();
    mockNextProcess = createMockProcess();

    signalHandlers = new Map();

    // Mock process.on to capture signal handlers
    vi.spyOn(process, 'on').mockImplementation((event, handler) => {
      if (event === 'SIGINT' || event === 'SIGTERM') {
        signalHandlers.set(event as string, handler as () => void);
      }
      return process;
    });

    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Setup mock spawn responses
    mockSpawnWithPrefix
      .mockReturnValueOnce({
        process: mockUdlProcess,
        name: 'npx',
        prefix: '[udl]',
      })
      .mockReturnValueOnce({
        process: mockNextProcess,
        name: 'npx',
        prefix: '[next]',
      });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should spawn UDL without explicit port (uses UDL default)', async () => {
    const devPromise = runDev({}, [], {
      exit: mockExit,
      signal: abortController.signal,
    });

    // Trigger SIGINT to exit
    signalHandlers.get('SIGINT')?.();
    await devPromise;

    // When no port is specified, UDL uses its own default (from config or 4000)
    expect(mockSpawnWithPrefix).toHaveBeenCalledWith(
      'npx',
      ['universal-data-layer'],
      expect.stringContaining('[udl]')
    );
  });

  it('should spawn UDL with custom port', async () => {
    const devPromise = runDev({ port: 5000 }, [], {
      exit: mockExit,
      signal: abortController.signal,
    });

    signalHandlers.get('SIGINT')?.();
    await devPromise;

    expect(mockSpawnWithPrefix).toHaveBeenCalledWith(
      'npx',
      ['universal-data-layer', '--port', '5000'],
      expect.stringContaining('[udl]')
    );
  });

  it('should spawn Next.js with default port', async () => {
    const devPromise = runDev({}, [], {
      exit: mockExit,
      signal: abortController.signal,
    });

    signalHandlers.get('SIGINT')?.();
    await devPromise;

    expect(mockSpawnWithPrefix).toHaveBeenCalledWith(
      'npx',
      ['next', 'dev', '--port', '3000'],
      expect.stringContaining('[next]'),
      expect.objectContaining({
        env: expect.objectContaining({
          UDL_ENDPOINT: 'http://localhost:4000/graphql',
        }),
      })
    );
  });

  it('should spawn Next.js with custom port', async () => {
    const devPromise = runDev({ nextPort: 3001 }, [], {
      exit: mockExit,
      signal: abortController.signal,
    });

    signalHandlers.get('SIGINT')?.();
    await devPromise;

    expect(mockSpawnWithPrefix).toHaveBeenCalledWith(
      'npx',
      ['next', 'dev', '--port', '3001'],
      expect.stringContaining('[next]'),
      expect.objectContaining({
        env: expect.objectContaining({
          UDL_ENDPOINT: 'http://localhost:4000/graphql',
        }),
      })
    );
  });

  it('should pass extra args to Next.js', async () => {
    const devPromise = runDev({}, ['--turbo', '--experimental-https'], {
      exit: mockExit,
      signal: abortController.signal,
    });

    signalHandlers.get('SIGINT')?.();
    await devPromise;

    expect(mockSpawnWithPrefix).toHaveBeenCalledWith(
      'npx',
      ['next', 'dev', '--port', '3000', '--turbo', '--experimental-https'],
      expect.stringContaining('[next]'),
      expect.objectContaining({
        env: expect.objectContaining({
          UDL_ENDPOINT: 'http://localhost:4000/graphql',
        }),
      })
    );
  });

  it('should use cyan color for UDL prefix', async () => {
    const devPromise = runDev({}, [], {
      exit: mockExit,
      signal: abortController.signal,
    });

    signalHandlers.get('SIGINT')?.();
    await devPromise;

    const udlCall = mockSpawnWithPrefix.mock.calls[0];
    expect(udlCall?.[2]).toContain('\x1b[36m'); // Cyan
    expect(udlCall?.[2]).toContain('[udl]');
  });

  it('should use magenta color for Next.js prefix', async () => {
    const devPromise = runDev({}, [], {
      exit: mockExit,
      signal: abortController.signal,
    });

    signalHandlers.get('SIGINT')?.();
    await devPromise;

    const nextCall = mockSpawnWithPrefix.mock.calls[1];
    expect(nextCall?.[2]).toContain('\x1b[35m'); // Magenta
    expect(nextCall?.[2]).toContain('[next]');
  });

  it('should register SIGINT handler', async () => {
    const devPromise = runDev({}, [], {
      exit: mockExit,
      signal: abortController.signal,
    });

    expect(signalHandlers.has('SIGINT')).toBe(true);

    signalHandlers.get('SIGINT')?.();
    await devPromise;
  });

  it('should register SIGTERM handler', async () => {
    const devPromise = runDev({}, [], {
      exit: mockExit,
      signal: abortController.signal,
    });

    expect(signalHandlers.has('SIGTERM')).toBe(true);

    signalHandlers.get('SIGTERM')?.();
    await devPromise;
  });

  it('should call killAll on SIGINT', async () => {
    const devPromise = runDev({}, [], {
      exit: mockExit,
      signal: abortController.signal,
    });

    signalHandlers.get('SIGINT')?.();
    await devPromise;

    expect(mockKillAll).toHaveBeenCalled();
  });

  it('should exit with code 0 on graceful shutdown', async () => {
    const devPromise = runDev({}, [], {
      exit: mockExit,
      signal: abortController.signal,
    });

    signalHandlers.get('SIGINT')?.();
    await devPromise;

    expect(exitCode).toBe(0);
  });

  it('should kill both processes and exit when UDL exits unexpectedly', async () => {
    const devPromise = runDev({}, [], {
      exit: mockExit,
      signal: abortController.signal,
    });

    // Wait for spawn calls to complete (handlers to be registered)
    await vi.waitFor(() =>
      expect(mockSpawnWithPrefix).toHaveBeenCalledTimes(2)
    );

    // Simulate UDL process exiting with code 1
    mockUdlProcess.emit('exit', 1, null);
    await devPromise;

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('UDL exited unexpectedly')
    );
    expect(mockKillAll).toHaveBeenCalled();
    expect(exitCode).toBe(1);
  });

  it('should kill both processes and exit when Next.js exits unexpectedly', async () => {
    const devPromise = runDev({}, [], {
      exit: mockExit,
      signal: abortController.signal,
    });

    // Wait for spawn calls to complete (handlers to be registered)
    await vi.waitFor(() =>
      expect(mockSpawnWithPrefix).toHaveBeenCalledTimes(2)
    );

    // Simulate Next.js process exiting with code 2
    mockNextProcess.emit('exit', 2, null);
    await devPromise;

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Next.js exited unexpectedly')
    );
    expect(mockKillAll).toHaveBeenCalled();
    expect(exitCode).toBe(2);
  });

  it('should handle null exit code', async () => {
    const devPromise = runDev({}, [], {
      exit: mockExit,
      signal: abortController.signal,
    });

    // Wait for spawn calls to complete (handlers to be registered)
    await vi.waitFor(() =>
      expect(mockSpawnWithPrefix).toHaveBeenCalledTimes(2)
    );

    // Simulate process exiting with null code (killed by signal)
    mockUdlProcess.emit('exit', null, 'SIGKILL');
    await devPromise;

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('code null')
    );
    expect(exitCode).toBe(1);
  });

  it('should not call cleanup twice on rapid signals', async () => {
    const devPromise = runDev({}, [], {
      exit: mockExit,
      signal: abortController.signal,
    });

    // Trigger signal twice rapidly (before first cleanup completes)
    signalHandlers.get('SIGINT')?.();
    signalHandlers.get('SIGINT')?.(); // Second call should hit re-entrancy guard
    await devPromise;

    // killAll should only be called once due to re-entrancy guard
    expect(mockKillAll).toHaveBeenCalledTimes(1);
  });

  it('should not process exit after shutdown started via signal', async () => {
    const devPromise = runDev({}, [], {
      exit: mockExit,
      signal: abortController.signal,
    });

    // Trigger signal to start shutdown
    signalHandlers.get('SIGINT')?.();

    // Process exit event after shutdown started should be ignored by handleExit
    mockUdlProcess.emit('exit', 1, null);

    await devPromise;

    // Should not have error message since shutdown was graceful
    expect(consoleErrorSpy).not.toHaveBeenCalled();
    expect(exitCode).toBe(0);
  });

  it('should ignore process exit events during shutdown', async () => {
    const devPromise = runDev({}, [], {
      exit: mockExit,
      signal: abortController.signal,
    });

    // First trigger graceful shutdown
    signalHandlers.get('SIGINT')?.();
    await devPromise;

    // Reset to check that subsequent exit events are ignored
    mockKillAll.mockClear();

    // Simulate process exit during shutdown (should be ignored)
    mockUdlProcess.emit('exit', 1, null);

    // Should not trigger another killAll
    expect(mockKillAll).not.toHaveBeenCalled();
  });

  it('should resolve promise when abort signal is triggered', async () => {
    const devPromise = runDev({}, [], {
      exit: mockExit,
      signal: abortController.signal,
    });

    // Wait for spawn calls to complete
    await vi.waitFor(() =>
      expect(mockSpawnWithPrefix).toHaveBeenCalledTimes(2)
    );

    // Abort directly without triggering exit
    abortController.abort();
    await devPromise;

    // Function should complete without error
    expect(exitCode).toBeNull();
  });

  it('should use default process.exit when no exit function provided', async () => {
    const processExitSpy = vi.spyOn(process, 'exit').mockImplementation(((
      code: string | number | null | undefined
    ) => {
      exitCode = typeof code === 'number' ? code : null;
      abortController.abort();
    }) as (code?: string | number | null | undefined) => never);

    const devPromise = runDev({}, [], {
      signal: abortController.signal,
    });

    // Trigger signal to start shutdown
    signalHandlers.get('SIGINT')?.();
    await devPromise;

    expect(processExitSpy).toHaveBeenCalledWith(0);
    processExitSpy.mockRestore();
  });
});
