import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import {
  parseArgs,
  printHelp,
  printVersion,
  mergeConfig,
  runClean,
  generateCode,
  writeCode,
  loadConfig,
  runGenerate,
  main,
} from '@/codegen/cli.js';
import type { ContentTypeDefinition } from '@/codegen/types/schema.js';

// Mock the external modules
vi.mock('@/codegen/inference/from-graphql.js', () => ({
  introspectGraphQLSchema: vi.fn(),
}));

vi.mock('@/codegen/inference/from-response.js', () => ({
  inferSchemaFromJsonString: vi.fn(),
}));

// Mock the watch module (watch functionality is in a separate file excluded from coverage)
vi.mock('@/codegen/watch.js', () => ({
  runWatch: vi.fn(),
}));

describe('CLI', () => {
  describe('parseArgs', () => {
    it('should return default options with no arguments', () => {
      const options = parseArgs([]);

      expect(options.output).toBe('./generated');
      expect(options.guards).toBe(false);
      expect(options.watch).toBe(false);
      expect(options.clean).toBe(false);
      expect(options.dryRun).toBe(false);
      expect(options.help).toBe(false);
      expect(options.version).toBe(false);
    });

    it('should parse --endpoint', () => {
      const options = parseArgs([
        '--endpoint',
        'http://localhost:4000/graphql',
      ]);

      expect(options.endpoint).toBe('http://localhost:4000/graphql');
    });

    it('should parse -e shorthand', () => {
      const options = parseArgs(['-e', 'http://localhost:4000/graphql']);

      expect(options.endpoint).toBe('http://localhost:4000/graphql');
    });

    it('should parse --from-response', () => {
      const options = parseArgs(['--from-response', './sample.json']);

      expect(options.fromResponse).toBe('./sample.json');
    });

    it('should parse -r shorthand', () => {
      const options = parseArgs(['-r', './sample.json']);

      expect(options.fromResponse).toBe('./sample.json');
    });

    it('should parse --type', () => {
      const options = parseArgs(['--type', 'Product']);

      expect(options.typeName).toBe('Product');
    });

    it('should parse -t shorthand', () => {
      const options = parseArgs(['-t', 'Product']);

      expect(options.typeName).toBe('Product');
    });

    it('should parse --output', () => {
      const options = parseArgs(['--output', './custom']);

      expect(options.output).toBe('./custom');
    });

    it('should parse -o shorthand', () => {
      const options = parseArgs(['-o', './custom']);

      expect(options.output).toBe('./custom');
    });

    it('should parse --guards', () => {
      const options = parseArgs(['--guards']);

      expect(options.guards).toBe(true);
    });

    it('should parse -g shorthand', () => {
      const options = parseArgs(['-g']);

      expect(options.guards).toBe(true);
    });

    it('should parse --watch', () => {
      const options = parseArgs(['--watch']);

      expect(options.watch).toBe(true);
    });

    it('should parse --clean', () => {
      const options = parseArgs(['--clean']);

      expect(options.clean).toBe(true);
    });

    it('should parse --dry-run', () => {
      const options = parseArgs(['--dry-run']);

      expect(options.dryRun).toBe(true);
    });

    it('should parse --config', () => {
      const options = parseArgs(['--config', './custom.config.js']);

      expect(options.config).toBe('./custom.config.js');
    });

    it('should parse --no-internal', () => {
      const options = parseArgs(['--no-internal']);

      expect(options.includeInternal).toBe(false);
    });

    it('should parse --no-jsdoc', () => {
      const options = parseArgs(['--no-jsdoc']);

      expect(options.includeJsDoc).toBe(false);
    });

    it('should parse --export-type', () => {
      const options = parseArgs(['--export-type']);

      expect(options.exportFormat).toBe('type');
    });

    it('should parse --help', () => {
      const options = parseArgs(['--help']);

      expect(options.help).toBe(true);
    });

    it('should parse --version', () => {
      const options = parseArgs(['--version']);

      expect(options.version).toBe(true);
    });

    it('should parse multiple arguments', () => {
      const options = parseArgs([
        '-e',
        'http://localhost:4000/graphql',
        '--guards',
        '-o',
        './output',
      ]);

      expect(options.endpoint).toBe('http://localhost:4000/graphql');
      expect(options.guards).toBe(true);
      expect(options.output).toBe('./output');
    });
  });

  describe('printHelp', () => {
    it('should not throw', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      expect(() => printHelp()).not.toThrow();
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe('printVersion', () => {
    it('should not throw', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      expect(() => printVersion()).not.toThrow();
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('should print version string', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      printVersion();

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('udl-codegen')
      );

      consoleSpy.mockRestore();
    });
  });

  describe('mergeConfig', () => {
    it('should return CLI options when no file config', () => {
      const cliOptions = parseArgs(['--guards']);

      const merged = mergeConfig(cliOptions, null);

      expect(merged).toEqual(cliOptions);
    });

    it('should merge file config with CLI options', () => {
      const cliOptions = parseArgs([]);
      const fileConfig = {
        output: './custom-output',
        guards: true,
      };

      const merged = mergeConfig(cliOptions, fileConfig);

      expect(merged.output).toBe('./custom-output');
      expect(merged.guards).toBe(true);
    });

    it('should prefer CLI options over file config for output', () => {
      const cliOptions = parseArgs(['-o', './cli-output']);
      const fileConfig = {
        output: './file-output',
      };

      const merged = mergeConfig(cliOptions, fileConfig);

      expect(merged.output).toBe('./cli-output');
    });

    it('should merge guards from file config', () => {
      const cliOptions = parseArgs([]);
      const fileConfig = {
        guards: true,
      };

      const merged = mergeConfig(cliOptions, fileConfig);

      expect(merged.guards).toBe(true);
    });
  });

  describe('generateCode', () => {
    const schemas: ContentTypeDefinition[] = [
      {
        name: 'Product',
        fields: [
          { name: 'name', type: 'string', required: true },
          { name: 'price', type: 'number', required: true },
        ],
      },
    ];

    it('should generate types', () => {
      const options = parseArgs([]);

      const code = generateCode(schemas, options);

      expect(code.types).toContain('export interface Product');
      expect(code.types).toContain('name: string');
      expect(code.types).toContain('price: number');
    });

    it('should not generate guards by default', () => {
      const options = parseArgs([]);

      const code = generateCode(schemas, options);

      expect(code.guards).toBeUndefined();
    });

    it('should generate guards when requested', () => {
      const options = parseArgs(['--guards']);

      const code = generateCode(schemas, options);

      expect(code.guards).toBeDefined();
      expect(code.guards).toContain('export function isProduct');
    });

    it('should respect --no-jsdoc', () => {
      const schemasWithDesc: ContentTypeDefinition[] = [
        {
          name: 'Product',
          description: 'A product type',
          fields: [
            {
              name: 'name',
              type: 'string',
              required: true,
              description: 'The name',
            },
          ],
        },
      ];
      const options = parseArgs(['--no-jsdoc']);

      const code = generateCode(schemasWithDesc, options);

      // Should not contain type/field JSDoc (but file header is still there)
      expect(code.types).not.toContain('/** A product type */');
      expect(code.types).not.toContain('/** The name */');
    });

    it('should respect --no-internal', () => {
      const options = parseArgs(['--no-internal']);

      const code = generateCode(schemas, options);

      expect(code.types).not.toContain('internal:');
      expect(code.types).not.toContain('NodeInternal');
    });

    it('should respect --export-type', () => {
      const options = parseArgs(['--export-type']);

      const code = generateCode(schemas, options);

      expect(code.types).toContain('export type Product');
      expect(code.types).not.toContain('export interface');
    });
  });

  describe('runClean', () => {
    let tempDir: string;

    beforeEach(() => {
      tempDir = join(
        tmpdir(),
        `udl-codegen-cli-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
      );
      mkdirSync(tempDir, { recursive: true });
    });

    afterEach(() => {
      if (existsSync(tempDir)) {
        rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it('should clean generated files', () => {
      const output = join(tempDir, 'generated');
      mkdirSync(join(output, 'types'), { recursive: true });
      writeFileSync(join(output, 'types', 'product.ts'), 'test');

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const options = parseArgs(['-o', output]);

      runClean(options);

      expect(existsSync(join(output, 'types'))).toBe(false);

      consoleSpy.mockRestore();
    });

    it('should handle no files to clean', () => {
      const output = join(tempDir, 'nonexistent');
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const options = parseArgs(['-o', output]);

      expect(() => runClean(options)).not.toThrow();

      consoleSpy.mockRestore();
    });
  });

  describe('writeCode', () => {
    let tempDir: string;

    beforeEach(() => {
      tempDir = join(
        tmpdir(),
        `udl-codegen-cli-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
      );
      mkdirSync(tempDir, { recursive: true });
    });

    afterEach(() => {
      if (existsSync(tempDir)) {
        rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it('should write generated code to files', () => {
      const output = join(tempDir, 'generated');
      const schemas: ContentTypeDefinition[] = [
        {
          name: 'Product',
          fields: [{ name: 'name', type: 'string', required: true }],
        },
      ];
      const code = {
        types: 'export interface Product { name: string; }',
      };
      const options = parseArgs(['-o', output]);
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      writeCode(schemas, code, options);

      expect(existsSync(join(output, 'types'))).toBe(true);

      consoleSpy.mockRestore();
    });

    it('should write guards when provided', () => {
      const output = join(tempDir, 'generated');
      const schemas: ContentTypeDefinition[] = [
        {
          name: 'Product',
          fields: [{ name: 'name', type: 'string', required: true }],
        },
      ];
      const code = {
        types: 'export interface Product { name: string; }',
        guards: 'export function isProduct() { return true; }',
      };
      const options = parseArgs(['-o', output, '--guards']);
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      writeCode(schemas, code, options);

      expect(existsSync(join(output, 'guards'))).toBe(true);

      consoleSpy.mockRestore();
    });

    it('should log skipped files when content is unchanged', () => {
      const output = join(tempDir, 'generated');
      const schemas: ContentTypeDefinition[] = [
        {
          name: 'Product',
          fields: [{ name: 'name', type: 'string', required: true }],
        },
      ];
      const code = {
        types: 'export interface Product { name: string; }',
      };
      const options = parseArgs(['-o', output]);
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      // Write twice to trigger skipped path
      writeCode(schemas, code, options);
      writeCode(schemas, code, options);

      // Should log "Unchanged files:" on second call
      expect(consoleSpy).toHaveBeenCalledWith('Unchanged files:');

      consoleSpy.mockRestore();
    });
  });

  describe('loadConfig', () => {
    let tempDir: string;

    beforeEach(() => {
      tempDir = join(
        tmpdir(),
        `udl-codegen-cli-config-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
      );
      mkdirSync(tempDir, { recursive: true });
    });

    afterEach(() => {
      if (existsSync(tempDir)) {
        rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it('should return null when no config file exists', async () => {
      const cwd = process.cwd();
      process.chdir(tempDir);
      try {
        const config = await loadConfig();
        expect(config).toBeNull();
      } finally {
        process.chdir(cwd);
      }
    });

    it('should return null for explicit config path that does not exist', async () => {
      const config = await loadConfig('./nonexistent.config.js');
      expect(config).toBeNull();
    });

    it('should warn and skip TypeScript config files', async () => {
      const cwd = process.cwd();
      process.chdir(tempDir);

      // Create a TypeScript config file
      writeFileSync(join(tempDir, 'udl.config.ts'), 'export default {}');

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      try {
        const config = await loadConfig();
        expect(warnSpy).toHaveBeenCalledWith(
          expect.stringContaining('TypeScript config not supported yet')
        );
        expect(config).toBeNull();
      } finally {
        process.chdir(cwd);
        warnSpy.mockRestore();
      }
    });

    it('should load and return codegen config from JavaScript module', async () => {
      const cwd = process.cwd();
      process.chdir(tempDir);

      // Create a JavaScript config file
      const configContent = `
        export default {
          codegen: {
            output: './custom-output',
            guards: true,
          }
        };
      `;
      writeFileSync(join(tempDir, 'udl.config.mjs'), configContent);

      try {
        const config = await loadConfig();
        expect(config).toEqual({
          output: './custom-output',
          guards: true,
        });
      } finally {
        process.chdir(cwd);
      }
    });

    it('should load codegen from top-level export', async () => {
      const cwd = process.cwd();
      process.chdir(tempDir);

      // Create a JavaScript config file with top-level export
      const configContent = `
        export const codegen = {
          output: './from-export',
          guards: false,
        };
      `;
      writeFileSync(join(tempDir, 'udl.config.mjs'), configContent);

      try {
        const config = await loadConfig();
        expect(config).toEqual({
          output: './from-export',
          guards: false,
        });
      } finally {
        process.chdir(cwd);
      }
    });

    it('should handle config file import errors', async () => {
      const cwd = process.cwd();
      process.chdir(tempDir);

      // Create a malformed JavaScript config file
      writeFileSync(join(tempDir, 'udl.config.mjs'), 'export default {');

      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      try {
        const config = await loadConfig();
        expect(errorSpy).toHaveBeenCalledWith(
          expect.stringContaining('Error loading config'),
          expect.anything()
        );
        expect(config).toBeNull();
      } finally {
        process.chdir(cwd);
        errorSpy.mockRestore();
      }
    });

    it('should return null when module has no codegen export', async () => {
      const cwd = process.cwd();
      process.chdir(tempDir);

      // Create a JavaScript config file without codegen export
      const configContent = `
        export default {
          someOtherConfig: true,
        };
      `;
      writeFileSync(join(tempDir, 'udl.config.mjs'), configContent);

      try {
        const config = await loadConfig();
        expect(config).toBeNull();
      } finally {
        process.chdir(cwd);
      }
    });
  });

  describe('runGenerate', () => {
    let tempDir: string;

    beforeEach(async () => {
      tempDir = join(
        tmpdir(),
        `udl-codegen-cli-generate-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
      );
      mkdirSync(tempDir, { recursive: true });

      // Reset mocks
      const { introspectGraphQLSchema } = await import(
        '@/codegen/inference/from-graphql.js'
      );
      const { inferSchemaFromJsonString } = await import(
        '@/codegen/inference/from-response.js'
      );
      vi.mocked(introspectGraphQLSchema).mockReset();
      vi.mocked(inferSchemaFromJsonString).mockReset();
    });

    afterEach(() => {
      if (existsSync(tempDir)) {
        rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it('should generate types from GraphQL endpoint', async () => {
      const { introspectGraphQLSchema } = await import(
        '@/codegen/inference/from-graphql.js'
      );

      const schemas: ContentTypeDefinition[] = [
        {
          name: 'Product',
          fields: [{ name: 'name', type: 'string', required: true }],
        },
      ];

      vi.mocked(introspectGraphQLSchema).mockResolvedValue(schemas);

      const output = join(tempDir, 'generated');
      const options = parseArgs([
        '-e',
        'http://localhost:4000/graphql',
        '-o',
        output,
      ]);
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await runGenerate(options);

      expect(introspectGraphQLSchema).toHaveBeenCalledWith(
        'http://localhost:4000/graphql'
      );
      expect(existsSync(join(output, 'types'))).toBe(true);

      consoleSpy.mockRestore();
    });

    it('should generate types from JSON response file', async () => {
      const { inferSchemaFromJsonString } = await import(
        '@/codegen/inference/from-response.js'
      );

      const schema: ContentTypeDefinition = {
        name: 'Product',
        fields: [{ name: 'name', type: 'string', required: true }],
      };

      vi.mocked(inferSchemaFromJsonString).mockReturnValue(schema);

      const jsonFile = join(tempDir, 'product.json');
      writeFileSync(jsonFile, JSON.stringify({ name: 'Test Product' }));

      const output = join(tempDir, 'generated');
      const options = parseArgs([
        '-r',
        jsonFile,
        '-t',
        'Product',
        '-o',
        output,
      ]);
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await runGenerate(options);

      expect(inferSchemaFromJsonString).toHaveBeenCalled();
      expect(existsSync(join(output, 'types'))).toBe(true);

      consoleSpy.mockRestore();
    });

    it('should error when --from-response is used without --type', async () => {
      const jsonFile = join(tempDir, 'product.json');
      writeFileSync(jsonFile, JSON.stringify({ name: 'Test' }));

      const options = parseArgs(['-r', jsonFile]);
      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit called');
      });

      try {
        await runGenerate(options);
      } catch {
        // Expected
      }

      expect(consoleSpy).toHaveBeenCalledWith(
        'Error: --type is required when using --from-response'
      );

      consoleSpy.mockRestore();
      exitSpy.mockRestore();
    });

    it('should error when --from-response file does not exist', async () => {
      const options = parseArgs(['-r', './nonexistent.json', '-t', 'Product']);
      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit called');
      });

      try {
        await runGenerate(options);
      } catch {
        // Expected
      }

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error: File not found:')
      );

      consoleSpy.mockRestore();
      exitSpy.mockRestore();
    });

    it('should error when no source is specified', async () => {
      const options = parseArgs([]);
      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit called');
      });

      try {
        await runGenerate(options);
      } catch {
        // Expected
      }

      expect(consoleSpy).toHaveBeenCalledWith(
        'Error: No source specified. Use --endpoint or --from-response'
      );
      expect(logSpy).toHaveBeenCalledWith(
        'Run udl-codegen --help for usage information'
      );

      consoleSpy.mockRestore();
      logSpy.mockRestore();
      exitSpy.mockRestore();
    });

    it('should handle empty schemas', async () => {
      const { introspectGraphQLSchema } = await import(
        '@/codegen/inference/from-graphql.js'
      );

      vi.mocked(introspectGraphQLSchema).mockResolvedValue([]);

      const options = parseArgs(['-e', 'http://localhost:4000/graphql']);
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await runGenerate(options);

      expect(consoleSpy).toHaveBeenCalledWith(
        'No schemas found. Nothing to generate.'
      );

      consoleSpy.mockRestore();
    });

    it('should preview output in dry-run mode', async () => {
      const { introspectGraphQLSchema } = await import(
        '@/codegen/inference/from-graphql.js'
      );

      const schemas: ContentTypeDefinition[] = [
        {
          name: 'Product',
          fields: [{ name: 'name', type: 'string', required: true }],
        },
      ];

      vi.mocked(introspectGraphQLSchema).mockResolvedValue(schemas);

      const options = parseArgs([
        '-e',
        'http://localhost:4000/graphql',
        '--dry-run',
      ]);
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await runGenerate(options);

      expect(consoleSpy).toHaveBeenCalledWith('\n--- Types ---');
      expect(consoleSpy).toHaveBeenCalledWith(
        '\n(dry-run mode - no files written)'
      );

      consoleSpy.mockRestore();
    });

    it('should preview guards in dry-run mode when requested', async () => {
      const { introspectGraphQLSchema } = await import(
        '@/codegen/inference/from-graphql.js'
      );

      const schemas: ContentTypeDefinition[] = [
        {
          name: 'Product',
          fields: [{ name: 'name', type: 'string', required: true }],
        },
      ];

      vi.mocked(introspectGraphQLSchema).mockResolvedValue(schemas);

      const options = parseArgs([
        '-e',
        'http://localhost:4000/graphql',
        '--dry-run',
        '--guards',
      ]);
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await runGenerate(options);

      expect(consoleSpy).toHaveBeenCalledWith('\n--- Guards ---');

      consoleSpy.mockRestore();
    });
  });

  describe('main', () => {
    let tempDir: string;

    beforeEach(async () => {
      tempDir = join(
        tmpdir(),
        `udl-codegen-cli-main-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
      );
      mkdirSync(tempDir, { recursive: true });

      // Reset mocks
      const { introspectGraphQLSchema } = await import(
        '@/codegen/inference/from-graphql.js'
      );
      vi.mocked(introspectGraphQLSchema).mockReset();
    });

    afterEach(() => {
      if (existsSync(tempDir)) {
        rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it('should print help when --help is passed', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await main(['--help']);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('UDL Codegen')
      );

      consoleSpy.mockRestore();
    });

    it('should print version when --version is passed', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await main(['--version']);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('udl-codegen')
      );

      consoleSpy.mockRestore();
    });

    it('should run clean when --clean is passed', async () => {
      const output = join(tempDir, 'generated');
      mkdirSync(join(output, 'types'), { recursive: true });
      writeFileSync(join(output, 'types', 'test.ts'), 'test');

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await main(['--clean', '-o', output]);

      expect(existsSync(join(output, 'types'))).toBe(false);

      consoleSpy.mockRestore();
    });

    it('should run generate when no special flags are passed', async () => {
      const { introspectGraphQLSchema } = await import(
        '@/codegen/inference/from-graphql.js'
      );

      const schemas: ContentTypeDefinition[] = [
        {
          name: 'Product',
          fields: [{ name: 'name', type: 'string', required: true }],
        },
      ];

      vi.mocked(introspectGraphQLSchema).mockResolvedValue(schemas);

      const output = join(tempDir, 'generated');
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await main(['-e', 'http://localhost:4000/graphql', '-o', output]);

      expect(existsSync(join(output, 'types'))).toBe(true);

      consoleSpy.mockRestore();
    });

    it('should load config file and merge with CLI options', async () => {
      const { introspectGraphQLSchema } = await import(
        '@/codegen/inference/from-graphql.js'
      );

      const schemas: ContentTypeDefinition[] = [
        {
          name: 'Product',
          fields: [{ name: 'name', type: 'string', required: true }],
        },
      ];

      vi.mocked(introspectGraphQLSchema).mockResolvedValue(schemas);

      const cwd = process.cwd();
      process.chdir(tempDir);

      // Create a config file
      const configContent = `
        export const codegen = {
          output: './config-output',
          guards: true,
        };
      `;
      writeFileSync(join(tempDir, 'udl.config.mjs'), configContent);

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      try {
        await main(['-e', 'http://localhost:4000/graphql']);
        // The output directory should be from config
        expect(existsSync(join(tempDir, 'config-output', 'types'))).toBe(true);
        // Guards should be generated too (from config)
        expect(existsSync(join(tempDir, 'config-output', 'guards'))).toBe(true);
      } finally {
        process.chdir(cwd);
        consoleSpy.mockRestore();
      }
    });

    it('should handle errors gracefully', async () => {
      const { introspectGraphQLSchema } = await import(
        '@/codegen/inference/from-graphql.js'
      );

      vi.mocked(introspectGraphQLSchema).mockRejectedValue(
        new Error('Network error')
      );

      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit called');
      });

      try {
        await main(['-e', 'http://localhost:4000/graphql']);
      } catch {
        // Expected
      }

      expect(consoleSpy).toHaveBeenCalledWith('Error:', 'Network error');

      consoleSpy.mockRestore();
      exitSpy.mockRestore();
    });

    it('should handle non-Error errors gracefully', async () => {
      const { introspectGraphQLSchema } = await import(
        '@/codegen/inference/from-graphql.js'
      );

      vi.mocked(introspectGraphQLSchema).mockRejectedValue('string error');

      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit called');
      });

      try {
        await main(['-e', 'http://localhost:4000/graphql']);
      } catch {
        // Expected
      }

      expect(consoleSpy).toHaveBeenCalledWith('Error:', 'string error');

      consoleSpy.mockRestore();
      exitSpy.mockRestore();
    });
  });

  describe('parseArgs edge cases', () => {
    it('should parse --from-store flag', () => {
      const options = parseArgs(['--from-store']);
      expect(options.fromStore).toBe(true);
    });

    it('should parse -s shorthand for --from-store', () => {
      const options = parseArgs(['-s']);
      expect(options.fromStore).toBe(true);
    });

    it('should parse -w shorthand for --watch', () => {
      const options = parseArgs(['-w']);
      expect(options.watch).toBe(true);
    });

    it('should parse -c shorthand for --clean', () => {
      const options = parseArgs(['-c']);
      expect(options.clean).toBe(true);
    });

    it('should parse -d shorthand for --dry-run', () => {
      const options = parseArgs(['-d']);
      expect(options.dryRun).toBe(true);
    });

    it('should parse -C shorthand for --config', () => {
      const options = parseArgs(['-C', './custom.config.js']);
      expect(options.config).toBe('./custom.config.js');
    });

    it('should parse -h shorthand for --help', () => {
      const options = parseArgs(['-h']);
      expect(options.help).toBe(true);
    });

    it('should parse -v shorthand for --version', () => {
      const options = parseArgs(['-v']);
      expect(options.version).toBe(true);
    });

    it('should handle missing value after --endpoint', () => {
      const options = parseArgs(['--endpoint']);
      expect(options.endpoint).toBeUndefined();
    });

    it('should handle missing value after --from-response', () => {
      const options = parseArgs(['--from-response']);
      expect(options.fromResponse).toBeUndefined();
    });

    it('should handle missing value after --type', () => {
      const options = parseArgs(['--type']);
      expect(options.typeName).toBeUndefined();
    });

    it('should use default output when --output has no value', () => {
      const options = parseArgs(['--output']);
      expect(options.output).toBe('./generated');
    });

    it('should handle missing value after --config', () => {
      const options = parseArgs(['--config']);
      expect(options.config).toBeUndefined();
    });

    it('should ignore unrecognized arguments', () => {
      const options = parseArgs(['--unknown-flag', 'value']);
      expect(options.output).toBe('./generated');
    });
  });

  describe('mergeConfig edge cases', () => {
    it('should merge includeInternal from file config', () => {
      const cliOptions = parseArgs([]);
      const fileConfig = {
        includeInternal: false,
      };

      const merged = mergeConfig(cliOptions, fileConfig);
      expect(merged.includeInternal).toBe(false);
    });

    it('should merge includeJsDoc from file config', () => {
      const cliOptions = parseArgs([]);
      const fileConfig = {
        includeJsDoc: false,
      };

      const merged = mergeConfig(cliOptions, fileConfig);
      expect(merged.includeJsDoc).toBe(false);
    });

    it('should merge exportFormat from file config', () => {
      const cliOptions = parseArgs([]);
      const fileConfig = {
        exportFormat: 'type' as const,
      };

      const merged = mergeConfig(cliOptions, fileConfig);
      expect(merged.exportFormat).toBe('type');
    });

    it('should handle false guards in file config', () => {
      const cliOptions = parseArgs([]);
      const fileConfig = {
        guards: false,
      };

      const merged = mergeConfig(cliOptions, fileConfig);
      expect(merged.guards).toBe(false);
    });
  });

  describe('printVersion edge cases', () => {
    it('should handle missing version in package.json', () => {
      // This tests the fallback when version field is undefined
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      printVersion();

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringMatching(/udl-codegen v\d+\.\d+\.\d+/)
      );

      consoleSpy.mockRestore();
    });
  });

  describe('watch mode', () => {
    it('should call runWatch when --watch is passed', async () => {
      const { runWatch } = await import('@/codegen/watch.js');
      vi.mocked(runWatch).mockResolvedValue(undefined);

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await main(['--watch']);

      expect(runWatch).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });
});
