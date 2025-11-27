import { describe, it, expect } from 'vitest';
import {
  inferFieldType,
  inferFieldDefinition,
  mergeFieldDefinitions,
  inferSchemaFromStore,
  type NodeStoreLike,
} from '@/codegen/inference/from-store.js';

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
});
