import {
  spawn,
  type ChildProcess,
  type SpawnOptions,
} from 'node:child_process';
import { createPrefixedStream } from '@/utils/prefix-output.js';

export interface SpawnedProcess {
  process: ChildProcess;
  name: string;
  prefix: string;
}

export interface SpawnWithPrefixOptions extends SpawnOptions {
  /**
   * If true, inherit stdio directly instead of piping through prefix stream.
   * Useful for interactive processes.
   */
  inherit?: boolean;
}

/**
 * Spawns a command with prefixed stdout/stderr output.
 */
export function spawnWithPrefix(
  command: string,
  args: string[],
  prefix: string,
  options?: SpawnWithPrefixOptions
): SpawnedProcess {
  const { inherit, ...spawnOptions } = options ?? {};

  const child = spawn(command, args, {
    ...spawnOptions,
    stdio: inherit ? 'inherit' : ['inherit', 'pipe', 'pipe'],
  });

  if (!inherit && child.stdout && child.stderr) {
    const stdoutStream = createPrefixedStream(prefix, process.stdout);
    const stderrStream = createPrefixedStream(prefix, process.stderr);

    child.stdout.pipe(stdoutStream);
    child.stderr.pipe(stderrStream);
  }

  return {
    process: child,
    name: command,
    prefix,
  };
}

/**
 * Gracefully kills all spawned processes.
 * Sends SIGTERM first, then waits for processes to exit.
 */
export async function killAll(processes: SpawnedProcess[]): Promise<void> {
  const killPromises = processes.map(
    ({ process: child }) =>
      new Promise<void>((resolve) => {
        if (child.exitCode !== null || child.killed) {
          // Process already exited
          resolve();
          return;
        }

        child.once('exit', () => {
          resolve();
        });

        child.kill('SIGTERM');
      })
  );

  await Promise.all(killPromises);
}
