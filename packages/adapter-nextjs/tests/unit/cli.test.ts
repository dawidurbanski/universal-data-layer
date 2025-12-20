import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { parseArgs, printHelp, main } from '@/cli.js';
import { runDev } from '@/commands/dev.js';
import { runStart } from '@/commands/start.js';
import { runBuild } from '@/commands/build.js';

// Mock the command modules
vi.mock('@/commands/dev.js', () => ({
  runDev: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/commands/start.js', () => ({
  runStart: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/commands/build.js', () => ({
  runBuild: vi.fn().mockResolvedValue(undefined),
}));

const mockRunDev = vi.mocked(runDev);
const mockRunStart = vi.mocked(runStart);
const mockRunBuild = vi.mocked(runBuild);

describe('parseArgs', () => {
  describe('command parsing', () => {
    it('should parse dev command', () => {
      const result = parseArgs(['dev']);
      expect(result.command).toBe('dev');
    });

    it('should parse build command', () => {
      const result = parseArgs(['build']);
      expect(result.command).toBe('build');
    });

    it('should parse start command', () => {
      const result = parseArgs(['start']);
      expect(result.command).toBe('start');
    });

    it('should return undefined for unknown command', () => {
      const result = parseArgs(['unknown']);
      expect(result.command).toBeUndefined();
    });

    it('should return undefined for empty args', () => {
      const result = parseArgs([]);
      expect(result.command).toBeUndefined();
    });
  });

  describe('options parsing', () => {
    it('should parse --port option', () => {
      const result = parseArgs(['dev', '--port', '5000']);
      expect(result.options.port).toBe(5000);
    });

    it('should parse -p short option', () => {
      const result = parseArgs(['dev', '-p', '5000']);
      expect(result.options.port).toBe(5000);
    });

    it('should parse --next-port option', () => {
      const result = parseArgs(['dev', '--next-port', '3001']);
      expect(result.options.nextPort).toBe(3001);
    });

    it('should parse --help option', () => {
      const result = parseArgs(['--help']);
      expect(result.options.help).toBe(true);
    });

    it('should parse -h short option', () => {
      const result = parseArgs(['-h']);
      expect(result.options.help).toBe(true);
    });

    it('should parse multiple options', () => {
      const result = parseArgs(['dev', '-p', '5000', '--next-port', '3001']);
      expect(result.options.port).toBe(5000);
      expect(result.options.nextPort).toBe(3001);
    });

    it('should have undefined port when not provided', () => {
      const result = parseArgs(['dev']);
      expect(result.options.port).toBeUndefined();
    });

    it('should have undefined nextPort when not provided', () => {
      const result = parseArgs(['dev']);
      expect(result.options.nextPort).toBeUndefined();
    });
  });

  describe('next args parsing', () => {
    it('should collect args after -- separator', () => {
      const result = parseArgs(['dev', '--', '--turbo']);
      expect(result.nextArgs).toEqual(['--turbo']);
    });

    it('should collect multiple args after -- separator', () => {
      const result = parseArgs([
        'dev',
        '--',
        '--turbo',
        '--experimental-https',
      ]);
      expect(result.nextArgs).toEqual(['--turbo', '--experimental-https']);
    });

    it('should return empty array when no -- separator', () => {
      const result = parseArgs(['dev']);
      expect(result.nextArgs).toEqual([]);
    });

    it('should handle options before -- separator correctly', () => {
      const result = parseArgs(['dev', '-p', '5000', '--', '--turbo']);
      expect(result.command).toBe('dev');
      expect(result.options.port).toBe(5000);
      expect(result.nextArgs).toEqual(['--turbo']);
    });

    it('should return empty nextArgs when -- is at the end', () => {
      const result = parseArgs(['dev', '--']);
      expect(result.nextArgs).toEqual([]);
    });
  });
});

describe('printHelp', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  it('should print help message', () => {
    printHelp();

    expect(consoleSpy).toHaveBeenCalledTimes(1);
    const output = consoleSpy.mock.calls[0]?.[0] as string;
    expect(output).toContain('UDL Next.js Adapter');
    expect(output).toContain('Usage:');
    expect(output).toContain('Commands:');
    expect(output).toContain('dev');
    expect(output).toContain('build');
    expect(output).toContain('start');
    expect(output).toContain('Options:');
    expect(output).toContain('--port');
    expect(output).toContain('--next-port');
    expect(output).toContain('--help');
    expect(output).toContain('Examples:');
  });
});

describe('main', () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    process.exitCode = undefined;
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    process.exitCode = undefined;
  });

  it('should print help when --help is passed', async () => {
    await main(['--help']);

    expect(consoleLogSpy).toHaveBeenCalled();
    const output = consoleLogSpy.mock.calls[0]?.[0] as string;
    expect(output).toContain('UDL Next.js Adapter');
  });

  it('should print help when -h is passed', async () => {
    await main(['-h']);

    expect(consoleLogSpy).toHaveBeenCalled();
    const output = consoleLogSpy.mock.calls[0]?.[0] as string;
    expect(output).toContain('UDL Next.js Adapter');
  });

  it('should print help and not set error when no command with no args', async () => {
    await main([]);

    expect(consoleLogSpy).toHaveBeenCalled();
    expect(process.exitCode).toBeUndefined();
  });

  it('should print help and set exit code 1 for unknown command', async () => {
    await main(['unknown']);

    expect(consoleLogSpy).toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalledWith('Unknown command: unknown');
    expect(process.exitCode).toBe(1);
  });

  it('should handle dev command', async () => {
    await main(['dev']);

    expect(mockRunDev).toHaveBeenCalledWith({}, []);
  });

  it('should handle build command', async () => {
    await main(['build']);

    expect(mockRunBuild).toHaveBeenCalledWith({}, []);
  });

  it('should pass options to build command', async () => {
    await main(['build', '-p', '5000']);

    expect(mockRunBuild).toHaveBeenCalledWith({ port: 5000 }, []);
  });

  it('should pass nextArgs to build command', async () => {
    await main(['build', '--', '--debug']);

    expect(mockRunBuild).toHaveBeenCalledWith({}, ['--debug']);
  });

  it('should handle start command', async () => {
    await main(['start']);

    expect(mockRunStart).toHaveBeenCalledWith({}, []);
  });

  it('should pass options to start command', async () => {
    await main(['start', '-p', '5000', '--next-port', '3001']);

    expect(mockRunStart).toHaveBeenCalledWith(
      { port: 5000, nextPort: 3001 },
      []
    );
  });

  it('should pass nextArgs to start command', async () => {
    await main(['start', '--', '--keepAliveTimeout', '5000']);

    expect(mockRunStart).toHaveBeenCalledWith({}, [
      '--keepAliveTimeout',
      '5000',
    ]);
  });

  it('should pass options to dev command', async () => {
    await main(['dev', '-p', '5000', '--next-port', '3001']);

    expect(mockRunDev).toHaveBeenCalledWith({ port: 5000, nextPort: 3001 }, []);
  });

  it('should pass nextArgs to dev command', async () => {
    await main(['dev', '--', '--turbo']);

    expect(mockRunDev).toHaveBeenCalledWith({}, ['--turbo']);
  });

  it('should use process.argv when args is undefined', async () => {
    const originalArgv = process.argv;
    process.argv = ['node', 'udl-next', 'dev'];

    try {
      await main();

      expect(mockRunDev).toHaveBeenCalledWith({}, []);
    } finally {
      process.argv = originalArgv;
    }
  });
});
