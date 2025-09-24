#!/usr/bin/env node

import { parseArgs } from 'node:util';
import server from '../dist/src/server.js';

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

const port = parseInt(values.port, 10);

if (isNaN(port) || port < 1 || port > 65535) {
  console.error(`Error: Invalid port number "${values.port}". Port must be between 1 and 65535.`);
  process.exit(1);
}

server.listen(port);
console.log(`Universal Data Layer server listening on port ${port}`);
console.log(`GraphQL server available at http://localhost:${port}/graphql`);
console.log(`GraphiQL interface available at http://localhost:${port}/graphiql`);