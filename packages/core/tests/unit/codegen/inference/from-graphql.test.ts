import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  parseIntrospectionResult,
  clearIntrospectionCache,
  introspectGraphQLSchema,
} from '@/codegen/inference/from-graphql.js';

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

describe('parseIntrospectionResult edge cases', () => {
  beforeEach(() => {
    clearIntrospectionCache();
  });

  it('should handle list type with null baseName in item', () => {
    // This happens when a list type's item doesn't resolve to a named type
    // The implementation returns 'unknown' when baseName is null, even for lists
    const result = createMockIntrospectionResult([
      {
        kind: 'OBJECT',
        name: 'TypeWithNullBase',
        description: null,
        fields: [
          {
            name: 'nullField',
            description: null,
            // List with item type that has null name
            type: {
              kind: 'LIST',
              name: null,
              ofType: {
                kind: 'SCALAR',
                name: null, // No type name - results in null baseName
                ofType: null,
              },
            },
          },
        ],
      },
    ]);

    const schemas = parseIntrospectionResult(result as never);

    expect(schemas).toHaveLength(1);
    const field = schemas[0]?.fields.find((f) => f.name === 'nullField');
    // When baseName is null, the implementation returns 'unknown' and skips list handling
    expect(field?.type).toBe('unknown');
    expect(field?.arrayItemType).toBeUndefined();
  });

  it('should handle scalar field with null baseName', () => {
    const result = createMockIntrospectionResult([
      {
        kind: 'OBJECT',
        name: 'TypeWithNullScalar',
        description: null,
        fields: [
          {
            name: 'unknownField',
            description: 'A field without a type name',
            type: {
              kind: 'SCALAR',
              name: null,
              ofType: null,
            },
          },
        ],
      },
    ]);

    const schemas = parseIntrospectionResult(result as never);

    const field = schemas[0]?.fields.find((f) => f.name === 'unknownField');
    expect(field?.type).toBe('unknown');
    expect(field?.required).toBe(false);
  });
});

describe('introspectGraphQLSchema', () => {
  const mockEndpoint = 'http://localhost:4000/graphql';
  const mockIntrospectionData = {
    data: {
      __schema: {
        types: [
          {
            kind: 'OBJECT',
            name: 'Product',
            description: 'A product type',
            fields: [
              {
                name: 'id',
                description: null,
                type: {
                  kind: 'NON_NULL',
                  name: null,
                  ofType: { kind: 'SCALAR', name: 'ID', ofType: null },
                },
              },
            ],
          },
        ],
      },
    },
  };

  beforeEach(() => {
    clearIntrospectionCache();
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    clearIntrospectionCache();
  });

  it('should introspect a GraphQL endpoint successfully', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockIntrospectionData),
      })
    );

    const result = await introspectGraphQLSchema(mockEndpoint);

    expect(result).toHaveLength(1);
    expect(result[0]?.name).toBe('Product');
    expect(fetch).toHaveBeenCalledWith(
      mockEndpoint,
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
        }),
      })
    );
  });

  it('should include custom headers in the request', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockIntrospectionData),
      })
    );

    await introspectGraphQLSchema(mockEndpoint, {
      headers: { Authorization: 'Bearer token123' },
    });

    expect(fetch).toHaveBeenCalledWith(
      mockEndpoint,
      expect.objectContaining({
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          Authorization: 'Bearer token123',
        }),
      })
    );
  });

  it('should use cached results when available', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockIntrospectionData),
    });
    vi.stubGlobal('fetch', fetchMock);

    // First call
    const result1 = await introspectGraphQLSchema(mockEndpoint);
    // Second call should use cache
    const result2 = await introspectGraphQLSchema(mockEndpoint);

    expect(result1).toEqual(result2);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('should bypass cache when useCache is false', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockIntrospectionData),
    });
    vi.stubGlobal('fetch', fetchMock);

    // First call with cache enabled
    await introspectGraphQLSchema(mockEndpoint, { useCache: true });
    // Second call with cache disabled
    await introspectGraphQLSchema(mockEndpoint, { useCache: false });

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('should not cache when useCache is false', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockIntrospectionData),
    });
    vi.stubGlobal('fetch', fetchMock);

    // First call with cache disabled
    await introspectGraphQLSchema(mockEndpoint, { useCache: false });
    // Second call with cache disabled - should still fetch
    await introspectGraphQLSchema(mockEndpoint, { useCache: false });

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('should throw error when response is not ok', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
      })
    );

    await expect(introspectGraphQLSchema(mockEndpoint)).rejects.toThrow(
      'GraphQL introspection failed: 401 Unauthorized'
    );
  });

  it('should throw error when response is missing __schema.types', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: {} }),
      })
    );

    await expect(introspectGraphQLSchema(mockEndpoint)).rejects.toThrow(
      'Invalid introspection response: missing __schema.types'
    );
  });

  it('should throw error on timeout', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((_url, options) => {
        return new Promise((_resolve, reject) => {
          options?.signal?.addEventListener('abort', () => {
            const error = new Error('Aborted');
            error.name = 'AbortError';
            reject(error);
          });
        });
      })
    );

    await expect(
      introspectGraphQLSchema(mockEndpoint, { timeout: 10 })
    ).rejects.toThrow('GraphQL introspection timed out after 10ms');
  });

  it('should rethrow non-abort errors', async () => {
    const networkError = new Error('Network failure');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(networkError));

    await expect(introspectGraphQLSchema(mockEndpoint)).rejects.toThrow(
      'Network failure'
    );
  });

  it('should respect custom cacheTtl', async () => {
    vi.useFakeTimers();

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockIntrospectionData),
    });
    vi.stubGlobal('fetch', fetchMock);

    // First call
    await introspectGraphQLSchema(mockEndpoint, { cacheTtl: 1000 });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Advance time by 500ms - cache should still be valid
    vi.advanceTimersByTime(500);
    await introspectGraphQLSchema(mockEndpoint, { cacheTtl: 1000 });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Advance time by another 600ms - cache should be expired
    vi.advanceTimersByTime(600);
    await introspectGraphQLSchema(mockEndpoint, { cacheTtl: 1000 });
    expect(fetchMock).toHaveBeenCalledTimes(2);

    vi.useRealTimers();
  });

  it('should pass customScalars and excludeTypes to parseIntrospectionResult', async () => {
    const dataWithCustomScalar = {
      data: {
        __schema: {
          types: [
            {
              kind: 'OBJECT',
              name: 'Event',
              description: null,
              fields: [
                {
                  name: 'timestamp',
                  description: null,
                  type: { kind: 'SCALAR', name: 'DateTime', ofType: null },
                },
              ],
            },
            {
              kind: 'OBJECT',
              name: 'InternalOnly',
              description: null,
              fields: [],
            },
          ],
        },
      },
    };

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(dataWithCustomScalar),
      })
    );

    const result = await introspectGraphQLSchema(mockEndpoint, {
      customScalars: { DateTime: 'string' },
      excludeTypes: ['InternalOnly'],
      useCache: false,
    });

    expect(result).toHaveLength(1);
    expect(result[0]?.name).toBe('Event');
    const timestampField = result[0]?.fields.find(
      (f) => f.name === 'timestamp'
    );
    expect(timestampField?.type).toBe('string');
  });

  it('should handle response with null data', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: null }),
      })
    );

    await expect(introspectGraphQLSchema(mockEndpoint)).rejects.toThrow(
      'Invalid introspection response: missing __schema.types'
    );
  });
});
