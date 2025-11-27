import { describe, it, expect } from 'vitest';
import {
  FetchHelperGenerator,
  generateFetchHelpers,
} from '@/codegen/generators/fetch-helpers.js';
import type { ContentTypeDefinition } from '@/codegen/types/schema.js';

describe('FetchHelperGenerator', () => {
  describe('generate', () => {
    it('should generate getAll function', () => {
      const schemas: ContentTypeDefinition[] = [
        {
          name: 'Product',
          fields: [
            { name: 'name', type: 'string', required: true },
            { name: 'price', type: 'number', required: true },
          ],
        },
      ];

      const generator = new FetchHelperGenerator();
      const code = generator.generate(schemas);

      expect(code).toContain(
        'export async function getAllProducts(): Promise<Product[]>'
      );
      expect(code).toContain('allProduct');
    });

    it('should generate getById function', () => {
      const schemas: ContentTypeDefinition[] = [
        {
          name: 'Product',
          fields: [{ name: 'name', type: 'string', required: true }],
        },
      ];

      const generator = new FetchHelperGenerator();
      const code = generator.generate(schemas);

      expect(code).toContain(
        'export async function getProductById(id: string): Promise<Product | null>'
      );
      expect(code).toContain('product(id: $id)');
    });

    it('should generate getByIndex function for indexed fields', () => {
      const schemas: ContentTypeDefinition[] = [
        {
          name: 'Product',
          fields: [
            { name: 'name', type: 'string', required: true },
            { name: 'slug', type: 'string', required: true },
          ],
          indexes: ['slug'],
        },
      ];

      const generator = new FetchHelperGenerator();
      const code = generator.generate(schemas);

      expect(code).toContain(
        'export async function getProductBySlug(slug: string): Promise<Product | null>'
      );
      expect(code).toContain('productBySlug(slug: $slug)');
    });

    it('should generate multiple getByIndex functions', () => {
      const schemas: ContentTypeDefinition[] = [
        {
          name: 'Product',
          fields: [
            { name: 'name', type: 'string', required: true },
            { name: 'slug', type: 'string', required: true },
            { name: 'sku', type: 'string', required: true },
          ],
          indexes: ['slug', 'sku'],
        },
      ];

      const generator = new FetchHelperGenerator();
      const code = generator.generate(schemas);

      expect(code).toContain('getProductBySlug');
      expect(code).toContain('getProductBySku');
    });

    it('should include JSDoc comments by default', () => {
      const schemas: ContentTypeDefinition[] = [
        {
          name: 'Product',
          fields: [{ name: 'name', type: 'string', required: true }],
        },
      ];

      const generator = new FetchHelperGenerator();
      const code = generator.generate(schemas);

      expect(code).toContain('* Fetch all Product nodes.');
      expect(code).toContain(
        '* @returns Promise resolving to array of Product'
      );
      expect(code).toContain('* Fetch a Product by its internal ID.');
      expect(code).toContain('* @param id - The internal ID of the Product');
    });

    it('should skip JSDoc when disabled', () => {
      const schemas: ContentTypeDefinition[] = [
        {
          name: 'Product',
          fields: [{ name: 'name', type: 'string', required: true }],
        },
      ];

      const generator = new FetchHelperGenerator({ includeJsDoc: false });
      const code = generator.generate(schemas);

      expect(code).not.toContain('* Fetch all Product nodes.');
      expect(code).not.toContain(
        '* @returns Promise resolving to array of Product'
      );
    });

    it('should import graphqlFetch from universal-data-layer/client', () => {
      const schemas: ContentTypeDefinition[] = [
        {
          name: 'Product',
          fields: [{ name: 'name', type: 'string', required: true }],
        },
      ];

      const generator = new FetchHelperGenerator();
      const code = generator.generate(schemas);

      expect(code).toContain(
        "import { graphqlFetch } from 'universal-data-layer/client'"
      );
    });

    it('should include internal fields by default', () => {
      const schemas: ContentTypeDefinition[] = [
        {
          name: 'Product',
          fields: [{ name: 'name', type: 'string', required: true }],
        },
      ];

      const generator = new FetchHelperGenerator();
      const code = generator.generate(schemas);

      expect(code).toContain('internal { id type owner }');
    });

    it('should exclude internal fields when disabled', () => {
      const schemas: ContentTypeDefinition[] = [
        {
          name: 'Product',
          fields: [{ name: 'name', type: 'string', required: true }],
        },
      ];

      const generator = new FetchHelperGenerator({
        includeInternalFields: false,
      });
      const code = generator.generate(schemas);

      expect(code).not.toContain('internal { id type owner }');
    });

    it('should handle nested object fields in query', () => {
      const schemas: ContentTypeDefinition[] = [
        {
          name: 'Product',
          fields: [
            { name: 'name', type: 'string', required: true },
            {
              name: 'address',
              type: 'object',
              required: true,
              objectFields: [
                { name: 'street', type: 'string', required: true },
                { name: 'city', type: 'string', required: true },
              ],
            },
          ],
        },
      ];

      const generator = new FetchHelperGenerator();
      const code = generator.generate(schemas);

      expect(code).toContain('address { street city }');
    });

    it('should pluralize type names correctly', () => {
      const schemas: ContentTypeDefinition[] = [
        {
          name: 'Category',
          fields: [{ name: 'name', type: 'string', required: true }],
        },
        {
          name: 'Status',
          fields: [{ name: 'name', type: 'string', required: true }],
        },
        {
          name: 'Box',
          fields: [{ name: 'name', type: 'string', required: true }],
        },
      ];

      const generator = new FetchHelperGenerator();
      const code = generator.generate(schemas);

      expect(code).toContain('getAllCategories');
      expect(code).toContain('getAllStatuses');
      expect(code).toContain('getAllBoxes');
    });

    it('should generate multiple type helpers', () => {
      const schemas: ContentTypeDefinition[] = [
        {
          name: 'Product',
          fields: [{ name: 'name', type: 'string', required: true }],
        },
        {
          name: 'Category',
          fields: [{ name: 'title', type: 'string', required: true }],
        },
      ];

      const generator = new FetchHelperGenerator();
      const code = generator.generate(schemas);

      expect(code).toContain('getAllProducts');
      expect(code).toContain('getProductById');
      expect(code).toContain('getAllCategories');
      expect(code).toContain('getCategoryById');
    });

    it('should include header comment', () => {
      const generator = new FetchHelperGenerator();
      const code = generator.generate([]);

      expect(code).toContain('Auto-generated fetch helpers');
      expect(code).toContain('Generated by universal-data-layer');
      expect(code).toContain('DO NOT EDIT MANUALLY');
    });

    it('should use custom indent', () => {
      const schemas: ContentTypeDefinition[] = [
        {
          name: 'Product',
          fields: [{ name: 'name', type: 'string', required: true }],
        },
      ];

      const generator = new FetchHelperGenerator({ indent: '    ' }); // 4 spaces
      const code = generator.generate(schemas);

      expect(code).toContain('    const data = await graphqlFetch');
    });

    it('should handle number type for indexed fields', () => {
      const schemas: ContentTypeDefinition[] = [
        {
          name: 'Product',
          fields: [
            { name: 'name', type: 'string', required: true },
            { name: 'id', type: 'number', required: true },
          ],
          indexes: ['id'],
        },
      ];

      const generator = new FetchHelperGenerator();
      const code = generator.generate(schemas);

      expect(code).toContain('getProductById(id: number)');
      expect(code).toContain('$id: Float!');
    });

    it('should handle boolean type for indexed fields', () => {
      const schemas: ContentTypeDefinition[] = [
        {
          name: 'Product',
          fields: [
            { name: 'name', type: 'string', required: true },
            { name: 'active', type: 'boolean', required: true },
          ],
          indexes: ['active'],
        },
      ];

      const generator = new FetchHelperGenerator();
      const code = generator.generate(schemas);

      expect(code).toContain('getProductByActive(active: boolean)');
      expect(code).toContain('$active: Boolean!');
    });
  });

  describe('generateHelpersForType', () => {
    it('should generate helpers for a single type', () => {
      const schema: ContentTypeDefinition = {
        name: 'Product',
        fields: [{ name: 'name', type: 'string', required: true }],
        indexes: ['name'],
      };

      const generator = new FetchHelperGenerator();
      const code = generator.generateHelpersForType(schema);

      expect(code).toContain('getAllProducts');
      expect(code).toContain('getProductById');
      expect(code).toContain('getProductByName');
      // Should not have header - that's only in full generate()
      expect(code).not.toContain('Auto-generated');
    });
  });
});

