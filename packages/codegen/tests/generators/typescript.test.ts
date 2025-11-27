import { describe, it, expect } from 'vitest';
import {
  TypeScriptGenerator,
  generateTypeScript,
} from '../../src/generators/typescript.js';
import type { ContentTypeDefinition } from '../../src/types/schema.js';

describe('TypeScriptGenerator', () => {
  describe('generate', () => {
    it('should generate a simple interface with internal field', () => {
      const schemas: ContentTypeDefinition[] = [
        {
          name: 'Product',
          owner: 'test-source',
          fields: [
            { name: 'name', type: 'string', required: true },
            { name: 'price', type: 'number', required: true },
          ],
        },
      ];

      const generator = new TypeScriptGenerator();
      const code = generator.generate(schemas);

      expect(code).toContain('export interface Product {');
      expect(code).toContain('name: string;');
      expect(code).toContain('price: number;');
      expect(code).toContain(
        "internal: NodeInternal<'Product', 'test-source'>;"
      );
      expect(code).toContain(
        "import type { NodeInternal } from 'universal-data-layer/client'"
      );
    });

    it('should handle optional fields', () => {
      const schemas: ContentTypeDefinition[] = [
        {
          name: 'Product',
          fields: [
            { name: 'name', type: 'string', required: true },
            { name: 'description', type: 'string', required: false },
          ],
        },
      ];

      const generator = new TypeScriptGenerator();
      const code = generator.generate(schemas);

      expect(code).toContain('name: string;');
      expect(code).toContain('description?: string;');
    });

    it('should generate JSDoc comments', () => {
      const schemas: ContentTypeDefinition[] = [
        {
          name: 'Product',
          description: 'A product in the catalog',
          fields: [
            {
              name: 'name',
              type: 'string',
              required: true,
              description: 'The product name',
            },
          ],
        },
      ];

      const generator = new TypeScriptGenerator({ includeJsDoc: true });
      const code = generator.generate(schemas);

      expect(code).toContain('/** A product in the catalog */');
      expect(code).toContain('/** The product name */');
    });

    it('should skip JSDoc when disabled', () => {
      const schemas: ContentTypeDefinition[] = [
        {
          name: 'Product',
          description: 'A product in the catalog',
          fields: [
            {
              name: 'name',
              type: 'string',
              required: true,
              description: 'The product name',
            },
          ],
        },
      ];

      const generator = new TypeScriptGenerator({ includeJsDoc: false });
      const code = generator.generate(schemas);

      expect(code).not.toContain('/** A product in the catalog */');
      expect(code).not.toContain('/** The product name */');
    });

    it('should generate type aliases instead of interfaces', () => {
      const schemas: ContentTypeDefinition[] = [
        {
          name: 'Product',
          owner: 'test-source',
          fields: [{ name: 'name', type: 'string', required: true }],
        },
      ];

      const generator = new TypeScriptGenerator({ exportFormat: 'type' });
      const code = generator.generate(schemas);

      expect(code).toContain('export type Product = {');
      expect(code).toContain(
        "internal: NodeInternal<'Product', 'test-source'>;"
      );
      expect(code).not.toContain('export interface');
    });

    it('should not include internal field when disabled', () => {
      const schemas: ContentTypeDefinition[] = [
        {
          name: 'Product',
          fields: [{ name: 'name', type: 'string', required: true }],
        },
      ];

      const generator = new TypeScriptGenerator({ includeInternal: false });
      const code = generator.generate(schemas);

      expect(code).toContain('export interface Product {');
      expect(code).not.toContain('internal:');
      expect(code).not.toContain('import type { NodeInternal }');
    });

    it('should handle all primitive types', () => {
      const schemas: ContentTypeDefinition[] = [
        {
          name: 'AllTypes',
          fields: [
            { name: 'str', type: 'string', required: true },
            { name: 'num', type: 'number', required: true },
            { name: 'bool', type: 'boolean', required: true },
            { name: 'nul', type: 'null', required: true },
            { name: 'unk', type: 'unknown', required: true },
          ],
        },
      ];

      const generator = new TypeScriptGenerator();
      const code = generator.generate(schemas);

      expect(code).toContain('str: string;');
      expect(code).toContain('num: number;');
      expect(code).toContain('bool: boolean;');
      expect(code).toContain('nul: null;');
      expect(code).toContain('unk: unknown;');
    });

    it('should handle array types', () => {
      const schemas: ContentTypeDefinition[] = [
        {
          name: 'WithArrays',
          fields: [
            {
              name: 'tags',
              type: 'array',
              required: true,
              arrayItemType: { name: 'item', type: 'string', required: true },
            },
            {
              name: 'scores',
              type: 'array',
              required: true,
              arrayItemType: { name: 'item', type: 'number', required: true },
            },
          ],
        },
      ];

      const generator = new TypeScriptGenerator();
      const code = generator.generate(schemas);

      expect(code).toContain('tags: string[];');
      expect(code).toContain('scores: number[];');
    });

    it('should handle array without item type', () => {
      const schemas: ContentTypeDefinition[] = [
        {
          name: 'WithArray',
          fields: [{ name: 'items', type: 'array', required: true }],
        },
      ];

      const generator = new TypeScriptGenerator();
      const code = generator.generate(schemas);

      expect(code).toContain('items: unknown[];');
    });

    it('should handle object types with inline fields', () => {
      const schemas: ContentTypeDefinition[] = [
        {
          name: 'WithObject',
          fields: [
            {
              name: 'address',
              type: 'object',
              required: true,
              objectFields: [
                { name: 'street', type: 'string', required: true },
                { name: 'city', type: 'string', required: true },
                { name: 'zip', type: 'number', required: false },
              ],
            },
          ],
        },
      ];

      const generator = new TypeScriptGenerator();
      const code = generator.generate(schemas);

      expect(code).toContain('address: {');
      expect(code).toContain('street: string;');
      expect(code).toContain('city: string;');
      expect(code).toContain('zip?: number;');
    });

    it('should handle object without fields', () => {
      const schemas: ContentTypeDefinition[] = [
        {
          name: 'WithObject',
          fields: [{ name: 'data', type: 'object', required: true }],
        },
      ];

      const generator = new TypeScriptGenerator();
      const code = generator.generate(schemas);

      expect(code).toContain('data: Record<string, unknown>;');
    });

    it('should handle reference types', () => {
      const schemas: ContentTypeDefinition[] = [
        {
          name: 'Product',
          fields: [
            {
              name: 'category',
              type: 'reference',
              required: true,
              referenceType: 'Category',
            },
          ],
        },
      ];

      const generator = new TypeScriptGenerator();
      const code = generator.generate(schemas);

      expect(code).toContain('category: Category;');
    });

    it('should handle reference without type name', () => {
      const schemas: ContentTypeDefinition[] = [
        {
          name: 'Product',
          fields: [{ name: 'related', type: 'reference', required: true }],
        },
      ];

      const generator = new TypeScriptGenerator();
      const code = generator.generate(schemas);

      expect(code).toContain('related: unknown;');
    });

    it('should handle array of references', () => {
      const schemas: ContentTypeDefinition[] = [
        {
          name: 'Store',
          fields: [
            {
              name: 'products',
              type: 'array',
              required: true,
              arrayItemType: {
                name: 'item',
                type: 'reference',
                required: true,
                referenceType: 'Product',
              },
            },
          ],
        },
      ];

      const generator = new TypeScriptGenerator();
      const code = generator.generate(schemas);

      expect(code).toContain('products: Product[];');
    });

    it('should escape field names with special characters', () => {
      const schemas: ContentTypeDefinition[] = [
        {
          name: 'Special',
          fields: [
            { name: 'normal-name', type: 'string', required: true },
            { name: 'with spaces', type: 'string', required: true },
            { name: '123numeric', type: 'string', required: true },
            { name: 'validName', type: 'string', required: true },
          ],
        },
      ];

      const generator = new TypeScriptGenerator();
      const code = generator.generate(schemas);

      expect(code).toContain("'normal-name': string;");
      expect(code).toContain("'with spaces': string;");
      expect(code).toContain("'123numeric': string;");
      expect(code).toContain('validName: string;');
    });

    it('should generate multiple types', () => {
      const schemas: ContentTypeDefinition[] = [
        {
          name: 'Product',
          owner: 'test-source',
          fields: [{ name: 'name', type: 'string', required: true }],
        },
        {
          name: 'Category',
          owner: 'test-source',
          fields: [{ name: 'title', type: 'string', required: true }],
        },
      ];

      const generator = new TypeScriptGenerator();
      const code = generator.generate(schemas);

      expect(code).toContain('export interface Product {');
      expect(code).toContain('export interface Category {');
      expect(code).toContain(
        "internal: NodeInternal<'Product', 'test-source'>;"
      );
      expect(code).toContain(
        "internal: NodeInternal<'Category', 'test-source'>;"
      );
    });

    it('should handle empty schemas array', () => {
      const generator = new TypeScriptGenerator();
      const code = generator.generate([]);

      expect(code).toContain('Auto-generated TypeScript types');
      // No imports when there are no schemas
      expect(code).not.toContain('import type { NodeInternal }');
    });

    it('should include header comment', () => {
      const generator = new TypeScriptGenerator();
      const code = generator.generate([]);

      expect(code).toContain('Auto-generated TypeScript types');
      expect(code).toContain('Generated by @udl/codegen');
      expect(code).toContain('DO NOT EDIT MANUALLY');
    });

    it('should use custom indent', () => {
      const schemas: ContentTypeDefinition[] = [
        {
          name: 'Product',
          fields: [{ name: 'name', type: 'string', required: true }],
        },
      ];

      const generator = new TypeScriptGenerator({ indent: '    ' }); // 4 spaces
      const code = generator.generate(schemas);

      expect(code).toContain('    name: string;');
    });
  });

  describe('generateType', () => {
    it('should generate a single type with internal field', () => {
      const schema: ContentTypeDefinition = {
        name: 'Product',
        owner: 'test-source',
        fields: [{ name: 'name', type: 'string', required: true }],
      };

      const generator = new TypeScriptGenerator();
      const code = generator.generateType(schema);

      expect(code).toContain('export interface Product {');
      expect(code).toContain('name: string;');
      expect(code).toContain(
        "internal: NodeInternal<'Product', 'test-source'>;"
      );
      // Should not have import - that's only in full generate()
      expect(code).not.toContain('import');
    });
  });
});

describe('generateTypeScript', () => {
  it('should be a convenience function', () => {
    const schemas: ContentTypeDefinition[] = [
      {
        name: 'Product',
        owner: 'test-source',
        fields: [{ name: 'name', type: 'string', required: true }],
      },
    ];

    const code = generateTypeScript(schemas);

    expect(code).toContain('export interface Product {');
    expect(code).toContain("internal: NodeInternal<'Product', 'test-source'>;");
  });

  it('should accept options', () => {
    const schemas: ContentTypeDefinition[] = [
      {
        name: 'Product',
        fields: [{ name: 'name', type: 'string', required: true }],
      },
    ];

    const code = generateTypeScript(schemas, { includeInternal: false });

    expect(code).toContain('export interface Product {');
    expect(code).not.toContain('internal:');
  });
});
