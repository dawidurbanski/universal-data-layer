import type { CliOptions } from '@/types.js';
import {
  spawnWithPrefix,
  killAll,
  type SpawnedProcess,
} from '@/utils/spawn.js';
import { waitForServer } from '@/utils/wait-for-ready.js';

// ANSI color codes
const CYAN = '\x1b[36m';
const MAGENTA = '\x1b[35m';
const GREEN = '\x1b[32m';
const RESET = '\x1b[0m';

const DEFAULT_UDL_PORT = 4000;

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
  const udlPort = options.port ?? DEFAULT_UDL_PORT;

  const processes: SpawnedProcess[] = [];

  const cleanup = async (): Promise<void> => {
    await killAll(processes);
  };

  try {
    // Step 1: Start UDL server in background
    console.log(`${GREEN}Starting UDL server...${RESET}`);
    const udlProcess = spawnWithPrefix(
      'npx',
      ['universal-data-layer', '--port', String(udlPort)],
      `${CYAN}[udl]${RESET}`
    );
    processes.push(udlProcess);

    // Step 2: Wait for UDL server to be ready
    console.log(`${GREEN}Waiting for UDL server to be ready...${RESET}`);
    await waitFn(udlPort);
    console.log(`${GREEN}UDL server is ready on port ${udlPort}${RESET}`);

    // Step 3: Run codegen
    console.log(`${GREEN}Running codegen...${RESET}`);
    const codegenExitCode = await runCommand(
      'npx',
      ['udl-codegen'],
      `${CYAN}[codegen]${RESET}`
    );

    if (codegenExitCode !== 0) {
      console.error(`Codegen failed with exit code ${codegenExitCode}`);
      await cleanup();
      exit(codegenExitCode);
      return;
    }
    console.log(`${GREEN}Codegen completed successfully${RESET}`);

    // Step 4: Run next build
    console.log(`${GREEN}Building Next.js...${RESET}`);
    const nextBuildExitCode = await runCommand(
      'npx',
      ['next', 'build', ...nextArgs],
      `${MAGENTA}[next]${RESET}`
    );

    if (nextBuildExitCode !== 0) {
      console.error(`Next.js build failed with exit code ${nextBuildExitCode}`);
      await cleanup();
      exit(nextBuildExitCode);
      return;
    }
    console.log(`${GREEN}Next.js build completed successfully${RESET}`);

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
  prefix: string
): Promise<number> {
  return new Promise((resolve) => {
    const spawned = spawnWithPrefix(command, args, prefix);

    spawned.process.on('exit', (code) => {
      resolve(code ?? 1);
    });

    spawned.process.on('error', () => {
      resolve(1);
    });
  });
}
