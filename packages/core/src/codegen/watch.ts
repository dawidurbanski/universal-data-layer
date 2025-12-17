/**
 * Watch mode functionality for UDL Codegen CLI
 *
 * This module is intentionally excluded from coverage as it contains
 * patterns that are inherently difficult to test:
 * - Infinite promises (await new Promise(() => {}))
 * - Process signal handlers (SIGINT, SIGTERM)
 * - File watchers (chokidar)
 * - setInterval polling
 *
 * @module
 */

/* istanbul ignore file */

import { existsSync } from 'fs';
import { resolve } from 'path';
import { watch as chokidarWatch } from 'chokidar';

import { introspectGraphQLSchema } from './inference/from-graphql.js';
import type { CliOptions } from './cli.js';
import { runGenerate, generateCode, writeCode } from './cli.js';

/**
 * Run watch mode - watches source files and regenerates on changes
 */
export async function runWatch(options: CliOptions): Promise<void> {
  // Determine what to watch
  const watchPaths: string[] = [];

  if (options.fromResponse) {
    const filePath = resolve(process.cwd(), options.fromResponse);
    if (existsSync(filePath)) {
      watchPaths.push(filePath);
    }
  }

  // Also watch config files
  const configPaths = ['udl.config.ts', 'udl.config.js', 'udl.config.mjs'];
  for (const configPath of configPaths) {
    const fullPath = resolve(process.cwd(), configPath);
    if (existsSync(fullPath)) {
      watchPaths.push(fullPath);
    }
  }

  if (watchPaths.length === 0 && !options.endpoint) {
    console.error(
      'Watch mode requires --from-response with a file path, or a config file to watch.'
    );
    console.log(
      'Note: --endpoint with watch mode will poll the endpoint every 5 seconds.'
    );
    process.exit(1);
  }

  // Run initial generation
  console.log('Running initial generation...');
  try {
    await runGenerate(options);
  } catch (err) {
    console.error('Initial generation failed:', err);
  }

  // Set up file watcher if we have paths to watch
  if (watchPaths.length > 0) {
    console.log(`\nWatching for changes:`);
    for (const p of watchPaths) {
      console.log(`  - ${p}`);
    }
    console.log('\nPress Ctrl+C to stop.\n');

    const watcher = chokidarWatch(watchPaths, {
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: 100,
        pollInterval: 50,
      },
    });

    let isGenerating = false;

    const regenerate = async (path: string) => {
      if (isGenerating) return;
      isGenerating = true;

      console.log(`\nFile changed: ${path}`);
      console.log('Regenerating...');

      try {
        await runGenerate(options);
        console.log('Done.\n');
      } catch (err) {
        console.error('Generation failed:', err);
      } finally {
        isGenerating = false;
      }
    };

    watcher.on('change', regenerate);
    watcher.on('add', regenerate);

    // Handle graceful shutdown
    const cleanup = () => {
      console.log('\nStopping watch mode...');
      watcher.close().then(() => {
        console.log('Goodbye!');
        process.exit(0);
      });
    };

    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);

    // Keep the process running
    await new Promise(() => {});
  }

  // If only endpoint mode, poll periodically
  if (options.endpoint && watchPaths.length === 0) {
    const pollInterval = 5000; // 5 seconds
    console.log(
      `\nPolling endpoint every ${pollInterval / 1000}s: ${options.endpoint}`
    );
    console.log('Press Ctrl+C to stop.\n');

    let isGenerating = false;
    let lastHash = '';

    const poll = async () => {
      if (isGenerating) return;
      isGenerating = true;

      try {
        const schemas = await introspectGraphQLSchema(options.endpoint!);
        const hash = JSON.stringify(schemas);

        if (hash !== lastHash) {
          lastHash = hash;
          console.log('Schema changed, regenerating...');
          const code = generateCode(schemas, options);
          writeCode(schemas, code, options);
          console.log('Done.\n');
        }
      } catch (err) {
        console.error('Poll failed:', err);
      } finally {
        isGenerating = false;
      }
    };

    const intervalId = setInterval(poll, pollInterval);

    // Handle graceful shutdown
    const cleanup = () => {
      console.log('\nStopping watch mode...');
      clearInterval(intervalId);
      console.log('Goodbye!');
      process.exit(0);
    };

    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);

    // Keep the process running
    await new Promise(() => {});
  }
}
