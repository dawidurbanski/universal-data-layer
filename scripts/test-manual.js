#!/usr/bin/env node

import { spawn } from 'child_process';
import process from 'process';

// Parse command line arguments
const args = process.argv.slice(2);

// The first argument should be the framework name
const framework = args[0];

if (!framework) {
  console.error('Error: Please specify a framework to test');
  console.error('Usage: npm run test:manual <framework>');
  console.error('Example: npm run test:manual nextjs');
  process.exit(1);
}

// Remove the framework from args to pass the rest to turbo
const turboArgs = args.slice(1);

// Build the turbo command for the specific example
const command = [
  'turbo',
  'dev',
  `--filter=@examples/${framework}`,
  ...turboArgs,
];

console.log(`Running manual test for ${framework}...`);

// Run the turbo command
const turbo = spawn('npx', command, {
  stdio: 'inherit',
  shell: true,
});

turbo.on('close', (code) => {
  process.exit(code);
});
