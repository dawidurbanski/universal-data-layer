import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { buildSchema } from 'graphql';
import { extension } from '@/index.js';
import type { CodegenExtensionContext } from 'universal-data-layer';
import * as fs from 'node:fs/promises';

// Mock fs module
vi.mock('node:fs/promises', () => ({
  readFile: vi.fn(),
  readdir: vi.fn(),
  stat: vi.fn(),
}));

// Test schema
const testSchema = buildSchema(`
  type Query {
    product(id: ID!): Product
    allProducts: [Product!]!
  }

  type Product {
    id: ID!
    name: String!
    price: Float!
  }
`);

// Default config for tests
const defaultConfig: CodegenExtensionContext['config'] = {
  output: './generated',
  guards: false,
  helpers: false,
  customScalars: {},
  includeInternal: true,
  includeJsDoc: true,
  exportFormat: 'interface',
  extensions: [],
};

describe('codegen extension', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('extension metadata', () => {
    it('should have correct name', () => {
      expect(extension.name).toBe(
        '@universal-data-layer/codegen-typed-queries'
      );
    });

    it('should have correct output directory', () => {
      expect(extension.outputDir).toBe('queries');
    });

    it('should have a generate function', () => {
      expect(typeof extension.generate).toBe('function');
    });
  });

  describe('generate function', () => {
    it('should return null when no .graphql files are found', async () => {
      const mockReaddir = vi.mocked(fs.readdir);
      mockReaddir.mockResolvedValueOnce(
        [] as unknown as Awaited<ReturnType<typeof fs.readdir>>
      );

      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const result = await extension.generate({
        schema: testSchema,
        basePath: '/test/project',
        config: defaultConfig,
        types: [],
      });

      expect(result).toBeNull();
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('No .graphql files found')
      );

      logSpy.mockRestore();
    });

    it('should return generated code when queries are found', async () => {
      const mockReaddir = vi.mocked(fs.readdir);
      const mockStat = vi.mocked(fs.stat);
      const mockReadFile = vi.mocked(fs.readFile);

      mockReaddir.mockResolvedValueOnce([
        'GetProduct.graphql',
      ] as unknown as Awaited<ReturnType<typeof fs.readdir>>);
      mockStat.mockResolvedValueOnce({ isDirectory: () => false } as Awaited<
        ReturnType<typeof fs.stat>
      >);
      mockReadFile.mockResolvedValueOnce(
        'query GetProduct($id: ID!) { product(id: $id) { id name } }'
      );

      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const result = await extension.generate({
        schema: testSchema,
        basePath: '/test/project',
        config: defaultConfig,
        types: [],
      });

      expect(result).not.toBeNull();
      expect(result?.code).toContain('export interface GetProductVariables');
      expect(result?.code).toContain('export interface GetProductResult');
      expect(result?.code).toContain('export const GetProduct');
      expect(result?.wildcardExport).toBe(true);

      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('Generating TypedDocumentNode for 1 query')
      );

      logSpy.mockRestore();
    });

    it('should log correct count for multiple queries', async () => {
      const mockReaddir = vi.mocked(fs.readdir);
      const mockStat = vi.mocked(fs.stat);
      const mockReadFile = vi.mocked(fs.readFile);

      mockReaddir.mockResolvedValueOnce([
        'GetProduct.graphql',
        'GetAllProducts.graphql',
      ] as unknown as Awaited<ReturnType<typeof fs.readdir>>);
      mockStat.mockResolvedValueOnce({ isDirectory: () => false } as Awaited<
        ReturnType<typeof fs.stat>
      >);
      mockReadFile.mockResolvedValueOnce(
        'query GetProduct($id: ID!) { product(id: $id) { id } }'
      );
      mockStat.mockResolvedValueOnce({ isDirectory: () => false } as Awaited<
        ReturnType<typeof fs.stat>
      >);
      mockReadFile.mockResolvedValueOnce(
        'query GetAllProducts { allProducts { id } }'
      );

      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const result = await extension.generate({
        schema: testSchema,
        basePath: '/test/project',
        config: defaultConfig,
        types: [],
      });

      expect(result?.code).toContain('export const GetProduct');
      expect(result?.code).toContain('export const GetAllProducts');
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('2 query'));

      logSpy.mockRestore();
    });

    it('should respect includeJsDoc config option', async () => {
      const mockReaddir = vi.mocked(fs.readdir);
      const mockStat = vi.mocked(fs.stat);
      const mockReadFile = vi.mocked(fs.readFile);

      mockReaddir.mockResolvedValueOnce([
        'GetProduct.graphql',
      ] as unknown as Awaited<ReturnType<typeof fs.readdir>>);
      mockStat.mockResolvedValueOnce({ isDirectory: () => false } as Awaited<
        ReturnType<typeof fs.stat>
      >);
      mockReadFile.mockResolvedValueOnce(
        'query GetProduct { product(id: "1") { id } }'
      );

      vi.spyOn(console, 'log').mockImplementation(() => {});

      const result = await extension.generate({
        schema: testSchema,
        basePath: '/test/project',
        config: { ...defaultConfig, includeJsDoc: false },
        types: [],
      });

      expect(result?.code).not.toContain('/** query GetProduct');
    });

    it('should search from basePath', async () => {
      const mockReaddir = vi.mocked(fs.readdir);

      mockReaddir.mockResolvedValueOnce(
        [] as unknown as Awaited<ReturnType<typeof fs.readdir>>
      );

      vi.spyOn(console, 'log').mockImplementation(() => {});

      await extension.generate({
        schema: testSchema,
        basePath: '/custom/path/to/project',
        config: defaultConfig,
        types: [],
      });

      expect(mockReaddir).toHaveBeenCalledWith('/custom/path/to/project');
    });
  });
});

describe('module exports', () => {
  it('should export extension as default', async () => {
    const mod = await import('../../src/index.js');
    expect(mod.default).toBe(mod.extension);
  });

  it('should re-export QueryDocumentGenerator', async () => {
    const mod = await import('../../src/index.js');
    expect(mod.QueryDocumentGenerator).toBeDefined();
    expect(typeof mod.QueryDocumentGenerator).toBe('function');
  });

  it('should re-export generateQueryDocuments', async () => {
    const mod = await import('../../src/index.js');
    expect(mod.generateQueryDocuments).toBeDefined();
    expect(typeof mod.generateQueryDocuments).toBe('function');
  });
});
