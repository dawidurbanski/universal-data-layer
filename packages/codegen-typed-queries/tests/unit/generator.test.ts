import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { buildSchema, parse, Kind, OperationTypeNode } from 'graphql';
import {
  QueryDocumentGenerator,
  generateQueryDocuments,
  type DiscoveredQuery,
} from '../../src/generator.js';
import * as fs from 'node:fs/promises';

// Mock fs module
vi.mock('node:fs/promises', () => ({
  readFile: vi.fn(),
  readdir: vi.fn(),
  stat: vi.fn(),
}));

// Test schema covering various GraphQL types
const testSchema = buildSchema(`
  type Query {
    product(id: ID!): Product
    allProducts(limit: Int, category: Category): [Product!]!
    search(query: String!): SearchResult
    node(id: ID!): Node
  }

  type Mutation {
    createProduct(input: CreateProductInput!): Product
    updateProduct(id: ID!, name: String): Product
  }

  type Subscription {
    productUpdated(id: ID!): Product
  }

  type Product {
    id: ID!
    name: String!
    description: String
    price: Float!
    inStock: Boolean!
    tags: [String!]!
    category: Category!
    variants: [Variant!]
    metadata: JSON
  }

  type Variant {
    id: ID!
    name: String!
    color: String
    size: String
  }

  enum Category {
    ELECTRONICS
    CLOTHING
    FOOD
    OTHER
  }

  union SearchResult = Product | Variant

  interface Node {
    id: ID!
  }

  type ProductNode implements Node {
    id: ID!
    product: Product!
  }

  type VariantNode implements Node {
    id: ID!
    variant: Variant!
  }

  input CreateProductInput {
    name: String!
    description: String
    price: Float!
    category: Category!
  }

  scalar JSON
`);

