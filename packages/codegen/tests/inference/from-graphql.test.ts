import { describe, it, expect, beforeEach } from 'vitest';
import {
  parseIntrospectionResult,
  clearIntrospectionCache,
} from '../../src/inference/from-graphql.js';

// Mock introspection result for testing
function createMockIntrospectionResult(types: unknown[]) {
  return {
    data: {
      __schema: {
        types,
      },
    },
  };
}

describe('parseIntrospectionResult', () => {
  beforeEach(() => {
    clearIntrospectionCache();
  });

  it('should parse a simple object type', () => {
    const result = createMockIntrospectionResult([
      {
        kind: 'OBJECT',
        name: 'Product',
        description: 'A product in the store',
        fields: [
          {
            name: 'id',
            description: 'Unique identifier',
            type: {
              kind: 'NON_NULL',
              name: null,
              ofType: { kind: 'SCALAR', name: 'ID', ofType: null },
            },
          },
          {
            name: 'name',
            description: 'Product name',
            type: {
              kind: 'NON_NULL',
              name: null,
              ofType: { kind: 'SCALAR', name: 'String', ofType: null },
            },
          },
          {
            name: 'price',
            description: null,
            type: { kind: 'SCALAR', name: 'Float', ofType: null },
          },
        ],
      },
    ]);

    const schemas = parseIntrospectionResult(result as never);

    expect(schemas).toHaveLength(1);
    expect(schemas[0]?.name).toBe('Product');
    expect(schemas[0]?.description).toBe('A product in the store');
    expect(schemas[0]?.fields).toHaveLength(3);

    const idField = schemas[0]?.fields.find((f) => f.name === 'id');
    expect(idField?.type).toBe('string'); // ID maps to string
    expect(idField?.required).toBe(true);
    expect(idField?.description).toBe('Unique identifier');

    const nameField = schemas[0]?.fields.find((f) => f.name === 'name');
    expect(nameField?.type).toBe('string');
    expect(nameField?.required).toBe(true);

    const priceField = schemas[0]?.fields.find((f) => f.name === 'price');
    expect(priceField?.type).toBe('number'); // Float maps to number
    expect(priceField?.required).toBe(false);
  });

  it('should handle list types', () => {
    const result = createMockIntrospectionResult([
      {
        kind: 'OBJECT',
        name: 'Category',
        description: null,
        fields: [
          {
            name: 'tags',
            description: null,
            type: {
              kind: 'LIST',
              name: null,
              ofType: { kind: 'SCALAR', name: 'String', ofType: null },
            },
          },
          {
            name: 'requiredTags',
            description: null,
            type: {
              kind: 'NON_NULL',
              name: null,
              ofType: {
                kind: 'LIST',
                name: null,
                ofType: { kind: 'SCALAR', name: 'String', ofType: null },
              },
            },
          },
        ],
      },
    ]);

    const schemas = parseIntrospectionResult(result as never);

    const tagsField = schemas[0]?.fields.find((f) => f.name === 'tags');
    expect(tagsField?.type).toBe('array');
    expect(tagsField?.required).toBe(false);
    expect(tagsField?.arrayItemType?.type).toBe('string');

    const requiredTagsField = schemas[0]?.fields.find(
      (f) => f.name === 'requiredTags'
    );
    expect(requiredTagsField?.type).toBe('array');
    expect(requiredTagsField?.required).toBe(true);
  });

  it('should handle references to other types', () => {
    const result = createMockIntrospectionResult([
      {
        kind: 'OBJECT',
        name: 'Product',
        description: null,
        fields: [
          {
            name: 'category',
            description: null,
            type: { kind: 'OBJECT', name: 'Category', ofType: null },
          },
        ],
      },
      {
        kind: 'OBJECT',
        name: 'Category',
        description: null,
        fields: [
          {
            name: 'name',
            description: null,
            type: { kind: 'SCALAR', name: 'String', ofType: null },
          },
        ],
      },
    ]);

    const schemas = parseIntrospectionResult(result as never);

    expect(schemas).toHaveLength(2);

    const productSchema = schemas.find((s) => s.name === 'Product');
    const categoryField = productSchema?.fields.find(
      (f) => f.name === 'category'
    );
    expect(categoryField?.type).toBe('reference');
    expect(categoryField?.referenceType).toBe('Category');
  });

  it('should handle array of references', () => {
    const result = createMockIntrospectionResult([
      {
        kind: 'OBJECT',
        name: 'Store',
        description: null,
        fields: [
          {
            name: 'products',
            description: null,
            type: {
              kind: 'LIST',
              name: null,
              ofType: { kind: 'OBJECT', name: 'Product', ofType: null },
            },
          },
        ],
      },
      {
        kind: 'OBJECT',
        name: 'Product',
        description: null,
        fields: [
          {
            name: 'name',
            description: null,
            type: { kind: 'SCALAR', name: 'String', ofType: null },
          },
        ],
      },
    ]);

    const schemas = parseIntrospectionResult(result as never);

    const storeSchema = schemas.find((s) => s.name === 'Store');
    const productsField = storeSchema?.fields.find(
      (f) => f.name === 'products'
    );
    expect(productsField?.type).toBe('array');
    expect(productsField?.arrayItemType?.type).toBe('reference');
    expect(productsField?.arrayItemType?.referenceType).toBe('Product');
  });

  it('should exclude built-in types', () => {
    const result = createMockIntrospectionResult([
      {
        kind: 'OBJECT',
        name: 'Query',
        description: null,
        fields: [],
      },
      {
        kind: 'OBJECT',
        name: 'Mutation',
        description: null,
        fields: [],
      },
      {
        kind: 'OBJECT',
        name: '__Schema',
        description: null,
        fields: [],
      },
      {
        kind: 'OBJECT',
        name: 'Product',
        description: null,
        fields: [],
      },
    ]);

    const schemas = parseIntrospectionResult(result as never);

    expect(schemas).toHaveLength(1);
    expect(schemas[0]?.name).toBe('Product');
  });

  it('should exclude custom types via excludeTypes option', () => {
    const result = createMockIntrospectionResult([
      {
        kind: 'OBJECT',
        name: 'Product',
        description: null,
        fields: [],
      },
      {
        kind: 'OBJECT',
        name: 'InternalType',
        description: null,
        fields: [],
      },
    ]);

    const schemas = parseIntrospectionResult(result as never, {
      excludeTypes: ['InternalType'],
    });

    expect(schemas).toHaveLength(1);
    expect(schemas[0]?.name).toBe('Product');
  });

  it('should use custom scalar mappings', () => {
    const result = createMockIntrospectionResult([
      {
        kind: 'OBJECT',
        name: 'Event',
        description: null,
        fields: [
          {
            name: 'createdAt',
            description: null,
            type: { kind: 'SCALAR', name: 'DateTime', ofType: null },
          },
          {
            name: 'metadata',
            description: null,
            type: { kind: 'SCALAR', name: 'JSON', ofType: null },
          },
        ],
      },
    ]);

    const schemas = parseIntrospectionResult(result as never, {
      customScalars: {
        DateTime: 'string',
        JSON: 'object',
      },
    });

    const createdAtField = schemas[0]?.fields.find(
      (f) => f.name === 'createdAt'
    );
    expect(createdAtField?.type).toBe('string');

    const metadataField = schemas[0]?.fields.find((f) => f.name === 'metadata');
    expect(metadataField?.type).toBe('object');
  });

  it('should filter out non-OBJECT types', () => {
    const result = createMockIntrospectionResult([
      {
        kind: 'SCALAR',
        name: 'String',
        description: null,
        fields: null,
      },
      {
        kind: 'ENUM',
        name: 'Status',
        description: null,
        fields: null,
      },
      {
        kind: 'INTERFACE',
        name: 'Node',
        description: null,
        fields: [
          {
            name: 'id',
            description: null,
            type: { kind: 'SCALAR', name: 'ID', ofType: null },
          },
        ],
      },
      {
        kind: 'OBJECT',
        name: 'Product',
        description: null,
        fields: [],
      },
    ]);

    const schemas = parseIntrospectionResult(result as never);

    expect(schemas).toHaveLength(1);
    expect(schemas[0]?.name).toBe('Product');
  });

  it('should handle deeply nested NON_NULL and LIST types', () => {
    const result = createMockIntrospectionResult([
      {
        kind: 'OBJECT',
        name: 'Response',
        description: null,
        fields: [
          {
            name: 'items',
            description: null,
            type: {
              kind: 'NON_NULL',
              name: null,
              ofType: {
                kind: 'LIST',
                name: null,
                ofType: {
                  kind: 'NON_NULL',
                  name: null,
                  ofType: { kind: 'SCALAR', name: 'String', ofType: null },
                },
              },
            },
          },
        ],
      },
    ]);

    const schemas = parseIntrospectionResult(result as never);

    const itemsField = schemas[0]?.fields.find((f) => f.name === 'items');
    expect(itemsField?.type).toBe('array');
    expect(itemsField?.required).toBe(true);
    expect(itemsField?.arrayItemType?.type).toBe('string');
  });

  it('should handle unknown scalar types as unknown', () => {
    const result = createMockIntrospectionResult([
      {
        kind: 'OBJECT',
        name: 'Thing',
        description: null,
        fields: [
          {
            name: 'customField',
            description: null,
            type: { kind: 'SCALAR', name: 'CustomScalar', ofType: null },
          },
        ],
      },
    ]);

    const schemas = parseIntrospectionResult(result as never);

    const customField = schemas[0]?.fields.find(
      (f) => f.name === 'customField'
    );
    expect(customField?.type).toBe('unknown');
  });

  it('should handle empty fields array', () => {
    const result = createMockIntrospectionResult([
      {
        kind: 'OBJECT',
        name: 'EmptyType',
        description: null,
        fields: [],
      },
    ]);

    const schemas = parseIntrospectionResult(result as never);

    expect(schemas).toHaveLength(1);
    expect(schemas[0]?.name).toBe('EmptyType');
    expect(schemas[0]?.fields).toEqual([]);
  });

  it('should handle null fields', () => {
    const result = createMockIntrospectionResult([
      {
        kind: 'OBJECT',
        name: 'NullFieldsType',
        description: null,
        fields: null,
      },
    ]);

    const schemas = parseIntrospectionResult(result as never);

    expect(schemas).toHaveLength(1);
    expect(schemas[0]?.name).toBe('NullFieldsType');
    expect(schemas[0]?.fields).toEqual([]);
  });
});

describe('clearIntrospectionCache', () => {
  it('should clear cache without errors', () => {
    expect(() => clearIntrospectionCache()).not.toThrow();
    expect(() =>
      clearIntrospectionCache('http://example.com/graphql')
    ).not.toThrow();
  });
});
