import { parseArgs as nodeParseArgs } from 'node:util';
import type { CliCommand, CliOptions, ParsedArgs } from '@/types.js';
import { runDev } from '@/commands/dev.js';
import { runStart } from '@/commands/start.js';
import { runBuild } from '@/commands/build.js';

const VALID_COMMANDS: CliCommand[] = ['dev', 'build', 'start'];

/**
 * Parses command-line arguments into structured format.
 */
export function parseArgs(args: string[]): ParsedArgs {
  // Find the index of '--' separator for Next.js args
  const separatorIndex = args.indexOf('--');
  const cliArgs = separatorIndex === -1 ? args : args.slice(0, separatorIndex);
  const nextArgs = separatorIndex === -1 ? [] : args.slice(separatorIndex + 1);

  const { values, positionals } = nodeParseArgs({
    args: cliArgs,
    options: {
      port: {
        type: 'string',
        short: 'p',
      },
      'next-port': {
        type: 'string',
      },
      help: {
        type: 'boolean',
        short: 'h',
      },
    },
    allowPositionals: true,
  });

  // First positional is the command
  const commandArg = positionals[0];
  const command = VALID_COMMANDS.includes(commandArg as CliCommand)
    ? (commandArg as CliCommand)
    : undefined;

  const options: CliOptions = {};

  if (values.help === true) {
    options.help = true;
  }

  if (values.port !== undefined) {
    options.port = parseInt(values.port, 10);
  }

  if (values['next-port'] !== undefined) {
    options.nextPort = parseInt(values['next-port'], 10);
  }

  return {
    command,
    options,
    nextArgs,
  };
}

/**
 * Prints help message to stdout.
 */
export function printHelp(): void {
  console.log(`
UDL Next.js Adapter

Usage:
  udl-next <command> [options] [-- <next-args>]

Commands:
  dev     Run UDL and Next.js development servers concurrently
  build   Run UDL codegen and build Next.js for production
  start   Run UDL and Next.js production servers concurrently

Options:
  -p, --port <port>       UDL server port (default: 4000)
      --next-port <port>  Next.js server port (default: 3000)
  -h, --help              Show this help message

Examples:
  udl-next dev
  udl-next dev --port 5000
  udl-next dev -- --turbo
  udl-next build
  udl-next start --port 4000 --next-port 3001
`);
}

/**
 * Main CLI entry point.
 */
export async function main(args?: string[]): Promise<void> {
  const argv = args ?? process.argv.slice(2);
  const { command, options, nextArgs } = parseArgs(argv);

  if (options.help || command === undefined) {
    printHelp();
    if (!options.help && command === undefined && argv.length > 0) {
      // Invalid command provided
      console.error(`Unknown command: ${argv[0]}`);
      process.exitCode = 1;
    }
    return;
  }

  // Commands will be implemented in subsequent tasks
  switch (command) {
    case 'dev':
      await runDev(options, nextArgs);
      break;
    case 'build':
      await runBuild(options, nextArgs);
      break;
    case 'start':
      await runStart(options, nextArgs);
      break;
  }
}