describe('QueryDocumentGenerator', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create a generator with default options', () => {
      const generator = new QueryDocumentGenerator(testSchema);
      expect(generator).toBeInstanceOf(QueryDocumentGenerator);
    });

    it('should accept custom options', () => {
      const generator = new QueryDocumentGenerator(testSchema, {
        includeJsDoc: false,
        indent: '    ',
      });
      expect(generator).toBeInstanceOf(QueryDocumentGenerator);
    });
  });

  describe('discoverQueries', () => {
    it('should discover .graphql files in a directory', async () => {
      const mockReaddir = vi.mocked(fs.readdir);
      const mockStat = vi.mocked(fs.stat);
      const mockReadFile = vi.mocked(fs.readFile);

      mockReaddir.mockResolvedValueOnce([
        'GetProduct.graphql',
      ] as unknown as Awaited<ReturnType<typeof fs.readdir>>);
      mockStat.mockResolvedValueOnce({ isDirectory: () => false } as Awaited<
        ReturnType<typeof fs.stat>
      >);
      mockReadFile.mockResolvedValueOnce(`
        query GetProduct($id: ID!) {
          product(id: $id) {
            id
            name
          }
        }
      `);

      const generator = new QueryDocumentGenerator(testSchema);
      const queries = await generator.discoverQueries(['/test/queries']);

      expect(queries).toHaveLength(1);
      expect(queries[0]).toMatchObject({
        name: 'GetProduct',
        operation: 'query',
        sourcePath: '/test/queries/GetProduct.graphql',
      });
    });

    it('should discover .gql files', async () => {
      const mockReaddir = vi.mocked(fs.readdir);
      const mockStat = vi.mocked(fs.stat);
      const mockReadFile = vi.mocked(fs.readFile);

      mockReaddir.mockResolvedValueOnce([
        'GetProducts.gql',
      ] as unknown as Awaited<ReturnType<typeof fs.readdir>>);
      mockStat.mockResolvedValueOnce({ isDirectory: () => false } as Awaited<
        ReturnType<typeof fs.stat>
      >);
      mockReadFile.mockResolvedValueOnce(`
        query GetProducts {
          allProducts {
            id
            name
          }
        }
      `);

      const generator = new QueryDocumentGenerator(testSchema);
      const queries = await generator.discoverQueries(['/test/queries']);

      expect(queries).toHaveLength(1);
      expect(queries[0]?.name).toBe('GetProducts');
    });

    it('should recursively search nested directories', async () => {
      const mockReaddir = vi.mocked(fs.readdir);
      const mockStat = vi.mocked(fs.stat);
      const mockReadFile = vi.mocked(fs.readFile);

      // Root directory
      mockReaddir.mockResolvedValueOnce([
        'products',
        'GetProduct.graphql',
      ] as unknown as Awaited<ReturnType<typeof fs.readdir>>);
      mockStat.mockResolvedValueOnce({ isDirectory: () => true } as Awaited<
        ReturnType<typeof fs.stat>
      >);
      // Nested directory
      mockReaddir.mockResolvedValueOnce([
        'GetVariants.graphql',
      ] as unknown as Awaited<ReturnType<typeof fs.readdir>>);
      mockStat.mockResolvedValueOnce({ isDirectory: () => false } as Awaited<
        ReturnType<typeof fs.stat>
      >);
      mockReadFile.mockResolvedValueOnce(
        'query GetVariants { allProducts { variants { id } } }'
      );
      // Back to root file
      mockStat.mockResolvedValueOnce({ isDirectory: () => false } as Awaited<
        ReturnType<typeof fs.stat>
      >);
      mockReadFile.mockResolvedValueOnce(
        'query GetProduct { product(id: "1") { id } }'
      );

      const generator = new QueryDocumentGenerator(testSchema);
      const queries = await generator.discoverQueries(['/test/queries']);

      expect(queries).toHaveLength(2);
    });

    it('should skip node_modules directories', async () => {
      const mockReaddir = vi.mocked(fs.readdir);
      const mockStat = vi.mocked(fs.stat);

      mockReaddir.mockResolvedValueOnce([
        'node_modules',
        'src',
      ] as unknown as Awaited<ReturnType<typeof fs.readdir>>);
      mockStat.mockResolvedValueOnce({ isDirectory: () => true } as Awaited<
        ReturnType<typeof fs.stat>
      >);
      mockStat.mockResolvedValueOnce({ isDirectory: () => true } as Awaited<
        ReturnType<typeof fs.stat>
      >);
      mockReaddir.mockResolvedValueOnce(
        [] as unknown as Awaited<ReturnType<typeof fs.readdir>>
      );

      const generator = new QueryDocumentGenerator(testSchema);
      await generator.discoverQueries(['/test']);

      // node_modules should be skipped, readdir should only be called twice (root and src)
      expect(mockReaddir).toHaveBeenCalledTimes(2);
    });

    it('should skip hidden directories', async () => {
      const mockReaddir = vi.mocked(fs.readdir);
      const mockStat = vi.mocked(fs.stat);

      mockReaddir.mockResolvedValueOnce([
        '.hidden',
        'visible',
      ] as unknown as Awaited<ReturnType<typeof fs.readdir>>);
      mockStat.mockResolvedValueOnce({ isDirectory: () => true } as Awaited<
        ReturnType<typeof fs.stat>
      >);
      mockStat.mockResolvedValueOnce({ isDirectory: () => true } as Awaited<
        ReturnType<typeof fs.stat>
      >);
      mockReaddir.mockResolvedValueOnce(
        [] as unknown as Awaited<ReturnType<typeof fs.readdir>>
      );

      const generator = new QueryDocumentGenerator(testSchema);
      await generator.discoverQueries(['/test']);

      // .hidden should be skipped
      expect(mockReaddir).toHaveBeenCalledTimes(2);
    });

    it('should handle nonexistent directories gracefully', async () => {
      const mockReaddir = vi.mocked(fs.readdir);
      mockReaddir.mockRejectedValueOnce(
        new Error('ENOENT: no such file or directory')
      );

      const generator = new QueryDocumentGenerator(testSchema);
      const queries = await generator.discoverQueries(['/nonexistent']);

      expect(queries).toHaveLength(0);
    });

    it('should extract multiple operations from a single file', async () => {
      const mockReaddir = vi.mocked(fs.readdir);
      const mockStat = vi.mocked(fs.stat);
      const mockReadFile = vi.mocked(fs.readFile);

      mockReaddir.mockResolvedValueOnce([
        'operations.graphql',
      ] as unknown as Awaited<ReturnType<typeof fs.readdir>>);
      mockStat.mockResolvedValueOnce({ isDirectory: () => false } as Awaited<
        ReturnType<typeof fs.stat>
      >);
      mockReadFile.mockResolvedValueOnce(`
        query GetProduct($id: ID!) {
          product(id: $id) { id name }
        }

        mutation CreateProduct($input: CreateProductInput!) {
          createProduct(input: $input) { id name }
        }
      `);

      const generator = new QueryDocumentGenerator(testSchema);
      const queries = await generator.discoverQueries(['/test']);

      expect(queries).toHaveLength(2);
      expect(queries.find((q) => q.name === 'GetProduct')).toBeDefined();
      expect(queries.find((q) => q.name === 'CreateProduct')).toBeDefined();
    });

    it('should skip anonymous operations with a warning', async () => {
      const mockReaddir = vi.mocked(fs.readdir);
      const mockStat = vi.mocked(fs.stat);
      const mockReadFile = vi.mocked(fs.readFile);
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      mockReaddir.mockResolvedValueOnce(['anon.graphql'] as unknown as Awaited<
        ReturnType<typeof fs.readdir>
      >);
      mockStat.mockResolvedValueOnce({ isDirectory: () => false } as Awaited<
        ReturnType<typeof fs.stat>
      >);
      mockReadFile.mockResolvedValueOnce(`
        query {
          allProducts { id }
        }
      `);

      const generator = new QueryDocumentGenerator(testSchema);
      const queries = await generator.discoverQueries(['/test']);

      expect(queries).toHaveLength(0);
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('anonymous operation')
      );

      warnSpy.mockRestore();
    });

    it('should handle malformed GraphQL files gracefully', async () => {
      const mockReaddir = vi.mocked(fs.readdir);
      const mockStat = vi.mocked(fs.stat);
      const mockReadFile = vi.mocked(fs.readFile);
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      mockReaddir.mockResolvedValueOnce(['bad.graphql'] as unknown as Awaited<
        ReturnType<typeof fs.readdir>
      >);
      mockStat.mockResolvedValueOnce({ isDirectory: () => false } as Awaited<
        ReturnType<typeof fs.stat>
      >);
      mockReadFile.mockResolvedValueOnce('this is not valid graphql {{{');

      const generator = new QueryDocumentGenerator(testSchema);
      const queries = await generator.discoverQueries(['/test']);

      expect(queries).toHaveLength(0);
      expect(warnSpy).toHaveBeenCalled();

      warnSpy.mockRestore();
    });

    it('should create proper DiscoveredQuery objects', async () => {
      const mockReaddir = vi.mocked(fs.readdir);
      const mockStat = vi.mocked(fs.stat);
      const mockReadFile = vi.mocked(fs.readFile);

      mockReaddir.mockResolvedValueOnce(['test.graphql'] as unknown as Awaited<
        ReturnType<typeof fs.readdir>
      >);
      mockStat.mockResolvedValueOnce({ isDirectory: () => false } as Awaited<
        ReturnType<typeof fs.stat>
      >);
      mockReadFile.mockResolvedValueOnce(`
        mutation UpdateProduct($id: ID!, $name: String) {
          updateProduct(id: $id, name: $name) { id name }
        }
      `);

      const generator = new QueryDocumentGenerator(testSchema);
      const queries = await generator.discoverQueries(['/test']);

      expect(queries).toHaveLength(1);
      const query = queries[0]!;
      expect(query.name).toBe('UpdateProduct');
      expect(query.operation).toBe('mutation');
      expect(query.sourcePath).toBe('/test/test.graphql');
      expect(query.document.kind).toBe('Document');
      expect(query.document.definitions).toHaveLength(1);
    });
  });

  describe('generate', () => {
    it('should generate empty file for no queries', () => {
      const generator = new QueryDocumentGenerator(testSchema);
      const code = generator.generate([]);

      expect(code).toContain('Auto-generated TypedDocumentNode queries');
      expect(code).toContain('No .graphql files found');
      expect(code).toContain('export {};');
    });

    it('should generate header and imports for queries', () => {
      const query: DiscoveredQuery = {
        name: 'GetProduct',
        operation: 'query',
        document: parse('query GetProduct { product(id: "1") { id name } }'),
        sourcePath: '/test/GetProduct.graphql',
      };

      const generator = new QueryDocumentGenerator(testSchema);
      const code = generator.generate([query]);

      expect(code).toContain('Auto-generated TypedDocumentNode queries');
      expect(code).toContain('Generated by @udl/codegen-typed-queries');
      expect(code).toContain('DO NOT EDIT MANUALLY');
      expect(code).toContain(
        "import type { TypedDocumentNode } from '@graphql-typed-document-node/core';"
      );
    });

    it('should generate Result interface for queries', () => {
      const query: DiscoveredQuery = {
        name: 'GetProduct',
        operation: 'query',
        document: parse(
          'query GetProduct { product(id: "1") { id name price } }'
        ),
        sourcePath: '/test/GetProduct.graphql',
      };

      const generator = new QueryDocumentGenerator(testSchema);
      const code = generator.generate([query]);

      expect(code).toContain('export interface GetProductResult');
      expect(code).toContain('id: string;');
      expect(code).toContain('name: string;');
      expect(code).toContain('price: number;');
    });

    it('should generate Variables interface when variables exist', () => {
      const query: DiscoveredQuery = {
        name: 'GetProduct',
        operation: 'query',
        document: parse(
          'query GetProduct($id: ID!, $includeDesc: Boolean) { product(id: $id) { id name } }'
        ),
        sourcePath: '/test/GetProduct.graphql',
      };

      const generator = new QueryDocumentGenerator(testSchema);
      const code = generator.generate([query]);

      expect(code).toContain('export interface GetProductVariables');
      expect(code).toContain('id: string;');
      expect(code).toContain('includeDesc?: boolean;');
    });

    it('should use Record<string, never> when no variables', () => {
      const query: DiscoveredQuery = {
        name: 'GetAllProducts',
        operation: 'query',
        document: parse('query GetAllProducts { allProducts { id } }'),
        sourcePath: '/test/GetAllProducts.graphql',
      };

      const generator = new QueryDocumentGenerator(testSchema);
      const code = generator.generate([query]);

      expect(code).not.toContain('GetAllProductsVariables');
      expect(code).toContain('Record<string, never>');
    });

    it('should generate TypedDocumentNode export', () => {
      const query: DiscoveredQuery = {
        name: 'GetProduct',
        operation: 'query',
        document: parse(
          'query GetProduct($id: ID!) { product(id: $id) { id } }'
        ),
        sourcePath: '/test/GetProduct.graphql',
      };

      const generator = new QueryDocumentGenerator(testSchema);
      const code = generator.generate([query]);

      expect(code).toContain(
        'export const GetProduct: TypedDocumentNode<GetProductResult, GetProductVariables>'
      );
    });

    it('should include JSDoc comments by default', () => {
      const query: DiscoveredQuery = {
        name: 'GetProduct',
        operation: 'query',
        document: parse('query GetProduct { product(id: "1") { id } }'),
        sourcePath: '/test/GetProduct.graphql',
      };

      const generator = new QueryDocumentGenerator(testSchema);
      const code = generator.generate([query]);

      expect(code).toContain('/** query GetProduct from GetProduct.graphql */');
    });

    it('should omit JSDoc comments when disabled', () => {
      const query: DiscoveredQuery = {
        name: 'GetProduct',
        operation: 'query',
        document: parse('query GetProduct { product(id: "1") { id } }'),
        sourcePath: '/test/GetProduct.graphql',
      };

      const generator = new QueryDocumentGenerator(testSchema, {
        includeJsDoc: false,
      });
      const code = generator.generate([query]);

      expect(code).not.toContain('/** query GetProduct');
    });

    it('should serialize document without loc properties', () => {
      const query: DiscoveredQuery = {
        name: 'GetProduct',
        operation: 'query',
        document: parse('query GetProduct { product(id: "1") { id } }'),
        sourcePath: '/test/GetProduct.graphql',
      };

      const generator = new QueryDocumentGenerator(testSchema);
      const code = generator.generate([query]);

      expect(code).not.toContain('"loc"');
    });
  });

  describe('type generation', () => {
    it('should convert scalar types correctly', () => {
      const query: DiscoveredQuery = {
        name: 'GetProduct',
        operation: 'query',
        document: parse(`
          query GetProduct {
            product(id: "1") {
              id
              name
              description
              price
              inStock
            }
          }
        `),
        sourcePath: '/test/GetProduct.graphql',
      };

      const generator = new QueryDocumentGenerator(testSchema);
      const code = generator.generate([query]);

      expect(code).toContain('id: string;'); // ID -> string
      expect(code).toContain('name: string;'); // String -> string
      expect(code).toContain('description: string;'); // String (nullable)
      expect(code).toContain('price: number;'); // Float -> number
      expect(code).toContain('inStock: boolean;'); // Boolean -> boolean
    });

    it('should handle enum types', () => {
      const query: DiscoveredQuery = {
        name: 'GetProduct',
        operation: 'query',
        document: parse(`
          query GetProduct {
            product(id: "1") {
              category
            }
          }
        `),
        sourcePath: '/test/GetProduct.graphql',
      };

      const generator = new QueryDocumentGenerator(testSchema);
      const code = generator.generate([query]);

      expect(code).toContain("'ELECTRONICS' | 'CLOTHING' | 'FOOD' | 'OTHER'");
    });

    it('should handle list types', () => {
      const query: DiscoveredQuery = {
        name: 'GetProduct',
        operation: 'query',
        document: parse(`
          query GetProduct {
            product(id: "1") {
              tags
            }
          }
        `),
        sourcePath: '/test/GetProduct.graphql',
      };

      const generator = new QueryDocumentGenerator(testSchema);
      const code = generator.generate([query]);

      expect(code).toContain('tags: string[];');
    });

    it('should handle nested object types', () => {
      const query: DiscoveredQuery = {
        name: 'GetProduct',
        operation: 'query',
        document: parse(`
          query GetProduct {
            product(id: "1") {
              id
              variants {
                id
                name
                color
              }
            }
          }
        `),
        sourcePath: '/test/GetProduct.graphql',
      };

      const generator = new QueryDocumentGenerator(testSchema);
      const code = generator.generate([query]);

      expect(code).toContain('variants:');
      expect(code).toContain('id: string;');
      expect(code).toContain('name: string;');
      expect(code).toContain('color: string;');
    });

    it('should handle custom scalar types', () => {
      const query: DiscoveredQuery = {
        name: 'GetProduct',
        operation: 'query',
        document: parse(`
          query GetProduct {
            product(id: "1") {
              metadata
            }
          }
        `),
        sourcePath: '/test/GetProduct.graphql',
      };

      const generator = new QueryDocumentGenerator(testSchema);
      const code = generator.generate([query]);

      // Custom scalars default to unknown
      expect(code).toContain('metadata: unknown;');
    });

    it('should handle field aliases', () => {
      const query: DiscoveredQuery = {
        name: 'GetProduct',
        operation: 'query',
        document: parse(`
          query GetProduct {
            product(id: "1") {
              productId: id
              productName: name
            }
          }
        `),
        sourcePath: '/test/GetProduct.graphql',
      };

      const generator = new QueryDocumentGenerator(testSchema);
      const code = generator.generate([query]);

      expect(code).toContain('productId: string;');
      expect(code).toContain('productName: string;');
    });

    it('should handle union types with inline fragments', () => {
      const query: DiscoveredQuery = {
        name: 'SearchProducts',
        operation: 'query',
        document: parse(`
          query SearchProducts($query: String!) {
            search(query: $query) {
              ... on Product {
                id
                name
              }
              ... on Variant {
                id
                color
              }
            }
          }
        `),
        sourcePath: '/test/SearchProducts.graphql',
      };

      const generator = new QueryDocumentGenerator(testSchema);
      const code = generator.generate([query]);

      expect(code).toContain("__typename: 'Product'");
      expect(code).toContain("__typename: 'Variant'");
    });

    it('should handle interface types with inline fragments', () => {
      const query: DiscoveredQuery = {
        name: 'GetNode',
        operation: 'query',
        document: parse(`
          query GetNode($id: ID!) {
            node(id: $id) {
              ... on ProductNode {
                id
                product {
                  name
                }
              }
              ... on VariantNode {
                id
                variant {
                  name
                }
              }
            }
          }
        `),
        sourcePath: '/test/GetNode.graphql',
      };

      const generator = new QueryDocumentGenerator(testSchema);
      const code = generator.generate([query]);

      expect(code).toContain("__typename: 'ProductNode'");
      expect(code).toContain("__typename: 'VariantNode'");
    });

    it('should skip __typename in generated interfaces', () => {
      const query: DiscoveredQuery = {
        name: 'GetProduct',
        operation: 'query',
        document: parse(`
          query GetProduct {
            product(id: "1") {
              __typename
              id
              name
            }
          }
        `),
        sourcePath: '/test/GetProduct.graphql',
      };

      const generator = new QueryDocumentGenerator(testSchema);
      const code = generator.generate([query]);

      // __typename should not appear as a field in the result interface
      // (it's only added for union/interface type discrimination)
      const resultInterface = code.match(
        /export interface GetProductResult \{[^}]+\}/
      )?.[0];
      expect(resultInterface).not.toContain('__typename: string;');
    });
  });

  describe('variable type generation', () => {
    it('should handle required variables', () => {
      const query: DiscoveredQuery = {
        name: 'GetProduct',
        operation: 'query',
        document: parse(
          'query GetProduct($id: ID!) { product(id: $id) { id } }'
        ),
        sourcePath: '/test/GetProduct.graphql',
      };

      const generator = new QueryDocumentGenerator(testSchema);
      const code = generator.generate([query]);

      // Required variables should not have ?
      expect(code).toMatch(/id: string;/);
      expect(code).not.toMatch(/id\?: string;/);
    });

    it('should handle optional variables', () => {
      const query: DiscoveredQuery = {
        name: 'GetProducts',
        operation: 'query',
        document: parse(`
          query GetProducts($limit: Int, $category: Category) {
            allProducts(limit: $limit, category: $category) {
              id
            }
          }
        `),
        sourcePath: '/test/GetProducts.graphql',
      };

      const generator = new QueryDocumentGenerator(testSchema);
      const code = generator.generate([query]);

      expect(code).toContain('limit?: number;');
      expect(code).toContain('category?:');
    });

    it('should handle list type variables', () => {
      // Create a schema with list input
      const schemaWithListInput = buildSchema(`
        type Query {
          productsByIds(ids: [ID!]!): [Product!]!
        }
        type Product {
          id: ID!
        }
      `);

      const query: DiscoveredQuery = {
        name: 'GetProductsByIds',
        operation: 'query',
        document: parse(`
          query GetProductsByIds($ids: [ID!]!) {
            productsByIds(ids: $ids) {
              id
            }
          }
        `),
        sourcePath: '/test/GetProductsByIds.graphql',
      };

      const generator = new QueryDocumentGenerator(schemaWithListInput);
      const code = generator.generate([query]);

      expect(code).toContain('ids: string[];');
    });

    it('should handle enum type variables', () => {
      const query: DiscoveredQuery = {
        name: 'GetProducts',
        operation: 'query',
        document: parse(`
          query GetProducts($category: Category!) {
            allProducts(category: $category) {
              id
            }
          }
        `),
        sourcePath: '/test/GetProducts.graphql',
      };

      const generator = new QueryDocumentGenerator(testSchema);
      const code = generator.generate([query]);

      expect(code).toContain(
        "category: 'ELECTRONICS' | 'CLOTHING' | 'FOOD' | 'OTHER';"
      );
    });
  });

  describe('mutation support', () => {
    it('should generate types for mutations', () => {
      const query: DiscoveredQuery = {
        name: 'CreateProduct',
        operation: 'mutation',
        document: parse(`
          mutation CreateProduct($input: CreateProductInput!) {
            createProduct(input: $input) {
              id
              name
            }
          }
        `),
        sourcePath: '/test/CreateProduct.graphql',
      };

      const generator = new QueryDocumentGenerator(testSchema);
      const code = generator.generate([query]);

      expect(code).toContain('export interface CreateProductVariables');
      expect(code).toContain('export interface CreateProductResult');
      expect(code).toContain('/** mutation CreateProduct');
    });
  });

  describe('subscription support', () => {
    it('should generate types for subscriptions', () => {
      const query: DiscoveredQuery = {
        name: 'ProductUpdated',
        operation: 'subscription',
        document: parse(`
          subscription ProductUpdated($id: ID!) {
            productUpdated(id: $id) {
              id
              name
              price
            }
          }
        `),
        sourcePath: '/test/ProductUpdated.graphql',
      };

      const generator = new QueryDocumentGenerator(testSchema);
      const code = generator.generate([query]);

      expect(code).toContain('export interface ProductUpdatedVariables');
      expect(code).toContain('export interface ProductUpdatedResult');
      expect(code).toContain('/** subscription ProductUpdated');
    });
  });

  describe('custom options', () => {
    it('should respect custom indentation', () => {
      const query: DiscoveredQuery = {
        name: 'GetProduct',
        operation: 'query',
        document: parse('query GetProduct { product(id: "1") { id name } }'),
        sourcePath: '/test/GetProduct.graphql',
      };

      const generator = new QueryDocumentGenerator(testSchema, {
        indent: '    ',
      });
      const code = generator.generate([query]);

      // Should use 4 spaces instead of 2
      expect(code).toContain('    id: string;');
    });
  });

  describe('edge cases', () => {
    it('should handle schema without mutation type', () => {
      const queryOnlySchema = buildSchema(`
        type Query {
          hello: String
        }
      `);

      const query: DiscoveredQuery = {
        name: 'DoSomething',
        operation: 'mutation',
        document: parse('mutation DoSomething { __typename }'),
        sourcePath: '/test/DoSomething.graphql',
      };

      const generator = new QueryDocumentGenerator(queryOnlySchema);
      const code = generator.generate([query]);

      // Should handle gracefully and return unknown type
      expect(code).toContain('export type DoSomethingResult = unknown;');
    });

    it('should handle empty selection set', () => {
      const query: DiscoveredQuery = {
        name: 'GetProduct',
        operation: 'query',
        document: {
          kind: Kind.DOCUMENT,
          definitions: [
            {
              kind: Kind.OPERATION_DEFINITION,
              operation: OperationTypeNode.QUERY,
              name: { kind: Kind.NAME, value: 'GetProduct' },
              selectionSet: { kind: Kind.SELECTION_SET, selections: [] },
            },
          ],
        },
        sourcePath: '/test/GetProduct.graphql',
      };

      const generator = new QueryDocumentGenerator(testSchema);
      const code = generator.generate([query]);

      expect(code).toContain('export interface GetProductResult {}');
    });

    it('should warn about unknown fields', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const query: DiscoveredQuery = {
        name: 'GetProduct',
        operation: 'query',
        document: parse(
          'query GetProduct { product(id: "1") { unknownField } }'
        ),
        sourcePath: '/test/GetProduct.graphql',
      };

      const generator = new QueryDocumentGenerator(testSchema);
      generator.generate([query]);

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('unknownField not found')
      );
      warnSpy.mockRestore();
    });

    it('should generate multiple queries in sequence', () => {
      const queries: DiscoveredQuery[] = [
        {
          name: 'GetProduct',
          operation: 'query',
          document: parse(
            'query GetProduct($id: ID!) { product(id: $id) { id name } }'
          ),
          sourcePath: '/test/GetProduct.graphql',
        },
        {
          name: 'GetAllProducts',
          operation: 'query',
          document: parse('query GetAllProducts { allProducts { id } }'),
          sourcePath: '/test/GetAllProducts.graphql',
        },
        {
          name: 'CreateProduct',
          operation: 'mutation',
          document: parse(
            'mutation CreateProduct($input: CreateProductInput!) { createProduct(input: $input) { id } }'
          ),
          sourcePath: '/test/CreateProduct.graphql',
        },
      ];

      const generator = new QueryDocumentGenerator(testSchema);
      const code = generator.generate(queries);

      expect(code).toContain('export interface GetProductVariables');
      expect(code).toContain('export interface GetProductResult');
      expect(code).toContain('export const GetProduct');

      expect(code).toContain('export interface GetAllProductsResult');
      expect(code).toContain('export const GetAllProducts');

      expect(code).toContain('export interface CreateProductVariables');
      expect(code).toContain('export interface CreateProductResult');
      expect(code).toContain('export const CreateProduct');
    });
  });
});

describe('generateQueryDocuments', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('should run the full pipeline', async () => {
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

    const code = await generateQueryDocuments(testSchema, ['/test']);

    expect(code).toContain('export interface GetProductVariables');
    expect(code).toContain('export interface GetProductResult');
    expect(code).toContain('export const GetProduct');
  });

  it('should accept custom options', async () => {
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

    const code = await generateQueryDocuments(testSchema, ['/test'], {
      includeJsDoc: false,
    });

    expect(code).not.toContain('/** query GetProduct');
  });
});
