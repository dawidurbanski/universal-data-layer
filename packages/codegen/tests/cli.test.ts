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
} from '../src/cli.js';
import type { ContentTypeDefinition } from '../src/types/schema.js';

describe('CLI', () => {
  describe('parseArgs', () => {
    it('should return default options with no arguments', () => {
      const options = parseArgs([]);

      expect(options.output).toBe('./generated');
      expect(options.guards).toBe(false);
      expect(options.helpers).toBe(false);
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

    it('should parse --helpers', () => {
      const options = parseArgs(['--helpers']);

      expect(options.helpers).toBe(true);
    });

    it('should parse -H shorthand', () => {
      const options = parseArgs(['-H']);

      expect(options.helpers).toBe(true);
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

    it('should parse --no-extend-node', () => {
      const options = parseArgs(['--no-extend-node']);

      expect(options.extendNode).toBe(false);
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
        '--helpers',
        '-o',
        './output',
      ]);

      expect(options.endpoint).toBe('http://localhost:4000/graphql');
      expect(options.guards).toBe(true);
      expect(options.helpers).toBe(true);
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
        helpers: true,
      };

      const merged = mergeConfig(cliOptions, fileConfig);

      expect(merged.output).toBe('./custom-output');
      expect(merged.guards).toBe(true);
      expect(merged.helpers).toBe(true);
    });

    it('should prefer CLI options over file config for output', () => {
      const cliOptions = parseArgs(['-o', './cli-output']);
      const fileConfig = {
        output: './file-output',
      };

      const merged = mergeConfig(cliOptions, fileConfig);

      expect(merged.output).toBe('./cli-output');
    });

    it('should merge endpoint from file config', () => {
      const cliOptions = parseArgs([]);
      const fileConfig = {
        endpoint: 'http://config-endpoint/graphql',
      };

      const merged = mergeConfig(cliOptions, fileConfig);

      expect(merged.endpoint).toBe('http://config-endpoint/graphql');
    });

    it('should prefer CLI endpoint over file config', () => {
      const cliOptions = parseArgs(['-e', 'http://cli-endpoint/graphql']);
      const fileConfig = {
        endpoint: 'http://config-endpoint/graphql',
      };

      const merged = mergeConfig(cliOptions, fileConfig);

      expect(merged.endpoint).toBe('http://cli-endpoint/graphql');
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

    it('should not generate helpers by default', () => {
      const options = parseArgs([]);

      const code = generateCode(schemas, options);

      expect(code.helpers).toBeUndefined();
    });

    it('should generate helpers when requested', () => {
      const options = parseArgs(['--helpers']);

      const code = generateCode(schemas, options);

      expect(code.helpers).toBeDefined();
      expect(code.helpers).toContain('getAllProducts');
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

    it('should respect --no-extend-node', () => {
      const options = parseArgs(['--no-extend-node']);

      const code = generateCode(schemas, options);

      expect(code.types).not.toContain('extends Node');
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

    it('should write helpers when provided', () => {
      const output = join(tempDir, 'generated');
      const schemas: ContentTypeDefinition[] = [
        {
          name: 'Product',
          fields: [{ name: 'name', type: 'string', required: true }],
        },
      ];
      const code = {
        types: 'export interface Product { name: string; }',
        helpers: 'export async function getAllProducts() { return []; }',
      };
      const options = parseArgs(['-o', output, '--helpers']);
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      writeCode(schemas, code, options);

      expect(existsSync(join(output, 'helpers'))).toBe(true);

      consoleSpy.mockRestore();
    });
  });
});
