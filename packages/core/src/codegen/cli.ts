#!/usr/bin/env node
/**
 * UDL Codegen CLI
 *
 * Command-line interface for generating TypeScript types and type guards
 * from various sources.
 */

import { existsSync, readFileSync } from 'fs';
import { resolve, extname } from 'path';
import { pathToFileURL } from 'url';
import { watch as chokidarWatch } from 'chokidar';

import { TypeScriptGenerator } from './generators/typescript.js';
import { TypeGuardGenerator } from './generators/type-guards.js';
import { FileWriter } from './output/file-writer.js';
import { introspectGraphQLSchema } from './inference/from-graphql.js';
import { inferSchemaFromJsonString } from './inference/from-response.js';
import type { ContentTypeDefinition, CodegenConfig } from './types/schema.js';

/**
 * CLI options parsed from command line arguments
 */
interface CliOptions {
  // Source options
  endpoint?: string;
  fromResponse?: string;
  fromStore?: boolean;
  typeName?: string;

  // Output options
  output: string;
  guards: boolean;

  // Behavior options
  watch: boolean;
  clean: boolean;
  dryRun: boolean;

  // Config
  config?: string;

  // Other
  help: boolean;
  version: boolean;

  // Generator options
  includeInternal: boolean;
  includeJsDoc: boolean;
  exportFormat: 'interface' | 'type';
}

/**
 * Default CLI options
 */
const DEFAULT_OPTIONS: CliOptions = {
  output: './generated',
  guards: false,
  watch: false,
  clean: false,
  dryRun: false,
  help: false,
  version: false,
  includeInternal: true,
  includeJsDoc: true,
  exportFormat: 'interface',
};

/**
 * Parse command line arguments
 */
export function parseArgs(args: string[]): CliOptions {
  const options: CliOptions = { ...DEFAULT_OPTIONS };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const nextArg = args[i + 1];

    switch (arg) {
      // Source options
      case '--endpoint':
      case '-e':
        if (nextArg) {
          options.endpoint = nextArg;
          i++;
        }
        break;

      case '--from-response':
      case '-r':
        if (nextArg) {
          options.fromResponse = nextArg;
          i++;
        }
        break;

      case '--from-store':
      case '-s':
        options.fromStore = true;
        break;

      case '--type':
      case '-t':
        if (nextArg) {
          options.typeName = nextArg;
          i++;
        }
        break;

      // Output options
      case '--output':
      case '-o':
        options.output = nextArg ?? DEFAULT_OPTIONS.output;
        i++;
        break;

      case '--guards':
      case '-g':
        options.guards = true;
        break;

      // Behavior options
      case '--watch':
      case '-w':
        options.watch = true;
        break;

      case '--clean':
      case '-c':
        options.clean = true;
        break;

      case '--dry-run':
      case '-d':
        options.dryRun = true;
        break;

      // Config
      case '--config':
      case '-C':
        if (nextArg) {
          options.config = nextArg;
          i++;
        }
        break;

      // Generator options
      case '--no-internal':
        options.includeInternal = false;
        break;

      case '--no-jsdoc':
        options.includeJsDoc = false;
        break;

      case '--export-type':
        options.exportFormat = 'type';
        break;

      // Other
      case '--help':
      case '-h':
        options.help = true;
        break;

      case '--version':
      case '-v':
        options.version = true;
        break;
    }
  }

  return options;
}

/**
 * Print help message
 */
