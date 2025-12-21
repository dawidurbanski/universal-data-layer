#!/usr/bin/env node

import { main } from '../dist/src/cli.js';

main().catch((error) => {
  console.error('Unexpected error:', error.message);
  process.exit(1);
});
