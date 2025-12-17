import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  inferFieldType,
  inferFieldDefinition,
  mergeFieldDefinitions,
  mergeFieldArrays,
  inferSchemaFromStore,
  type NodeStoreLike,
  type TypeSchemaInfo,
} from '@/codegen/inference/from-store.js';
import { defaultRegistry } from '@/references/index.js';
import { z } from 'zod';

describe('inferFieldType', () => {
  it('should infer null type', () => {
    expect(inferFieldType(null)).toBe('null');
  });

  it('should infer unknown type for undefined', () => {
    expect(inferFieldType(undefined)).toBe('unknown');
  });

  it('should infer string type', () => {
    expect(inferFieldType('hello')).toBe('string');
    expect(inferFieldType('')).toBe('string');
  });

  it('should infer number type', () => {
    expect(inferFieldType(42)).toBe('number');
    expect(inferFieldType(3.14)).toBe('number');
    expect(inferFieldType(0)).toBe('number');
  });

  it('should infer boolean type', () => {
    expect(inferFieldType(true)).toBe('boolean');
    expect(inferFieldType(false)).toBe('boolean');
  });

  it('should infer array type', () => {
    expect(inferFieldType([])).toBe('array');
    expect(inferFieldType([1, 2, 3])).toBe('array');
    expect(inferFieldType(['a', 'b'])).toBe('array');
  });

  it('should infer object type', () => {
    expect(inferFieldType({})).toBe('object');
    expect(inferFieldType({ foo: 'bar' })).toBe('object');
  });

  it('should infer unknown for functions', () => {
    expect(inferFieldType(() => {})).toBe('unknown');
  });

  it('should infer unknown for symbols', () => {
    expect(inferFieldType(Symbol('test'))).toBe('unknown');
  });

  it('should infer unknown for bigint', () => {
    expect(inferFieldType(BigInt(123))).toBe('unknown');
  });
});

describe('inferFieldDefinition', () => {
  it('should infer simple string field', () => {
    const field = inferFieldDefinition('name', 'John');
    expect(field).toEqual({
      name: 'name',
      type: 'string',
      required: true,
    });
  });

  it('should infer simple number field', () => {
    const field = inferFieldDefinition('age', 25);
    expect(field).toEqual({
      name: 'age',
      type: 'number',
      required: true,
    });
  });

  it('should infer array field with item type', () => {
    const field = inferFieldDefinition('tags', ['a', 'b', 'c']);
    expect(field.name).toBe('tags');
    expect(field.type).toBe('array');
    expect(field.required).toBe(true);
    expect(field.arrayItemType).toEqual({
      name: 'item',
      type: 'string',
      required: true,
    });
  });

  it('should infer empty array with unknown item type', () => {
    const field = inferFieldDefinition('items', []);
    expect(field.type).toBe('array');
    expect(field.arrayItemType).toEqual({
      name: 'item',
      type: 'unknown',
      required: true,
    });
  });

  it('should infer nested object field', () => {
    const field = inferFieldDefinition('address', {
      street: '123 Main St',
      city: 'Springfield',
      zip: 12345,
    });

    expect(field.name).toBe('address');
    expect(field.type).toBe('object');
    expect(field.objectFields).toHaveLength(3);
    expect(field.objectFields).toContainEqual({
      name: 'street',
      type: 'string',
      required: true,
    });
    expect(field.objectFields).toContainEqual({
      name: 'city',
      type: 'string',
      required: true,
    });
    expect(field.objectFields).toContainEqual({
      name: 'zip',
      type: 'number',
      required: true,
    });
  });

  it('should infer array of objects', () => {
    const field = inferFieldDefinition('users', [
      { name: 'Alice', age: 30 },
      { name: 'Bob', age: 25 },
    ]);

    expect(field.type).toBe('array');
    expect(field.arrayItemType?.type).toBe('object');
    expect(field.arrayItemType?.objectFields).toHaveLength(2);
  });

  describe('reference detection', () => {
    beforeEach(() => {
      // Register a test resolver for reference detection
      defaultRegistry.registerResolver({
        id: 'test-plugin',
        markerField: '_testRef',
        lookupField: 'testId',
        isReference: (v) =>
          typeof v === 'object' &&
          v !== null &&
          '_testRef' in v &&
          (v as Record<string, unknown>)['_testRef'] === true,
        getLookupValue: (ref) =>
          (ref as Record<string, unknown>)['testId'] as string,
        getPossibleTypes: (ref) => {
          // Return possible types based on the testId in the reference
          const testId = (ref as Record<string, unknown>)['testId'] as string;
          if (testId === 'withType') {
            return ['TestType'];
          }
          if (testId === 'multiType') {
            return ['TypeA', 'TypeB'];
          }
          return [];
        },
      });
    });

    afterEach(() => {
      defaultRegistry.unregisterResolver('test-plugin');
    });

    it('should detect reference fields', () => {
      const refValue = { _testRef: true, testId: 'abc123' };
      const field = inferFieldDefinition('linkedItem', refValue);

      expect(field.type).toBe('reference');
      expect(field.required).toBe(true);
      expect(field.name).toBe('linkedItem');
    });

    it('should include referenceType when possible types are available', () => {
      const refValue = { _testRef: true, testId: 'withType' };
      const field = inferFieldDefinition('linkedItem', refValue);

      expect(field.type).toBe('reference');
      expect(field.referenceType).toBe('TestType');
    });

    it('should handle multiple possible types by joining them', () => {
      const refValue = { _testRef: true, testId: 'multiType' };
      const field = inferFieldDefinition('linkedItem', refValue);

      expect(field.type).toBe('reference');
      expect(field.referenceType).toBe('TypeA | TypeB');
    });

    it('should not set referenceType when no possible types', () => {
      const refValue = { _testRef: true, testId: 'unknownId' };
      const field = inferFieldDefinition('linkedItem', refValue);

      expect(field.type).toBe('reference');
      expect(field.referenceType).toBeUndefined();
    });
  });
});

