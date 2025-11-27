/**
 * Integration tests for the end-to-end codegen flow.
 *
 * These tests verify that the complete pipeline works:
 * 1. Schema inference (from store, GraphQL, REST responses)
 * 2. Code generation (types, guards, helpers)
 * 3. File output (single and multi-file modes)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, mkdirSync, rmSync, readFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

// Schema types and registry
import { SchemaRegistry } from '../../src/registry.js';
import type { ContentTypeDefinition } from '../../src/types/schema.js';

// Inference
import { inferSchemaFromStore } from '../../src/inference/from-store.js';
import { inferSchemaFromResponse } from '../../src/inference/from-response.js';

// Generators
import { TypeScriptGenerator } from '../../src/generators/typescript.js';
import { TypeGuardGenerator } from '../../src/generators/type-guards.js';
import { FetchHelperGenerator } from '../../src/generators/fetch-helpers.js';

// Output
import { FileWriter } from '../../src/output/file-writer.js';

// Mock node store for testing
interface MockNode {
  id: string;
  internal: {
    id: string;
    type: string;
    owner: string;
    contentDigest: string;
  };
  [key: string]: unknown;
}

class MockNodeStore {
  private nodes: Map<string, MockNode[]> = new Map();
  private indexes: Map<string, Set<string>> = new Map();

  addNode(type: string, node: MockNode): void {
    if (!this.nodes.has(type)) {
      this.nodes.set(type, []);
    }
    this.nodes.get(type)!.push(node);
  }

  getTypes(): string[] {
    return Array.from(this.nodes.keys());
  }

  getByType(type: string): MockNode[] {
    return this.nodes.get(type) || [];
  }

  registerIndex(type: string, field: string): void {
    if (!this.indexes.has(type)) {
      this.indexes.set(type, new Set());
    }
    this.indexes.get(type)!.add(field);
  }

  getRegisteredIndexes(type: string): string[] {
    return Array.from(this.indexes.get(type) || []);
  }
}

describe('End-to-end codegen flow', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = join(
      tmpdir(),
      `udl-codegen-integration-${Date.now()}-${Math.random().toString(36).slice(2)}`
    );
    mkdirSync(tempDir, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('Store -> Types -> File', () => {
    it('should infer schema from store and generate types', () => {
      // 1. Create a mock store with nodes
      const store = new MockNodeStore();
      store.addNode('Product', {
        id: 'product-1',
        internal: {
          id: 'product-1',
          type: 'Product',
          owner: 'test-plugin',
          contentDigest: 'digest-1',
        },
        name: 'Widget',
        price: 29.99,
        inStock: true,
        tags: ['electronics', 'gadgets'],
      });
      store.addNode('Product', {
        id: 'product-2',
        internal: {
          id: 'product-2',
          type: 'Product',
          owner: 'test-plugin',
          contentDigest: 'digest-2',
        },
        name: 'Gadget',
        price: 49.99,
        inStock: false,
        description: 'A cool gadget', // Optional field (not in first node)
      });
      store.registerIndex('Product', 'name');

      // 2. Infer schema from store
      const schemas = inferSchemaFromStore(store);

      expect(schemas).toHaveLength(1);
      expect(schemas[0]?.name).toBe('Product');
      expect(schemas[0]?.indexes).toContain('name');

      // 3. Generate TypeScript code
      const tsGenerator = new TypeScriptGenerator({ includeJsDoc: true });
      const code = tsGenerator.generate(schemas);

      expect(code).toContain('export interface Product {');
      expect(code).toContain('name: string');
      expect(code).toContain('price: number');
      expect(code).toContain('inStock: boolean');
      expect(code).toContain('tags?: string[]'); // Optional (not in all nodes)
      expect(code).toContain('description?: string'); // Optional (not in all nodes)
      expect(code).toContain('internal: NodeInternal<');
    });

    it('should write generated code to files', () => {
      // 1. Create schema
      const schemas: ContentTypeDefinition[] = [
        {
          name: 'Product',
          description: 'A product in the catalog',
          fields: [
            { name: 'name', type: 'string', required: true },
            { name: 'price', type: 'number', required: true },
          ],
          indexes: ['name'],
        },
      ];

      // 2. Generate all code
      const tsCode = new TypeScriptGenerator().generate(schemas);
      const guardsCode = new TypeGuardGenerator().generate(schemas);
      const helpersCode = new FetchHelperGenerator().generate(schemas);

      // 3. Write to files
      const output = join(tempDir, 'generated');
      const writer = new FileWriter({ output, mode: 'multi' });

      const result = writer.writeAll({
        types: { schemas, code: tsCode },
        guards: { schemas, code: guardsCode },
        helpers: { schemas, code: helpersCode },
      });

      // 4. Verify files were created
      expect(result.written.length).toBeGreaterThan(0);
      expect(existsSync(join(output, 'types'))).toBe(true);
      expect(existsSync(join(output, 'guards'))).toBe(true);
      expect(existsSync(join(output, 'helpers'))).toBe(true);
      expect(existsSync(join(output, 'index.ts'))).toBe(true);

      // 5. Verify content
      const indexContent = readFileSync(join(output, 'index.ts'), 'utf-8');
      expect(indexContent).toContain("export * from './types/index.js'");
      expect(indexContent).toContain("export * from './guards/index.js'");
      expect(indexContent).toContain("export * from './helpers/index.js'");
    });
  });

  describe('REST Response -> Types', () => {
    it('should infer schema from REST response and generate types', () => {
      // 1. Sample REST response
      const response = {
        id: 123,
        title: 'Blog Post Title',
        content: 'This is the blog post content...',
        author: {
          name: 'John Doe',
          email: 'john@example.com',
        },
        tags: ['tech', 'programming'],
        publishedAt: '2024-01-15T10:30:00Z',
        views: 1500,
        featured: true,
      };

      // 2. Infer schema
      const schema = inferSchemaFromResponse(response, 'BlogPost');

      expect(schema.name).toBe('BlogPost');
      expect(schema.fields.find((f) => f.name === 'id')?.type).toBe('number');
      expect(schema.fields.find((f) => f.name === 'title')?.type).toBe(
        'string'
      );
      expect(schema.fields.find((f) => f.name === 'author')?.type).toBe(
        'object'
      );
      expect(schema.fields.find((f) => f.name === 'tags')?.type).toBe('array');
      expect(schema.fields.find((f) => f.name === 'featured')?.type).toBe(
        'boolean'
      );

      // 3. Generate TypeScript
      const tsGenerator = new TypeScriptGenerator();
      const code = tsGenerator.generate([schema]);

      expect(code).toContain('export interface BlogPost {');
      expect(code).toContain('id: number');
      expect(code).toContain('title: string');
      expect(code).toContain('author: {');
      expect(code).toContain('name: string');
      expect(code).toContain('email: string');
      expect(code).toContain('tags: string[]');
      expect(code).toContain('featured: boolean');
      expect(code).toContain('internal: NodeInternal<');
    });
  });

  describe('Registry workflow', () => {
    it('should support plugin-style type registration', () => {
      // 1. Create registry (simulating codegen setup)
      const registry = new SchemaRegistry();

      // 2. Simulate plugin 1 registering types
      const plugin1Context = registry.createContext({ apiKey: 'key1' });
      plugin1Context.registerType({
        name: 'Product',
        fields: [
          { name: 'name', type: 'string', required: true },
          { name: 'price', type: 'number', required: true },
        ],
      });

      // 3. Simulate plugin 2 registering types
      const plugin2Context = registry.createContext({ apiKey: 'key2' });
      plugin2Context.registerType({
        name: 'Category',
        fields: [
          { name: 'title', type: 'string', required: true },
          { name: 'slug', type: 'string', required: true },
        ],
      });

      // 4. Plugin 2 extends Product with category reference
      plugin2Context.extendType('Product', [
        {
          name: 'category',
          type: 'reference',
          required: false,
          referenceType: 'Category',
        },
      ]);

      // 5. Get all types and generate code
      const schemas = registry.getAll();
      expect(schemas).toHaveLength(2);

      const tsCode = new TypeScriptGenerator().generate(schemas);
      expect(tsCode).toContain('export interface Product {');
      expect(tsCode).toContain('export interface Category {');
      expect(tsCode).toContain('category?: Category');
      expect(tsCode).toContain('internal: NodeInternal<');
    });

    it('should merge multiple response samples to detect optional fields', () => {
      // 1. Create registry
      const registry = new SchemaRegistry();

      // 2. Sample responses (some fields missing in some responses)
      const responses = [
        { id: 1, name: 'Product 1', price: 10, description: 'A product' },
        { id: 2, name: 'Product 2', price: 20 }, // No description
        { id: 3, name: 'Product 3', price: 30, sku: 'SKU-003' }, // Has sku
      ];

      // 3. Infer from each response and merge
      for (const response of responses) {
        const schema = inferSchemaFromResponse(response, 'Product');
        if (registry.has('Product')) {
          // Merge fields
          const existing = registry.get('Product')!;
          const newFields = schema.fields.filter(
            (f) => !existing.fields.some((ef) => ef.name === f.name)
          );
          if (newFields.length > 0) {
            registry.extend('Product', newFields);
          }
        } else {
          registry.register(schema);
        }
      }

      // 4. Generate code
      const schemas = registry.getAll();
      const tsCode = new TypeScriptGenerator().generate(schemas);

      expect(tsCode).toContain('id: number');
      expect(tsCode).toContain('name: string');
      expect(tsCode).toContain('price: number');
    });
  });

  describe('Single file output', () => {
    it('should generate everything in a single file', () => {
      const schemas: ContentTypeDefinition[] = [
        {
          name: 'User',
          fields: [
            { name: 'name', type: 'string', required: true },
            { name: 'email', type: 'string', required: true },
          ],
        },
      ];

      const tsCode = new TypeScriptGenerator().generate(schemas);
      const guardsCode = new TypeGuardGenerator().generate(schemas);

      // Combine into single file
      const combinedCode = `${tsCode}\n\n${guardsCode}`;

      const outputFile = join(tempDir, 'types.ts');
      const writer = new FileWriter({ output: outputFile, mode: 'single' });

      writer.writeTypes(schemas, combinedCode);

      expect(existsSync(outputFile)).toBe(true);
      const content = readFileSync(outputFile, 'utf-8');
      expect(content).toContain('export interface User');
      expect(content).toContain('export function isUser');
    });
  });

  describe('Incremental generation', () => {
    it('should skip unchanged files', () => {
      const schemas: ContentTypeDefinition[] = [
        {
          name: 'Config',
          fields: [{ name: 'key', type: 'string', required: true }],
        },
      ];

      const code = new TypeScriptGenerator().generate(schemas);
      const output = join(tempDir, 'types.ts');
      const writer = new FileWriter({
        output,
        mode: 'single',
        incrementalWrite: true,
      });

      // First write
      const result1 = writer.writeTypes(schemas, code);
      expect(result1.written).toContain(output);

      // Second write with same content
      const result2 = writer.writeTypes(schemas, code);
      expect(result2.skipped).toContain(output);
      expect(result2.written).not.toContain(output);

      // Third write with different content
      const newCode = new TypeScriptGenerator().generate([
        ...schemas,
        {
          name: 'NewType',
          fields: [{ name: 'value', type: 'number', required: true }],
        },
      ]);
      const result3 = writer.writeTypes(schemas, newCode);
      expect(result3.written).toContain(output);
    });
  });

  describe('Generated code quality', () => {
    it('should generate valid TypeScript syntax', () => {
      const schemas: ContentTypeDefinition[] = [
        {
          name: 'ComplexType',
          description: 'A type with all field types',
          fields: [
            { name: 'strField', type: 'string', required: true },
            { name: 'numField', type: 'number', required: true },
            { name: 'boolField', type: 'boolean', required: true },
            { name: 'nullField', type: 'null', required: true },
            { name: 'unknownField', type: 'unknown', required: true },
            {
              name: 'arrayField',
              type: 'array',
              required: true,
              arrayItemType: { name: 'item', type: 'string', required: true },
            },
            {
              name: 'objectField',
              type: 'object',
              required: true,
              objectFields: [
                { name: 'nested', type: 'string', required: true },
              ],
            },
            {
              name: 'refField',
              type: 'reference',
              required: false,
              referenceType: 'OtherType',
            },
            { name: 'optionalField', type: 'string', required: false },
          ],
        },
      ];

      const tsCode = new TypeScriptGenerator({ includeJsDoc: true }).generate(
        schemas
      );

      // Verify structure
      expect(tsCode).toContain('/** A type with all field types */');
      expect(tsCode).toContain('strField: string;');
      expect(tsCode).toContain('numField: number;');
      expect(tsCode).toContain('boolField: boolean;');
      expect(tsCode).toContain('nullField: null;');
      expect(tsCode).toContain('unknownField: unknown;');
      expect(tsCode).toContain('arrayField: string[];');
      expect(tsCode).toContain('objectField: {');
      expect(tsCode).toContain('nested: string;');
      expect(tsCode).toContain('refField?: OtherType;');
      expect(tsCode).toContain('optionalField?: string;');
    });

    it('should generate working type guards', () => {
      const schemas: ContentTypeDefinition[] = [
        {
          name: 'Person',
          fields: [
            { name: 'name', type: 'string', required: true },
            { name: 'age', type: 'number', required: true },
            { name: 'nickname', type: 'string', required: false },
          ],
        },
      ];

      const guardsCode = new TypeGuardGenerator().generate(schemas);

      // Verify guard structure
      expect(guardsCode).toContain(
        'export function isPerson(value: unknown): value is Person'
      );
      expect(guardsCode).toContain(
        "if (typeof value !== 'object' || value === null)"
      );
      expect(guardsCode).toContain("typeof obj['name'] !== 'string'");
      expect(guardsCode).toContain("typeof obj['age'] !== 'number'");
      expect(guardsCode).toContain("if (obj['nickname'] !== undefined)");
      expect(guardsCode).toContain('return true;');

      expect(guardsCode).toContain(
        'export function assertPerson(value: unknown): asserts value is Person'
      );
      expect(guardsCode).toContain('if (!isPerson(value))');
      expect(guardsCode).toContain(
        "throw new TypeError('Value is not a valid Person')"
      );
    });

    it('should generate correct fetch helpers', () => {
      const schemas: ContentTypeDefinition[] = [
        {
          name: 'Article',
          fields: [
            { name: 'title', type: 'string', required: true },
            { name: 'slug', type: 'string', required: true },
          ],
          indexes: ['slug'],
        },
      ];

      const helpersCode = new FetchHelperGenerator().generate(schemas);

      // Verify helpers import graphqlFetch from client subpath
      expect(helpersCode).toContain(
        "import { graphqlFetch } from 'universal-data-layer/client'"
      );
      expect(helpersCode).toContain(
        'export async function getAllArticles(): Promise<Article[]>'
      );
      expect(helpersCode).toContain(
        'export async function getArticleById(id: string): Promise<Article | null>'
      );
      expect(helpersCode).toContain(
        'export async function getArticleBySlug(slug: string): Promise<Article | null>'
      );
      expect(helpersCode).toContain('allArticle');
      expect(helpersCode).toContain('article(id: $id)');
      expect(helpersCode).toContain('articleBySlug(slug: $slug)');
    });
  });
});
