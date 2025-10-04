#!/usr/bin/env node

import { spawn } from 'node:child_process';
import process from 'node:process';

export function runTurbo(command, argPrefix = '--example=') {
  // Parse command line arguments
  const args = process.argv.slice(2);
  const frameworkIndex = args.findIndex((arg) => arg.startsWith(argPrefix));

  let frameworks = [];
  if (frameworkIndex !== -1) {
    const frameworkArg = args[frameworkIndex];
    frameworks = frameworkArg.replace(argPrefix, '').split(',');
    // Remove the framework argument from the args passed to turbo
    args.splice(frameworkIndex, 1);
  } else {
    // Default to nextjs example for dev command
    frameworks = ['nextjs'];
  }

  // Build the turbo command
  const turboArgs = [command];

  // Always run packages in watch mode
  turboArgs.push("--filter='./packages/*'");

  // Run specified framework examples
  frameworks.forEach((fw) => {
    turboArgs.push(`--filter='./examples/${fw}'`);
  });

  // Add any other arguments passed to the script
  turboArgs.push(...args);

  // Run the turbo command
  const turbo = spawn('turbo', turboArgs, {
    stdio: 'inherit',
    shell: true,
  });

  turbo.on('close', (code) => {
    process.exit(code);
  });
}
