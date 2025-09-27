#!/usr/bin/env node

import { spawn } from 'child_process';
import process from 'process';

// Parse command line arguments
const args = process.argv.slice(2);
const frameworkIndex = args.findIndex((arg) =>
  arg.startsWith('--with-framework=')
);

let frameworks = [];
if (frameworkIndex !== -1) {
  const frameworkArg = args[frameworkIndex];
  frameworks = frameworkArg.replace('--with-framework=', '').split(',');
  // Remove the --with-framework argument from the args passed to turbo
  args.splice(frameworkIndex, 1);
}

// Build the turbo command
const turboArgs = ['dev'];

// If frameworks are specified, run everything (packages + specified examples)
// Otherwise just run packages
if (frameworks.length === 0) {
  // Run all packages in the packages directory
  turboArgs.push("--filter='./packages/*'");
} else {
  // Run packages and specified framework examples
  turboArgs.push("--filter='./packages/*'");
  frameworks.forEach((fw) => {
    turboArgs.push(`--filter='./examples/${fw}'`);
  });
}

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