describe('generateFetchHelpers', () => {
  it('should be a convenience function', () => {
    const schemas: ContentTypeDefinition[] = [
      {
        name: 'Product',
        fields: [{ name: 'name', type: 'string', required: true }],
      },
    ];

    const code = generateFetchHelpers(schemas);

    expect(code).toContain('getAllProducts');
    expect(code).toContain('getProductById');
  });

  it('should accept options', () => {
    const schemas: ContentTypeDefinition[] = [
      {
        name: 'Product',
        fields: [{ name: 'name', type: 'string', required: true }],
      },
    ];

    const code = generateFetchHelpers(schemas, {
      includeJsDoc: false,
    });

    expect(code).not.toContain('* Fetch all Product nodes.');
  });
});

describe('Generated query structure', () => {
  it('should generate valid GraphQL query for getAll', () => {
    const schemas: ContentTypeDefinition[] = [
      {
        name: 'Product',
        fields: [
          { name: 'name', type: 'string', required: true },
          { name: 'price', type: 'number', required: true },
        ],
      },
    ];

    const code = generateFetchHelpers(schemas, {
      includeInternalFields: false,
    });

    // Check query structure
    expect(code).toMatch(/\{ allProduct \{ name price \} \}/);
  });

  it('should generate valid GraphQL query for getById', () => {
    const schemas: ContentTypeDefinition[] = [
      {
        name: 'Product',
        fields: [{ name: 'name', type: 'string', required: true }],
      },
    ];

    const code = generateFetchHelpers(schemas, {
      includeInternalFields: false,
    });

    // Check query structure with variable
    expect(code).toMatch(/query GetProductById\(\$id: ID!\)/);
    expect(code).toMatch(/product\(id: \$id\)/);
  });

  it('should generate valid GraphQL query for getByIndex', () => {
    const schemas: ContentTypeDefinition[] = [
      {
        name: 'Product',
        fields: [{ name: 'slug', type: 'string', required: true }],
        indexes: ['slug'],
      },
    ];

    const code = generateFetchHelpers(schemas, {
      includeInternalFields: false,
    });

    // Check query structure with variable
    expect(code).toMatch(/query GetProductBySlug\(\$slug: String!\)/);
    expect(code).toMatch(/productBySlug\(slug: \$slug\)/);
  });
});
