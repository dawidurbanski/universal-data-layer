#!/usr/bin/env node
/**
 * UDL Codegen CLI entry point
 *
 * This file is the executable entry point for the CLI.
 * It imports and runs the main function from the compiled TypeScript.
 */

import { main } from '../dist/cli.js';

main();
