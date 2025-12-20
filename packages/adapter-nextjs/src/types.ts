/**
 * Available CLI commands for the udl-next adapter.
 */
export type CliCommand = 'dev' | 'build' | 'start';

/**
 * CLI options parsed from command-line arguments.
 */
export interface CliOptions {
  /** UDL server port (default: 4000) */
  port?: number;
  /** Next.js server port (default: 3000) */
  nextPort?: number;
  /** Show help message */
  help?: boolean;
}

/**
 * Parsed command-line arguments.
 */
export interface ParsedArgs {
  /** The command to run (dev, build, start) */
  command: CliCommand | undefined;
  /** Parsed CLI options */
  options: CliOptions;
  /** Remaining arguments to pass to Next.js (after --) */
  nextArgs: string[];
}