describe('mergeFieldDefinitions', () => {
  it('should merge identical fields', () => {
    const a = { name: 'foo', type: 'string' as const, required: true };
    const b = { name: 'foo', type: 'string' as const, required: true };
    const merged = mergeFieldDefinitions(a, b);
    expect(merged).toEqual({ name: 'foo', type: 'string', required: true });
  });

  it('should mark field as optional if either is optional', () => {
    const a = { name: 'foo', type: 'string' as const, required: true };
    const b = { name: 'foo', type: 'string' as const, required: false };
    const merged = mergeFieldDefinitions(a, b);
    expect(merged.required).toBe(false);
  });

  it('should prefer non-null type over null', () => {
    const a = { name: 'foo', type: 'null' as const, required: true };
    const b = { name: 'foo', type: 'string' as const, required: true };
    const merged = mergeFieldDefinitions(a, b);
    expect(merged.type).toBe('string');
  });

  it('should prefer non-unknown type over unknown', () => {
    const a = { name: 'foo', type: 'unknown' as const, required: true };
    const b = { name: 'foo', type: 'number' as const, required: true };
    const merged = mergeFieldDefinitions(a, b);
    expect(merged.type).toBe('number');
  });

  it('should fall back to unknown when types conflict', () => {
    const a = { name: 'foo', type: 'string' as const, required: true };
    const b = { name: 'foo', type: 'number' as const, required: true };
    const merged = mergeFieldDefinitions(a, b);
    expect(merged.type).toBe('unknown');
  });

  it('should merge array item types', () => {
    const a = {
      name: 'items',
      type: 'array' as const,
      required: true,
      arrayItemType: { name: 'item', type: 'string' as const, required: true },
    };
    const b = {
      name: 'items',
      type: 'array' as const,
      required: true,
      arrayItemType: { name: 'item', type: 'string' as const, required: true },
    };
    const merged = mergeFieldDefinitions(a, b);
    expect(merged.arrayItemType).toEqual({
      name: 'item',
      type: 'string',
      required: true,
    });
  });

  it('should merge object fields and detect optional nested fields', () => {
    const a = {
      name: 'obj',
      type: 'object' as const,
      required: true,
      objectFields: [
        { name: 'shared', type: 'string' as const, required: true },
        { name: 'onlyInA', type: 'number' as const, required: true },
      ],
    };
    const b = {
      name: 'obj',
      type: 'object' as const,
      required: true,
      objectFields: [
        { name: 'shared', type: 'string' as const, required: true },
        { name: 'onlyInB', type: 'boolean' as const, required: true },
      ],
    };
    const merged = mergeFieldDefinitions(a, b);

    expect(merged.objectFields).toHaveLength(3);

    const sharedField = merged.objectFields?.find((f) => f.name === 'shared');
    expect(sharedField?.required).toBe(true);

    const onlyInAField = merged.objectFields?.find((f) => f.name === 'onlyInA');
    expect(onlyInAField?.required).toBe(false);

    const onlyInBField = merged.objectFields?.find((f) => f.name === 'onlyInB');
    expect(onlyInBField?.required).toBe(false);
  });

  it('should preserve description from either field', () => {
    const a = {
      name: 'foo',
      type: 'string' as const,
      required: true,
      description: 'Description A',
    };
    const b = { name: 'foo', type: 'string' as const, required: true };
    const merged = mergeFieldDefinitions(a, b);
    expect(merged.description).toBe('Description A');
  });

  it('should copy referenceType from b when a has null/unknown type', () => {
    const a = { name: 'ref', type: 'null' as const, required: true };
    const b = {
      name: 'ref',
      type: 'reference' as const,
      required: true,
      referenceType: 'SomeType',
    };
    const merged = mergeFieldDefinitions(a, b);
    expect(merged.type).toBe('reference');
    expect(merged.referenceType).toBe('SomeType');
  });

  it('should copy referenceType from b when a is unknown', () => {
    const a = { name: 'ref', type: 'unknown' as const, required: true };
    const b = {
      name: 'ref',
      type: 'reference' as const,
      required: true,
      referenceType: 'MyType',
    };
    const merged = mergeFieldDefinitions(a, b);
    expect(merged.type).toBe('reference');
    expect(merged.referenceType).toBe('MyType');
  });

  it('should clear referenceType when types genuinely conflict', () => {
    const a = {
      name: 'field',
      type: 'reference' as const,
      required: true,
      referenceType: 'TypeA',
    };
    const b = { name: 'field', type: 'string' as const, required: true };
    const merged = mergeFieldDefinitions(a, b);
    expect(merged.type).toBe('unknown');
    expect(merged.referenceType).toBeUndefined();
  });

  it('should prefer b referenceType when both are references and a has none', () => {
    const a = { name: 'ref', type: 'reference' as const, required: true };
    const b = {
      name: 'ref',
      type: 'reference' as const,
      required: true,
      referenceType: 'TypeFromB',
    };
    const merged = mergeFieldDefinitions(a, b);
    expect(merged.type).toBe('reference');
    expect(merged.referenceType).toBe('TypeFromB');
  });

  it('should keep a referenceType when both are references and both have it', () => {
    const a = {
      name: 'ref',
      type: 'reference' as const,
      required: true,
      referenceType: 'TypeFromA',
    };
    const b = {
      name: 'ref',
      type: 'reference' as const,
      required: true,
      referenceType: 'TypeFromB',
    };
    const merged = mergeFieldDefinitions(a, b);
    expect(merged.type).toBe('reference');
    expect(merged.referenceType).toBe('TypeFromA');
  });

  it('should use only a arrayItemType when b has none', () => {
    const a = {
      name: 'items',
      type: 'array' as const,
      required: true,
      arrayItemType: { name: 'item', type: 'string' as const, required: true },
    };
    const b = {
      name: 'items',
      type: 'array' as const,
      required: true,
    };
    const merged = mergeFieldDefinitions(a, b);
    expect(merged.arrayItemType).toEqual({
      name: 'item',
      type: 'string',
      required: true,
    });
  });

  it('should use only b arrayItemType when a has none', () => {
    const a = {
      name: 'items',
      type: 'array' as const,
      required: true,
    };
    const b = {
      name: 'items',
      type: 'array' as const,
      required: true,
      arrayItemType: { name: 'item', type: 'number' as const, required: true },
    };
    const merged = mergeFieldDefinitions(a, b);
    expect(merged.arrayItemType).toEqual({
      name: 'item',
      type: 'number',
      required: true,
    });
  });
});

