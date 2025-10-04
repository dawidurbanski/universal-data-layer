#!/usr/bin/env node

import { parseArgs } from 'node:util';
import { config as loadEnv } from 'dotenv';
import { startServer } from '../dist/src/start-server.js';

// Load environment variables following NextJS convention
// Order (lowest to highest priority):
// 1. .env
// 2. .env.$(NODE_ENV)
// 3. .env.local (skipped when NODE_ENV=test)
// 4. .env.$(NODE_ENV).local
const nodeEnv = process.env.NODE_ENV || 'development';

loadEnv({ path: '.env' });
loadEnv({ path: `.env.${nodeEnv}` });
if (nodeEnv !== 'test') {
  loadEnv({ path: '.env.local' });
}
loadEnv({ path: `.env.${nodeEnv}.local` });

const { values } = parseArgs({
  options: {
    port: {
      type: 'string',
      short: 'p',
      default: '4000',
    },
    help: {
      type: 'boolean',
      short: 'h',
    },
  },
});

if (values.help) {
  console.log(`
Universal Data Layer Server

Usage:
  universal-data-layer [options]

Options:
  -p, --port <port>  Port to run the server on (default: 4000)
  -h, --help         Show this help message
  `);
  process.exit(0);
}

const port = parseInt(values.port, 10) || undefined;

startServer({ port }).catch((error) => {
  console.error('Failed to start server:', error.message);
  process.exit(1);
});
