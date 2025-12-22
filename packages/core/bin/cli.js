#!/usr/bin/env node

import { parseArgs } from 'node:util';
import { startServer } from '../dist/src/start-server.js';

// Note: .env loading is handled automatically by startServer via loadEnv()

const { values } = parseArgs({
  options: {
    port: {
      type: 'string',
      short: 'p',
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