export function printHelp(): void {
  console.log(`
UDL Codegen - Generate TypeScript types from various sources

Usage:
  udl-codegen [options]

Source Options:
  -e, --endpoint <url>      GraphQL endpoint to introspect
  -r, --from-response <file> JSON file to infer types from
  -t, --type <name>         Type name for response inference
  -s, --from-store          Infer from UDL node store (requires running server)

Output Options:
  -o, --output <path>       Output directory or file (default: ./generated)
  -g, --guards              Generate type guard functions

Behavior Options:
  -w, --watch               Watch for changes and regenerate
  -c, --clean               Remove generated files
  -d, --dry-run             Preview without writing files

Config Options:
  -C, --config <file>       Path to config file (default: udl.config.ts)

Generator Options:
  --no-extend-node          Don't extend UDL Node interface
  --no-jsdoc                Don't include JSDoc comments
  --export-type             Use 'type' instead of 'interface'

Other:
  -h, --help                Show this help message
  -v, --version             Show version number

Examples:
  # Generate types from GraphQL endpoint
  udl-codegen --endpoint http://localhost:4000/graphql

  # Generate types with guards
  udl-codegen -e http://localhost:4000/graphql --guards

  # Generate from JSON response file
  udl-codegen --from-response ./samples/product.json --type Product

  # Clean generated files
  udl-codegen --clean

  # Preview what would be generated
  udl-codegen -e http://localhost:4000/graphql --dry-run
`);
}

/**
 * Print version
 */
export function printVersion(): void {
  // Read version from package.json
  try {
    const pkgPath = resolve(import.meta.dirname ?? '.', '../package.json');
    if (existsSync(pkgPath)) {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8')) as {
        version?: string;
      };
      console.log(`udl-codegen v${pkg.version ?? '0.0.0'}`);
    } else {
      console.log('udl-codegen v0.1.0');
    }
  } catch {
    console.log('udl-codegen v0.1.0');
  }
}

/**
 * Load configuration from file
 */
export async function loadConfig(
  configPath?: string
): Promise<CodegenConfig | null> {
  const searchPaths = configPath
    ? [configPath]
    : ['udl.config.ts', 'udl.config.js', 'udl.config.mjs'];

  for (const searchPath of searchPaths) {
    const fullPath = resolve(process.cwd(), searchPath);
    if (existsSync(fullPath)) {
      try {
        const ext = extname(fullPath);
        if (ext === '.ts') {
          // For TypeScript config, we need tsx or ts-node
          // For now, skip TS config and use JS
          console.warn(
            `Warning: TypeScript config not supported yet. Use .js or .mjs`
          );
          continue;
        }

        const configUrl = pathToFileURL(fullPath).href;
        const module = (await import(configUrl)) as {
          default?: { codegen?: CodegenConfig };
          codegen?: CodegenConfig;
        };
        return module.default?.codegen ?? module.codegen ?? null;
      } catch (err) {
        console.error(`Error loading config from ${fullPath}:`, err);
      }
    }
  }

  return null;
}

/**
 * Merge CLI options with config file
 */
export function mergeConfig(
  cliOptions: CliOptions,
  fileConfig: CodegenConfig | null
): CliOptions {
  if (!fileConfig) return cliOptions;

  return {
    ...cliOptions,
    output:
      cliOptions.output !== DEFAULT_OPTIONS.output
        ? cliOptions.output
        : (fileConfig.output ?? cliOptions.output),
    guards: cliOptions.guards || fileConfig.guards || false,
    includeInternal: fileConfig.includeInternal ?? cliOptions.includeInternal,
    includeJsDoc: fileConfig.includeJsDoc ?? cliOptions.includeJsDoc,
    exportFormat: fileConfig.exportFormat ?? cliOptions.exportFormat,
  };
}

/**
 * Run the clean command
 */
export function runClean(options: CliOptions): void {
  const writer = new FileWriter({ output: options.output });
  const result = writer.clean();

  if (result.deleted.length > 0) {
    console.log('Cleaned files:');
    for (const file of result.deleted) {
      console.log(`  - ${file}`);
    }
  } else {
    console.log('No files to clean.');
  }
}

/**
 * Generate code from schemas
 */
export function generateCode(
  schemas: ContentTypeDefinition[],
  options: CliOptions
): {
  types: string;
  guards?: string;
} {
  // Generate types
  const tsGenerator = new TypeScriptGenerator({
    includeInternal: options.includeInternal,
    includeJsDoc: options.includeJsDoc,
    exportFormat: options.exportFormat,
  });
  const types = tsGenerator.generate(schemas);

  // Generate guards if requested
  let guards: string | undefined;
  if (options.guards) {
    const guardsGenerator = new TypeGuardGenerator({
      includeJsDoc: options.includeJsDoc,
    });
    guards = guardsGenerator.generate(schemas);
  }

  const result: { types: string; guards?: string } = {
    types,
  };
  if (guards) {
    result.guards = guards;
  }
  return result;
}

