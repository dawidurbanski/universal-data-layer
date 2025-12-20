import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  spawnWithPrefix,
  killAll,
  type SpawnedProcess,
} from '@/utils/spawn.js';
import { EventEmitter } from 'node:events';
import type { ChildProcess } from 'node:child_process';

// Mock child_process
vi.mock('node:child_process', () => ({
  spawn: vi.fn(),
}));

// Get the mocked spawn
import { spawn } from 'node:child_process';
const mockSpawn = vi.mocked(spawn);

/**
 * Creates a mock ChildProcess for testing.
 * Uses Object.defineProperty to set readonly properties.
 */
function createMockProcess(options: {
  exitCode?: number | null;
  killed?: boolean;
  pid?: number;
  withStreams?: boolean;
}): ChildProcess {
  const emitter = new EventEmitter();

  // Define readonly properties
  Object.defineProperty(emitter, 'exitCode', {
    value: options.exitCode ?? null,
    writable: true,
    configurable: true,
  });
  Object.defineProperty(emitter, 'killed', {
    value: options.killed ?? false,
    writable: true,
    configurable: true,
  });
  Object.defineProperty(emitter, 'pid', {
    value: options.pid ?? 1234,
    writable: true,
    configurable: true,
  });

  // Add kill method
  (emitter as ChildProcess).kill = vi.fn();

  // Add streams if requested
  if (options.withStreams !== false) {
    const mockStdout = new EventEmitter();
    const mockStderr = new EventEmitter();
    (mockStdout as EventEmitter & { pipe: ReturnType<typeof vi.fn> }).pipe = vi
      .fn()
      .mockReturnThis();
    (mockStderr as EventEmitter & { pipe: ReturnType<typeof vi.fn> }).pipe = vi
      .fn()
      .mockReturnThis();
    (emitter as ChildProcess).stdout = mockStdout as ChildProcess['stdout'];
    (emitter as ChildProcess).stderr = mockStderr as ChildProcess['stderr'];
  } else {
    (emitter as ChildProcess).stdout = null;
    (emitter as ChildProcess).stderr = null;
  }

  return emitter as ChildProcess;
}

describe('spawnWithPrefix', () => {
  let mockProcess: ChildProcess;

  beforeEach(() => {
    vi.clearAllMocks();
    mockProcess = createMockProcess({ withStreams: true });
    mockSpawn.mockReturnValue(mockProcess);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should spawn a process with correct command and args', () => {
    spawnWithPrefix('node', ['script.js'], '[test]');

    expect(mockSpawn).toHaveBeenCalledWith('node', ['script.js'], {
      stdio: ['inherit', 'pipe', 'pipe'],
    });
  });

  it('should return SpawnedProcess with correct properties', () => {
    const result = spawnWithPrefix('next', ['dev'], '[next]');

    expect(result).toEqual({
      process: mockProcess,
      name: 'next',
      prefix: '[next]',
    });
  });

  it('should pipe stdout and stderr through prefix streams', () => {
    spawnWithPrefix('node', ['script.js'], '[test]');

    expect(mockProcess.stdout?.pipe).toHaveBeenCalled();
    expect(mockProcess.stderr?.pipe).toHaveBeenCalled();
  });

  it('should use inherit stdio when inherit option is true', () => {
    // Reset for inherit mode (no stdout/stderr)
    mockProcess = createMockProcess({ withStreams: false });
    mockSpawn.mockReturnValue(mockProcess);

    spawnWithPrefix('node', ['script.js'], '[test]', { inherit: true });

    expect(mockSpawn).toHaveBeenCalledWith('node', ['script.js'], {
      stdio: 'inherit',
    });
  });

  it('should pass through additional spawn options', () => {
    spawnWithPrefix('node', ['script.js'], '[test]', {
      cwd: '/some/path',
      env: { NODE_ENV: 'test' },
    });

    expect(mockSpawn).toHaveBeenCalledWith('node', ['script.js'], {
      cwd: '/some/path',
      env: { NODE_ENV: 'test' },
      stdio: ['inherit', 'pipe', 'pipe'],
    });
  });
});

describe('killAll', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should send SIGTERM to all processes', async () => {
    const mockProcess1 = createMockProcess({});
    const mockProcess2 = createMockProcess({});

    mockProcess1.kill = vi.fn().mockImplementation(() => {
      mockProcess1.emit('exit', 0, null);
      return true;
    });
    mockProcess2.kill = vi.fn().mockImplementation(() => {
      mockProcess2.emit('exit', 0, null);
      return true;
    });

    const processes: SpawnedProcess[] = [
      { process: mockProcess1, name: 'proc1', prefix: '[p1]' },
      { process: mockProcess2, name: 'proc2', prefix: '[p2]' },
    ];

    await killAll(processes);

    expect(mockProcess1.kill).toHaveBeenCalledWith('SIGTERM');
    expect(mockProcess2.kill).toHaveBeenCalledWith('SIGTERM');
  });

  it('should resolve immediately for already exited processes', async () => {
    const mockProcess1 = createMockProcess({ exitCode: 0 });

    const processes: SpawnedProcess[] = [
      { process: mockProcess1, name: 'proc1', prefix: '[p1]' },
    ];

    await killAll(processes);

    expect(mockProcess1.kill).not.toHaveBeenCalled();
  });

  it('should resolve immediately for already killed processes', async () => {
    const mockProcess1 = createMockProcess({ killed: true });

    const processes: SpawnedProcess[] = [
      { process: mockProcess1, name: 'proc1', prefix: '[p1]' },
    ];

    await killAll(processes);

    expect(mockProcess1.kill).not.toHaveBeenCalled();
  });

  it('should wait for all processes to exit', async () => {
    const exitOrder: string[] = [];

    const mockProcess1 = createMockProcess({});
    const mockProcess2 = createMockProcess({});

    mockProcess1.kill = vi.fn().mockImplementation(() => {
      // Simulate delayed exit
      setTimeout(() => {
        exitOrder.push('proc1');
        mockProcess1.emit('exit', 0, null);
      }, 10);
      return true;
    });

    mockProcess2.kill = vi.fn().mockImplementation(() => {
      // Exit immediately
      exitOrder.push('proc2');
      mockProcess2.emit('exit', 0, null);
      return true;
    });

    const processes: SpawnedProcess[] = [
      { process: mockProcess1, name: 'proc1', prefix: '[p1]' },
      { process: mockProcess2, name: 'proc2', prefix: '[p2]' },
    ];

    await killAll(processes);

    // Both should have exited
    expect(exitOrder).toContain('proc1');
    expect(exitOrder).toContain('proc2');
  });

  it('should handle empty process list', async () => {
    await expect(killAll([])).resolves.toBeUndefined();
  });
});
