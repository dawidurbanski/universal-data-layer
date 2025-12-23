import type { CliOptions } from '@/types.js';
import {
  spawnWithPrefix,
  killAll,
  type SpawnedProcess,
} from '@/utils/spawn.js';
import { waitForServer } from '@/utils/wait-for-ready.js';
import {
  COLORS,
  resolveUdlPort,
  buildUdlEndpoint,
  createNextEnv,
} from '@/utils/config.js';

/**
 * Configuration for runBuild, allowing dependency injection for testing.
 */
export interface RunBuildConfig {
  /** Function to call for process exit. Defaults to process.exit. */
  exit?: (code: number) => never;
  /** Custom waitForServer implementation for testing. */
  waitForServer?: (port: number, timeout?: number) => Promise<void>;
}

/**
 * Runs the build process: UDL server → codegen → next build.
 */
export async function runBuild(
  options: CliOptions,
  nextArgs: string[],
  config?: RunBuildConfig
): Promise<void> {
  const exit = config?.exit ?? ((code: number) => process.exit(code));
  const waitFn = config?.waitForServer ?? waitForServer;

  // Resolve UDL port from CLI options or config file
  const udlPort = await resolveUdlPort(options.port);
  const udlEndpoint = buildUdlEndpoint(udlPort);

  const processes: SpawnedProcess[] = [];

  const cleanup = async (): Promise<void> => {
    await killAll(processes);
  };

  try {
    // Step 1: Start UDL server in background
    console.log(`${COLORS.GREEN}Starting UDL server...${COLORS.RESET}`);
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

    // Step 2: Wait for UDL server to be ready
    console.log(
      `${COLORS.GREEN}Waiting for UDL server to be ready...${COLORS.RESET}`
    );
    await waitFn(udlPort);
    console.log(
      `${COLORS.GREEN}UDL server is ready on port ${udlPort}${COLORS.RESET}`
    );

    // Step 3: Run codegen
    console.log(`${COLORS.GREEN}Running codegen...${COLORS.RESET}`);
    const codegenExitCode = await runCommand(
      'npx',
      ['udl-codegen'],
      `${COLORS.CYAN}[codegen]${COLORS.RESET}`
    );

    if (codegenExitCode !== 0) {
      console.error(`Codegen failed with exit code ${codegenExitCode}`);
      await cleanup();
      exit(codegenExitCode);
      return;
    }
    console.log(`${COLORS.GREEN}Codegen completed successfully${COLORS.RESET}`);

    // Step 4: Run next build with UDL_ENDPOINT set
    console.log(`${COLORS.GREEN}Building Next.js...${COLORS.RESET}`);
    const nextBuildExitCode = await runCommand(
      'npx',
      ['next', 'build', ...nextArgs],
      `${COLORS.MAGENTA}[next]${COLORS.RESET}`,
      { env: createNextEnv(udlEndpoint) }
    );

    if (nextBuildExitCode !== 0) {
      console.error(`Next.js build failed with exit code ${nextBuildExitCode}`);
      await cleanup();
      exit(nextBuildExitCode);
      return;
    }
    console.log(
      `${COLORS.GREEN}Next.js build completed successfully${COLORS.RESET}`
    );

    // Step 5: Cleanup and exit
    await cleanup();
    exit(0);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Build failed: ${message}`);
    await cleanup();
    exit(1);
  }
}

/**
 * Runs a command and waits for it to complete.
 * Returns the exit code.
 */
function runCommand(
  command: string,
  args: string[],
  prefix: string,
  options?: { env?: NodeJS.ProcessEnv }
): Promise<number> {
  return new Promise((resolve) => {
    const spawned = spawnWithPrefix(command, args, prefix, options);

    spawned.process.on('exit', (code) => {
      resolve(code ?? 1);
    });

    spawned.process.on('error', () => {
      resolve(1);
    });
  });
}
