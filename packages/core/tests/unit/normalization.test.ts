import { describe, it, expect } from 'vitest';
import {
  normalizeResponse,
  normalizeGraphQLResult,
  defaultGetEntityKey,
} from '@/normalization/index.js';

describe('defaultGetEntityKey', () => {
  it('returns null for non-objects', () => {
    expect(defaultGetEntityKey(null)).toBe(null);
    expect(defaultGetEntityKey(undefined)).toBe(null);
    expect(defaultGetEntityKey('string')).toBe(null);
    expect(defaultGetEntityKey(123)).toBe(null);
    expect(defaultGetEntityKey(true)).toBe(null);
  });

  it('returns null for objects without internal', () => {
    expect(defaultGetEntityKey({})).toBe(null);
    expect(defaultGetEntityKey({ contentfulId: 'abc' })).toBe(null);
  });

  it('returns null for objects without type in internal', () => {
    expect(
      defaultGetEntityKey({
        internal: {},
        contentfulId: 'abc',
      })
    ).toBe(null);
  });

  it('returns null for objects without contentfulId', () => {
    expect(
      defaultGetEntityKey({
        internal: { type: 'ContentfulProduct' },
      })
    ).toBe(null);
  });

  it('returns entity key for valid entity objects', () => {
    expect(
      defaultGetEntityKey({
        internal: { type: 'ContentfulProduct' },
        contentfulId: 'abc123',
      })
    ).toBe('ContentfulProduct:abc123');
  });
});

describe('normalizeResponse', () => {
  it('returns empty entities for non-entity data', () => {
    const data = { name: 'test', count: 42 };
    const result = normalizeResponse(data);

    expect(result.data).toEqual(data);
    expect(result.$entities).toEqual({});
  });

  it('normalizes a single entity', () => {
    const data = {
      product: {
        internal: { type: 'ContentfulProduct' },
        contentfulId: 'p1',
        name: 'Test Product',
      },
    };

    const result = normalizeResponse(data);

    expect(result.data).toEqual({
      product: { $ref: 'ContentfulProduct:p1' },
    });
    expect(result.$entities).toEqual({
      'ContentfulProduct:p1': {
        internal: { type: 'ContentfulProduct' },
        contentfulId: 'p1',
        name: 'Test Product',
      },
    });
  });

  it('deduplicates repeated entities', () => {
    const swatch = {
      internal: { type: 'ContentfulSwatch' },
      contentfulId: 's1',
      color: '#ff0000',
    };

    const data = {
      products: [
        {
          internal: { type: 'ContentfulProduct' },
          contentfulId: 'p1',
          swatch,
        },
        {
          internal: { type: 'ContentfulProduct' },
          contentfulId: 'p2',
          swatch, // Same swatch reference
        },
      ],
    };

    const result = normalizeResponse(data);

    // Both products should reference the same swatch
    expect(result.data).toEqual({
      products: [
        { $ref: 'ContentfulProduct:p1' },
        { $ref: 'ContentfulProduct:p2' },
      ],
    });

    // Swatch should only appear once in entities
    expect(Object.keys(result.$entities)).toHaveLength(3);
    expect(result.$entities['ContentfulSwatch:s1']).toBeDefined();
    expect(result.$entities['ContentfulProduct:p1']).toEqual({
      internal: { type: 'ContentfulProduct' },
      contentfulId: 'p1',
      swatch: { $ref: 'ContentfulSwatch:s1' },
    });
    expect(result.$entities['ContentfulProduct:p2']).toEqual({
      internal: { type: 'ContentfulProduct' },
      contentfulId: 'p2',
      swatch: { $ref: 'ContentfulSwatch:s1' },
    });
  });

  it('normalizes deeply nested entities', () => {
    const data = {
      page: {
        internal: { type: 'ContentfulPage' },
        contentfulId: 'page1',
        sections: [
          {
            internal: { type: 'ContentfulSection' },
            contentfulId: 'sec1',
            blocks: [
              {
                internal: { type: 'ContentfulBlock' },
                contentfulId: 'block1',
                content: 'Hello',
              },
            ],
          },
        ],
      },
    };

    const result = normalizeResponse(data);

    expect(result.data).toEqual({
      page: { $ref: 'ContentfulPage:page1' },
    });

    expect(result.$entities['ContentfulPage:page1']).toEqual({
      internal: { type: 'ContentfulPage' },
      contentfulId: 'page1',
      sections: [{ $ref: 'ContentfulSection:sec1' }],
    });

    expect(result.$entities['ContentfulSection:sec1']).toEqual({
      internal: { type: 'ContentfulSection' },
      contentfulId: 'sec1',
      blocks: [{ $ref: 'ContentfulBlock:block1' }],
    });

    expect(result.$entities['ContentfulBlock:block1']).toEqual({
      internal: { type: 'ContentfulBlock' },
      contentfulId: 'block1',
      content: 'Hello',
    });
  });

  it('handles arrays of primitives', () => {
    const data = {
      tags: ['a', 'b', 'c'],
      numbers: [1, 2, 3],
    };

    const result = normalizeResponse(data);

    expect(result.data).toEqual(data);
    expect(result.$entities).toEqual({});
  });

  it('accepts custom getEntityKey function', () => {
    const data = {
      item: {
        __typename: 'Product',
        id: 'prod-1',
        name: 'Test',
      },
    };

    const result = normalizeResponse(data, {
      getEntityKey: (obj) => {
        const record = obj as Record<string, unknown>;
        if (record['__typename'] && record['id']) {
          return `${record['__typename']}:${record['id']}`;
        }
        return null;
      },
    });

    expect(result.data).toEqual({
      item: { $ref: 'Product:prod-1' },
    });
    expect(result.$entities['Product:prod-1']).toEqual({
      __typename: 'Product',
      id: 'prod-1',
      name: 'Test',
    });
  });
});

describe('normalizeGraphQLResult', () => {
  it('normalizes result with data', () => {
    const result = {
      data: {
        product: {
          internal: { type: 'Product' },
          contentfulId: 'p1',
          name: 'Test',
        },
      },
    };

    const normalized = normalizeGraphQLResult(result);

    expect(normalized.data).toEqual({
      product: { $ref: 'Product:p1' },
    });
    expect(normalized.$entities['Product:p1']).toBeDefined();
    expect(normalized.errors).toBeUndefined();
  });

  it('includes errors in result', () => {
    const result = {
      data: { product: null },
      errors: [{ message: 'Not found' }] as const,
    };

    const normalized = normalizeGraphQLResult(result);

    expect(normalized.data).toEqual({ product: null });
    expect(normalized.errors).toEqual([{ message: 'Not found' }]);
  });

  it('handles null data', () => {
    const result = {
      data: undefined,
    };

    const normalized = normalizeGraphQLResult(result);

    expect(normalized.data).toBe(null);
    expect(normalized.$entities).toEqual({});
  });
});
