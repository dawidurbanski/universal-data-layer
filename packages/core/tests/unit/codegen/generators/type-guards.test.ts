import { describe, it, expect } from 'vitest';
import {
  TypeGuardGenerator,
  generateTypeGuards,
} from '@/codegen/generators/type-guards.js';
import type { ContentTypeDefinition } from '@/codegen/types/schema.js';

describe('TypeGuardGenerator', () => {
  describe('generate', () => {
    it('should generate isGuard for a simple type', () => {
      const schemas: ContentTypeDefinition[] = [
        {
          name: 'Product',
          fields: [
            { name: 'name', type: 'string', required: true },
            { name: 'price', type: 'number', required: true },
          ],
        },
      ];

      const generator = new TypeGuardGenerator();
      const code = generator.generate(schemas);

      expect(code).toContain(
        'export function isProduct(value: unknown): value is Product'
      );
      expect(code).toContain("typeof obj['name'] !== 'string'");
      expect(code).toContain("typeof obj['price'] !== 'number'");
    });

    it('should generate assertGuard for a simple type', () => {
      const schemas: ContentTypeDefinition[] = [
        {
          name: 'Product',
          fields: [{ name: 'name', type: 'string', required: true }],
        },
      ];

      const generator = new TypeGuardGenerator();
      const code = generator.generate(schemas);

      expect(code).toContain(
        'export function assertProduct(value: unknown): asserts value is Product'
      );
      expect(code).toContain('if (!isProduct(value))');
      expect(code).toContain(
        "throw new TypeError('Value is not a valid Product')"
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

      const generator = new TypeGuardGenerator();
      const code = generator.generate(schemas);

      // Optional field should have existence check
      expect(code).toContain("if (obj['description'] !== undefined)");
      // Required field should not have existence check
      expect(code).not.toMatch(/if \(obj\['name'\] !== undefined\)/);
    });

    it('should generate JSDoc comments by default', () => {
      const schemas: ContentTypeDefinition[] = [
        {
          name: 'Product',
          fields: [{ name: 'name', type: 'string', required: true }],
        },
      ];

      const generator = new TypeGuardGenerator();
      const code = generator.generate(schemas);

      expect(code).toContain('* Type guard for Product.');
      expect(code).toContain('* @param value - The value to check');
      expect(code).toContain('* @returns True if value is a valid Product');
      expect(code).toContain('* Assertion guard for Product.');
      expect(code).toContain(
        '* @throws TypeError if value is not a valid Product'
      );
    });

    it('should skip JSDoc when disabled', () => {
      const schemas: ContentTypeDefinition[] = [
        {
          name: 'Product',
          fields: [{ name: 'name', type: 'string', required: true }],
        },
      ];

      const generator = new TypeGuardGenerator({ includeJsDoc: false });
      const code = generator.generate(schemas);

      expect(code).not.toContain('* Type guard for Product.');
      expect(code).not.toContain('* Assertion guard for Product.');
    });

    it('should only generate isGuards when assertGuards disabled', () => {
      const schemas: ContentTypeDefinition[] = [
        {
          name: 'Product',
          fields: [{ name: 'name', type: 'string', required: true }],
        },
      ];

      const generator = new TypeGuardGenerator({ generateAssertGuards: false });
      const code = generator.generate(schemas);

      expect(code).toContain('export function isProduct');
      expect(code).not.toContain('export function assertProduct');
    });

    it('should only generate assertGuards when isGuards disabled', () => {
      const schemas: ContentTypeDefinition[] = [
        {
          name: 'Product',
          fields: [{ name: 'name', type: 'string', required: true }],
        },
      ];

      const generator = new TypeGuardGenerator({ generateIsGuards: false });
      const code = generator.generate(schemas);

      expect(code).not.toContain('export function isProduct');
      expect(code).toContain('export function assertProduct');
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

      const generator = new TypeGuardGenerator();
      const code = generator.generate(schemas);

      expect(code).toContain("typeof obj['str'] !== 'string'");
      expect(code).toContain("typeof obj['num'] !== 'number'");
      expect(code).toContain("typeof obj['bool'] !== 'boolean'");
      expect(code).toContain("obj['nul'] !== null");
      // unknown type should not have any check
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
          ],
        },
      ];

      const generator = new TypeGuardGenerator();
      const code = generator.generate(schemas);

      expect(code).toContain("if (!Array.isArray(obj['tags']))");
    });

    it('should check array item types when enabled', () => {
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
          ],
        },
      ];

      const generator = new TypeGuardGenerator({ checkArrayItems: true });
      const code = generator.generate(schemas);

      expect(code).toContain(
        "if (!obj['tags'].every((item: unknown) => typeof item === 'string'))"
      );
    });

    it('should not check array items by default (performance)', () => {
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
          ],
        },
      ];

      const generator = new TypeGuardGenerator();
      const code = generator.generate(schemas);

      expect(code).not.toContain('.every(');
    });

    it('should skip array item check for non-primitive item types', () => {
      const schemas: ContentTypeDefinition[] = [
        {
          name: 'WithObjectArray',
          fields: [
            {
              name: 'items',
              type: 'array',
              required: true,
              arrayItemType: { name: 'item', type: 'object', required: true },
            },
          ],
        },
      ];

      // checkArrayItems is true, but item type is 'object' which returns null from getTypeofCheck
      const generator = new TypeGuardGenerator({ checkArrayItems: true });
      const code = generator.generate(schemas);

      // Should check it's an array
      expect(code).toContain("if (!Array.isArray(obj['items']))");
      // But should NOT generate .every() check since object type can't be checked with typeof
      expect(code).not.toContain('.every(');
    });

    it('should handle object types', () => {
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
              ],
            },
          ],
        },
      ];

      const generator = new TypeGuardGenerator();
      const code = generator.generate(schemas);

      expect(code).toContain("typeof obj['address'] !== 'object'");
      expect(code).toContain("obj['address'] === null");
      expect(code).toContain("Array.isArray(obj['address'])");
    });

    it('should check nested object fields with deepCheck enabled', () => {
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
              ],
            },
          ],
        },
      ];

      const generator = new TypeGuardGenerator({ deepCheck: true });
      const code = generator.generate(schemas);

      // Should check nested required fields (variable name is sanitized)
      expect(code).toContain('obj__address__Obj');
      expect(code).toContain("typeof obj__address__Obj['street'] !== 'string'");
      expect(code).toContain("typeof obj__address__Obj['city'] !== 'string'");
    });

    it('should skip nested field checks when deepCheck disabled', () => {
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
              ],
            },
          ],
        },
      ];

      const generator = new TypeGuardGenerator({ deepCheck: false });
      const code = generator.generate(schemas);

      // Should not check nested fields
      expect(code).not.toContain('obj__address__Obj');
      expect(code).not.toContain("typeof obj__address__Obj['street']");
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

      const generator = new TypeGuardGenerator();
      const code = generator.generate(schemas);

      // References are just checked as objects at runtime
      expect(code).toContain("typeof obj['category'] !== 'object'");
      expect(code).toContain("obj['category'] === null");
    });

    it('should handle fields with special characters', () => {
      const schemas: ContentTypeDefinition[] = [
        {
          name: 'Special',
          fields: [
            { name: 'normal-name', type: 'string', required: true },
            { name: 'with spaces', type: 'string', required: true },
          ],
        },
      ];

      const generator = new TypeGuardGenerator();
      const code = generator.generate(schemas);

      expect(code).toContain("obj['normal-name']");
      expect(code).toContain("obj['with spaces']");
    });

    it('should generate multiple type guards', () => {
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

      const generator = new TypeGuardGenerator();
      const code = generator.generate(schemas);

      expect(code).toContain('export function isProduct');
      expect(code).toContain('export function assertProduct');
      expect(code).toContain('export function isCategory');
      expect(code).toContain('export function assertCategory');
    });

    it('should include header comment', () => {
      const generator = new TypeGuardGenerator();
      const code = generator.generate([]);

      expect(code).toContain('Auto-generated type guards');
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

      const generator = new TypeGuardGenerator({ indent: '    ' }); // 4 spaces
      const code = generator.generate(schemas);

      expect(code).toContain("    if (typeof value !== 'object'");
    });

    it('should handle empty schemas array', () => {
      const generator = new TypeGuardGenerator();
      const code = generator.generate([]);

      expect(code).toContain('Auto-generated type guards');
      expect(code).not.toContain('export function is');
    });
  });

  describe('generateGuardsForType', () => {
    it('should generate guards for a single type', () => {
      const schema: ContentTypeDefinition = {
        name: 'Product',
        fields: [{ name: 'name', type: 'string', required: true }],
      };

      const generator = new TypeGuardGenerator();
      const code = generator.generateGuardsForType(schema);

      expect(code).toContain('export function isProduct');
      expect(code).toContain('export function assertProduct');
      // Should not have header - that's only in full generate()
      expect(code).not.toContain('Auto-generated');
    });
  });
});