describe('mergeFieldArrays', () => {
  it('should mark existing fields as optional when not in incoming', () => {
    const existing = [
      { name: 'a', type: 'string' as const, required: true },
      { name: 'b', type: 'number' as const, required: true },
    ];
    const incoming = [
      { name: 'a', type: 'string' as const, required: true },
      // 'b' is missing from incoming
    ];

    const result = mergeFieldArrays(existing, incoming);

    const fieldA = result.find((f) => f.name === 'a');
    const fieldB = result.find((f) => f.name === 'b');

    expect(fieldA?.required).toBe(true);
    expect(fieldB?.required).toBe(false); // Should be optional since not in incoming
  });

  it('should mark new incoming fields as optional', () => {
    const existing = [{ name: 'a', type: 'string' as const, required: true }];
    const incoming = [
      { name: 'a', type: 'string' as const, required: true },
      { name: 'c', type: 'boolean' as const, required: true }, // new field
    ];

    const result = mergeFieldArrays(existing, incoming);

    const fieldA = result.find((f) => f.name === 'a');
    const fieldC = result.find((f) => f.name === 'c');

    expect(fieldA?.required).toBe(true);
    expect(fieldC?.required).toBe(false); // New field should be optional
  });
});

describe('inferSchemaFromStore', () => {
  it('should infer schema from mock store', () => {
    const mockStore: NodeStoreLike = {
      getTypes: () => ['Product'],
      getByType: (type: string) => {
        if (type === 'Product') {
          return [
            {
              internal: {
                id: 'prod-1',
                type: 'Product',
                owner: 'test-plugin',
                contentDigest: 'abc123',
              },
              name: 'Widget',
              price: 29.99,
              inStock: true,
            },
            {
              internal: {
                id: 'prod-2',
                type: 'Product',
                owner: 'test-plugin',
                contentDigest: 'def456',
              },
              name: 'Gadget',
              price: 49.99,
              inStock: false,
              discount: 10,
            },
          ];
        }
        return [];
      },
      getRegisteredIndexes: (type: string) => {
        if (type === 'Product') {
          return ['slug'];
        }
        return [];
      },
    };

    const schemas = inferSchemaFromStore(mockStore);

    expect(schemas).toHaveLength(1);
    expect(schemas[0]?.name).toBe('Product');
    expect(schemas[0]?.owner).toBe('test-plugin');
    expect(schemas[0]?.indexes).toEqual(['slug']);

    const fields = schemas[0]?.fields;
    expect(fields).toBeDefined();

    // name field - present in both, required
    const nameField = fields?.find((f) => f.name === 'name');
    expect(nameField?.type).toBe('string');
    expect(nameField?.required).toBe(true);

    // price field - present in both, required
    const priceField = fields?.find((f) => f.name === 'price');
    expect(priceField?.type).toBe('number');
    expect(priceField?.required).toBe(true);

    // inStock field - present in both, required
    const inStockField = fields?.find((f) => f.name === 'inStock');
    expect(inStockField?.type).toBe('boolean');
    expect(inStockField?.required).toBe(true);

    // discount field - only in second node, optional
    const discountField = fields?.find((f) => f.name === 'discount');
    expect(discountField?.type).toBe('number');
    expect(discountField?.required).toBe(false);
  });

  it('should handle empty store', () => {
    const mockStore: NodeStoreLike = {
      getTypes: () => [],
      getByType: () => [],
      getRegisteredIndexes: () => [],
    };

    const schemas = inferSchemaFromStore(mockStore);
    expect(schemas).toEqual([]);
  });

  it('should exclude reserved fields (internal, parent, children)', () => {
    const mockStore: NodeStoreLike = {
      getTypes: () => ['TestNode'],
      getByType: () => [
        {
          internal: {
            id: 'test-1',
            type: 'TestNode',
            owner: 'test',
            contentDigest: 'abc',
          },
          parent: 'parent-id',
          children: ['child-1', 'child-2'],
          customField: 'value',
        },
      ],
      getRegisteredIndexes: () => [],
    };

    const schemas = inferSchemaFromStore(mockStore);
    const fields = schemas[0]?.fields;

    expect(fields?.some((f) => f.name === 'internal')).toBe(false);
    expect(fields?.some((f) => f.name === 'parent')).toBe(false);
    expect(fields?.some((f) => f.name === 'children')).toBe(false);
    expect(fields?.some((f) => f.name === 'customField')).toBe(true);
  });

  it('should respect includeOwner option', () => {
    const mockStore: NodeStoreLike = {
      getTypes: () => ['Test'],
      getByType: () => [
        {
          internal: {
            id: '1',
            type: 'Test',
            owner: 'my-plugin',
            contentDigest: 'x',
          },
          field: 'value',
        },
      ],
      getRegisteredIndexes: () => [],
    };

    const withOwner = inferSchemaFromStore(mockStore, { includeOwner: true });
    expect(withOwner[0]?.owner).toBe('my-plugin');

    const withoutOwner = inferSchemaFromStore(mockStore, {
      includeOwner: false,
    });
    expect(withoutOwner[0]?.owner).toBeUndefined();
  });

  it('should handle multiple node types', () => {
    const mockStore: NodeStoreLike = {
      getTypes: () => ['Product', 'Category'],
      getByType: (type: string) => {
        if (type === 'Product') {
          return [
            {
              internal: {
                id: 'p1',
                type: 'Product',
                owner: 'shop',
                contentDigest: 'a',
              },
              name: 'Item',
            },
          ];
        }
        if (type === 'Category') {
          return [
            {
              internal: {
                id: 'c1',
                type: 'Category',
                owner: 'shop',
                contentDigest: 'b',
              },
              title: 'Electronics',
            },
          ];
        }
        return [];
      },
      getRegisteredIndexes: () => [],
    };

    const schemas = inferSchemaFromStore(mockStore);
    expect(schemas).toHaveLength(2);
    expect(schemas.map((s) => s.name).sort()).toEqual(['Category', 'Product']);
  });

  it('should filter by types option', () => {
    const mockStore: NodeStoreLike = {
      getTypes: () => ['Product', 'Category', 'User'],
      getByType: (type: string) => {
        const nodes: Record<
          string,
          Array<{
            internal: {
              id: string;
              type: string;
              owner: string;
              contentDigest: string;
            };
            field: string;
          }>
        > = {
          Product: [
            {
              internal: {
                id: 'p1',
                type: 'Product',
                owner: 'shop',
                contentDigest: 'a',
              },
              field: 'val',
            },
          ],
          Category: [
            {
              internal: {
                id: 'c1',
                type: 'Category',
                owner: 'shop',
                contentDigest: 'b',
              },
              field: 'val',
            },
          ],
          User: [
            {
              internal: {
                id: 'u1',
                type: 'User',
                owner: 'auth',
                contentDigest: 'c',
              },
              field: 'val',
            },
          ],
        };
        return nodes[type] || [];
      },
      getRegisteredIndexes: () => [],
    };

    const schemas = inferSchemaFromStore(mockStore, {
      types: ['Product', 'User'],
    });
    expect(schemas).toHaveLength(2);
    expect(schemas.map((s) => s.name).sort()).toEqual(['Product', 'User']);
  });

  it('should filter by owners option', () => {
    const mockStore: NodeStoreLike = {
      getTypes: () => ['Product', 'Category', 'User'],
      getByType: (type: string) => {
        const nodes: Record<
          string,
          Array<{
            internal: {
              id: string;
              type: string;
              owner: string;
              contentDigest: string;
            };
            field: string;
          }>
        > = {
          Product: [
            {
              internal: {
                id: 'p1',
                type: 'Product',
                owner: 'shop-plugin',
                contentDigest: 'a',
              },
              field: 'val',
            },
          ],
          Category: [
            {
              internal: {
                id: 'c1',
                type: 'Category',
                owner: 'shop-plugin',
                contentDigest: 'b',
              },
              field: 'val',
            },
          ],
          User: [
            {
              internal: {
                id: 'u1',
                type: 'User',
                owner: 'auth-plugin',
                contentDigest: 'c',
              },
              field: 'val',
            },
          ],
        };
        return nodes[type] || [];
      },
      getRegisteredIndexes: () => [],
    };

    const schemas = inferSchemaFromStore(mockStore, {
      owners: ['shop-plugin'],
    });
    expect(schemas).toHaveLength(2);
    expect(schemas.map((s) => s.name).sort()).toEqual(['Category', 'Product']);
  });

  it('should give types filter precedence over owners filter', () => {
    const mockStore: NodeStoreLike = {
      getTypes: () => ['Product', 'Category', 'User'],
      getByType: (type: string) => {
        const nodes: Record<
          string,
          Array<{
            internal: {
              id: string;
              type: string;
              owner: string;
              contentDigest: string;
            };
            field: string;
          }>
        > = {
          Product: [
            {
              internal: {
                id: 'p1',
                type: 'Product',
                owner: 'shop-plugin',
                contentDigest: 'a',
              },
              field: 'val',
            },
          ],
          Category: [
            {
              internal: {
                id: 'c1',
                type: 'Category',
                owner: 'shop-plugin',
                contentDigest: 'b',
              },
              field: 'val',
            },
          ],
          User: [
            {
              internal: {
                id: 'u1',
                type: 'User',
                owner: 'auth-plugin',
                contentDigest: 'c',
              },
              field: 'val',
            },
          ],
        };
        return nodes[type] || [];
      },
      getRegisteredIndexes: () => [],
    };

    // types filter should take precedence - User should be included even though owner is different
    const schemas = inferSchemaFromStore(mockStore, {
      types: ['User'],
      owners: ['shop-plugin'],
    });
    expect(schemas).toHaveLength(1);
    expect(schemas[0]?.name).toBe('User');
  });

  it('should skip types with no nodes', () => {
    const mockStore: NodeStoreLike = {
      getTypes: () => ['Empty', 'HasNodes'],
      getByType: (type: string) => {
        if (type === 'HasNodes') {
          return [
            {
              internal: {
                id: '1',
                type: 'HasNodes',
                owner: 'test',
                contentDigest: 'x',
              },
              field: 'value',
            },
          ];
        }
        return []; // Empty type has no nodes
      },
      getRegisteredIndexes: () => [],
    };

    const schemas = inferSchemaFromStore(mockStore);
    expect(schemas).toHaveLength(1);
    expect(schemas[0]?.name).toBe('HasNodes');
  });

  it('should apply schema overrides when store provides them', () => {
    const mockStore: NodeStoreLike = {
      getTypes: () => ['TestType'],
      getByType: () => [
        {
          internal: {
            id: '1',
            type: 'TestType',
            owner: 'test',
            contentDigest: 'x',
          },
          status: 'active', // Inferred as string
          count: 5,
        },
      ],
      getRegisteredIndexes: () => [],
      getTypeSchema: (nodeType: string): TypeSchemaInfo | undefined => {
        if (nodeType === 'TestType') {
          return {
            overrides: {
              status: z.enum(['active', 'inactive', 'pending']),
            },
          };
        }
        return undefined;
      },
    };

    const schemas = inferSchemaFromStore(mockStore);
    expect(schemas).toHaveLength(1);

    const statusField = schemas[0]?.fields.find((f) => f.name === 'status');
    // After override, status should have literalValues (from zod enum)
    expect(statusField?.literalValues).toEqual([
      'active',
      'inactive',
      'pending',
    ]);
  });

  it('should not include indexes property when there are none', () => {
    const mockStore: NodeStoreLike = {
      getTypes: () => ['NoIndexes'],
      getByType: () => [
        {
          internal: {
            id: '1',
            type: 'NoIndexes',
            owner: 'test',
            contentDigest: 'x',
          },
          field: 'value',
        },
      ],
      getRegisteredIndexes: () => [], // No indexes
    };

    const schemas = inferSchemaFromStore(mockStore);
    expect(schemas[0]?.indexes).toBeUndefined();
  });

  it('should respect sampleSize option', () => {
    const nodes = Array.from({ length: 100 }, (_, i) => ({
      internal: {
        id: `${i}`,
        type: 'Large',
        owner: 'test',
        contentDigest: `${i}`,
      },
      field: `value${i}`,
      // Only first 5 nodes have 'extra' field
      ...(i < 5 ? { extra: 'extraValue' } : {}),
    }));

    const mockStore: NodeStoreLike = {
      getTypes: () => ['Large'],
      getByType: () => nodes,
      getRegisteredIndexes: () => [],
    };

    // With sampleSize 3, we'll only see nodes 0-2 which all have 'extra'
    const schemasSmall = inferSchemaFromStore(mockStore, { sampleSize: 3 });
    const extraSmall = schemasSmall[0]?.fields.find((f) => f.name === 'extra');
    expect(extraSmall?.required).toBe(true); // All sampled nodes have it

    // With sampleSize 10, we'll see nodes 0-9, where 0-4 have 'extra' and 5-9 don't
    const schemasLarge = inferSchemaFromStore(mockStore, { sampleSize: 10 });
    const extraLarge = schemasLarge[0]?.fields.find((f) => f.name === 'extra');
    expect(extraLarge?.required).toBe(false); // Not all sampled nodes have it
  });

  it('should not include owner when undefined', () => {
    const mockStore: NodeStoreLike = {
      getTypes: () => ['Test'],
      getByType: () => [
        {
          internal: {
            id: '1',
            type: 'Test',
            owner: undefined as unknown as string, // Explicitly undefined
            contentDigest: 'x',
          },
          field: 'value',
        },
      ],
      getRegisteredIndexes: () => [],
    };

    const schemas = inferSchemaFromStore(mockStore, { includeOwner: true });
    // owner should not be in the schema when undefined
    expect(schemas[0]?.owner).toBeUndefined();
  });
});
