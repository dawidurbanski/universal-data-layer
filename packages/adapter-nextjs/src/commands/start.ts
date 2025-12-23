import type { CliOptions } from '@/types.js';
import {
  spawnWithPrefix,
  killAll,
  type SpawnedProcess,
} from '@/utils/spawn.js';
import {
  COLORS,
  DEFAULT_NEXT_PORT,
  resolveUdlPort,
  buildUdlEndpoint,
  createNextEnv,
} from '@/utils/config.js';

/**
 * Configuration for runStart, allowing dependency injection for testing.
 */
export interface RunStartConfig {
  /** Function to call for process exit. Defaults to process.exit. */
  exit?: (code: number) => never;
  /** AbortSignal to allow external cancellation (useful for testing). */
  signal?: AbortSignal;
}

/**
 * Runs UDL and Next.js production servers concurrently.
 */
export async function runStart(
  options: CliOptions,
  nextArgs: string[],
  config?: RunStartConfig
): Promise<void> {
  const exit = config?.exit ?? ((code: number) => process.exit(code));
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

  // Resolve UDL port from CLI options or config file
  const udlPort = await resolveUdlPort(options.port);
  const udlEndpoint = buildUdlEndpoint(udlPort);

  // Spawn UDL server
  const udlArgs = ['universal-data-layer'];
  // Pass --port only if explicitly provided via CLI (to override config)
  if (options.port !== undefined) {
    udlArgs.push('--port', String(options.port));
  }
  const udlProcess = spawnWithPrefix(
    'npx',
    udlArgs,
    `${COLORS.CYAN}[udl]${COLORS.RESET}`
  );
  processes.push(udlProcess);

  // Spawn Next.js production server with UDL_ENDPOINT set
  const nextPortArgs = ['--port', String(nextPort)];
  const nextProcess = spawnWithPrefix(
    'npx',
    ['next', 'start', ...nextPortArgs, ...nextArgs],
    `${COLORS.MAGENTA}[next]${COLORS.RESET}`,
    {
      env: createNextEnv(udlEndpoint),
    }
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