describe('generateTypeGuards', () => {
  it('should be a convenience function', () => {
    const schemas: ContentTypeDefinition[] = [
      {
        name: 'Product',
        fields: [{ name: 'name', type: 'string', required: true }],
      },
    ];

    const code = generateTypeGuards(schemas);

    expect(code).toContain('export function isProduct');
    expect(code).toContain('export function assertProduct');
  });

  it('should accept options', () => {
    const schemas: ContentTypeDefinition[] = [
      {
        name: 'Product',
        fields: [{ name: 'name', type: 'string', required: true }],
      },
    ];

    const code = generateTypeGuards(schemas, { generateAssertGuards: false });

    expect(code).toContain('export function isProduct');
    expect(code).not.toContain('export function assertProduct');
  });
});

describe('Generated type guards at runtime', () => {
  // These tests verify that the generated code would work correctly
  // by checking specific patterns in the output

  it('should generate correct basic object check', () => {
    const schemas: ContentTypeDefinition[] = [
      {
        name: 'Test',
        fields: [{ name: 'id', type: 'string', required: true }],
      },
    ];

    const code = generateTypeGuards(schemas);

    // Should check for object and not null
    expect(code).toContain("if (typeof value !== 'object' || value === null)");
    expect(code).toContain('return false');
  });

  it('should cast to Record for property access', () => {
    const schemas: ContentTypeDefinition[] = [
      {
        name: 'Test',
        fields: [{ name: 'id', type: 'string', required: true }],
      },
    ];

    const code = generateTypeGuards(schemas);

    expect(code).toContain('const obj = value as Record<string, unknown>');
  });

  it('should return true after all checks pass', () => {
    const schemas: ContentTypeDefinition[] = [
      {
        name: 'Test',
        fields: [{ name: 'id', type: 'string', required: true }],
      },
    ];

    const code = generateTypeGuards(schemas);

    expect(code).toContain('return true;');
  });
});
