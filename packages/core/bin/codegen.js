#!/usr/bin/env node

import { parseArgs } from 'node:util';
import { config as loadEnv } from 'dotenv';
import { runCodegenOnly } from '../dist/src/codegen-only.js';

// Load environment variables following NextJS convention
const nodeEnv = process.env.NODE_ENV || 'development';

loadEnv({ path: '.env' });
loadEnv({ path: `.env.${nodeEnv}` });
if (nodeEnv !== 'test') {
  loadEnv({ path: '.env.local' });
}
loadEnv({ path: `.env.${nodeEnv}.local` });

const { values } = parseArgs({
  options: {
    help: {
      type: 'boolean',
      short: 'h',
    },
    'include-manual-tests': {
      type: 'boolean',
      default: true,
    },
    'no-manual-tests': {
      type: 'boolean',
    },
  },
});

if (values.help) {
  console.log(`
Universal Data Layer - Codegen

Generates TypeScript types, type guards, and fetch helpers from your UDL plugins.

Usage:
  udl-codegen [options]

Options:
  --include-manual-tests  Include manual test features (default: true in dev)
  --no-manual-tests       Skip manual test features
  -h, --help              Show this help message

This command:
1. Loads your udl.config.ts
2. Loads and runs all plugins (sourcing nodes)
3. Builds the GraphQL schema
4. Generates types based on codegen config

Use this in CI before running typecheck or tests.
  `);
  process.exit(0);
}

runCodegenOnly({
  includeManualTests: !values['no-manual-tests'],
}).catch((error) => {
  console.error('Codegen failed:', error.message);
  process.exit(1);
});
