import type { CliOptions } from '@/types.js';
import {
  spawnWithPrefix,
  killAll,
  type SpawnedProcess,
} from '@/utils/spawn.js';

// ANSI color codes
const CYAN = '\x1b[36m';
const MAGENTA = '\x1b[35m';
const RESET = '\x1b[0m';

const DEFAULT_UDL_PORT = 4000;
const DEFAULT_NEXT_PORT = 3000;

/**
 * Configuration for runDev, allowing dependency injection for testing.
 */
export interface RunDevConfig {
  /** Function to call for process exit. Defaults to process.exit. */
  exit?: (code: number) => never;
  /** AbortSignal to allow external cancellation (useful for testing). */
  signal?: AbortSignal;
}

/**
 * Runs UDL and Next.js development servers concurrently.
 */
export async function runDev(
  options: CliOptions,
  nextArgs: string[],
  config?: RunDevConfig
): Promise<void> {
  const exit = config?.exit ?? ((code: number) => process.exit(code));
  const udlPort = options.port ?? DEFAULT_UDL_PORT;
  const nextPort = options.nextPort ?? DEFAULT_NEXT_PORT;

  const processes: SpawnedProcess[] = [];
  let isShuttingDown = false;

  const cleanup = async (exitCode: number): Promise<void> => {
    if (isShuttingDown) {
      return;
    }
    isShuttingDown = true;

    await killAll(processes);
    exit(exitCode);
  };

  // Handle graceful shutdown signals
  const handleSignal = (): void => {
    void cleanup(0);
  };

  process.on('SIGINT', handleSignal);
  process.on('SIGTERM', handleSignal);

  // Spawn UDL server
  const udlProcess = spawnWithPrefix(
    'npx',
    ['universal-data-layer', '--port', String(udlPort)],
    `${CYAN}[udl]${RESET}`
  );
  processes.push(udlProcess);

  // Spawn Next.js dev server
  const nextPortArgs = ['--port', String(nextPort)];
  const nextProcess = spawnWithPrefix(
    'npx',
    ['next', 'dev', ...nextPortArgs, ...nextArgs],
    `${MAGENTA}[next]${RESET}`
  );
  processes.push(nextProcess);

  // Handle unexpected process exits
  const handleExit = (name: string) => (code: number | null) => {
    if (isShuttingDown) return;

    console.error(`\n${name} exited unexpectedly with code ${code ?? 'null'}`);
    void cleanup(code ?? 1);
  };

  udlProcess.process.on('exit', handleExit('UDL'));
  nextProcess.process.on('exit', handleExit('Next.js'));

  // Keep the process running until signal, child exit, or abort
  await new Promise<void>((resolve) => {
    if (config?.signal) {
      config.signal.addEventListener('abort', () => resolve());
    }
    // Without signal, this promise never resolves - we exit via cleanup()
  });
}