/**
 * Write generated code to files
 */
export function writeCode(
  schemas: ContentTypeDefinition[],
  code: { types: string; guards?: string },
  options: CliOptions
): void {
  const writer = new FileWriter({ output: options.output });

  const files: Parameters<FileWriter['writeAll']>[0] = {
    types: { schemas, code: code.types },
  };

  if (code.guards) {
    files.guards = { schemas, code: code.guards };
  }

  const result = writer.writeAll(files);

  if (result.written.length > 0) {
    console.log('Generated files:');
    for (const file of result.written) {
      console.log(`  + ${file}`);
    }
  }

  if (result.skipped.length > 0) {
    console.log('Unchanged files:');
    for (const file of result.skipped) {
      console.log(`  = ${file}`);
    }
  }
}

/**
 * Run the generate command
 */
export async function runGenerate(options: CliOptions): Promise<void> {
  let schemas: ContentTypeDefinition[] = [];

  // Get schemas from source
  if (options.endpoint) {
    console.log(`Introspecting GraphQL endpoint: ${options.endpoint}`);
    schemas = await introspectGraphQLSchema(options.endpoint);
    console.log(`Found ${schemas.length} types`);
  } else if (options.fromResponse) {
    if (!options.typeName) {
      console.error('Error: --type is required when using --from-response');
      process.exit(1);
    }

    console.log(`Inferring schema from: ${options.fromResponse}`);
    const filePath = resolve(process.cwd(), options.fromResponse);

    if (!existsSync(filePath)) {
      console.error(`Error: File not found: ${filePath}`);
      process.exit(1);
    }

    const json = readFileSync(filePath, 'utf-8');
    const schema = inferSchemaFromJsonString(json, options.typeName);
    schemas = [schema];
    console.log(`Inferred type: ${schema.name}`);
  } else {
    console.error(
      'Error: No source specified. Use --endpoint or --from-response'
    );
    console.log('Run udl-codegen --help for usage information');
    process.exit(1);
  }

  if (schemas.length === 0) {
    console.log('No schemas found. Nothing to generate.');
    return;
  }

  // Generate code
  const code = generateCode(schemas, options);

  // Dry run - just preview
  if (options.dryRun) {
    console.log('\n--- Types ---');
    console.log(code.types);

    if (code.guards) {
      console.log('\n--- Guards ---');
      console.log(code.guards);
    }

    console.log('\n(dry-run mode - no files written)');
    return;
  }

  // Write files
  writeCode(schemas, code, options);
}

/**
 * Run watch mode - watches source files and regenerates on changes
 */
async function runWatch(options: CliOptions): Promise<void> {
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

/**
 * Main CLI entry point
 */
export async function main(
  args: string[] = process.argv.slice(2)
): Promise<void> {
  try {
    // Parse command line arguments
    const cliOptions = parseArgs(args);

    // Handle help and version
    if (cliOptions.help) {
      printHelp();
      return;
    }

    if (cliOptions.version) {
      printVersion();
      return;
    }

    // Load config file
    const fileConfig = await loadConfig(cliOptions.config);

    // Merge options
    const options = mergeConfig(cliOptions, fileConfig);

    // Run clean if requested
    if (options.clean) {
      runClean(options);
      return;
    }

    // Watch mode
    if (options.watch) {
      await runWatch(options);
      return;
    }

    // Run generate
    await runGenerate(options);
  } catch (err) {
    console.error('Error:', err instanceof Error ? err.message : err);
    process.exit(1);
  }
}

// Run if executed directly
const isMainModule =
  import.meta.url === pathToFileURL(process.argv[1] ?? '').href;
if (isMainModule) {
  main();
}
