import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  defaultGetEntityKey,
  normalizeResponse,
  normalizeGraphQLResult,
} from '@/normalization/index.js';
import {
  defaultRegistry,
  setDefaultRegistry,
  ReferenceRegistry,
} from '@/references/index.js';

describe('normalization', () => {
  describe('defaultGetEntityKey', () => {
    let originalRegistry: ReferenceRegistry;

    beforeEach(() => {
      // Save the original registry
      originalRegistry = defaultRegistry;
      // Create a fresh registry for each test
      setDefaultRegistry(new ReferenceRegistry());
    });

    afterEach(() => {
      // Restore the original registry
      setDefaultRegistry(originalRegistry);
    });

    it('returns null for non-object values', () => {
      expect(defaultGetEntityKey(null)).toBeNull();
      expect(defaultGetEntityKey(undefined)).toBeNull();
      expect(defaultGetEntityKey('string')).toBeNull();
      expect(defaultGetEntityKey(123)).toBeNull();
      expect(defaultGetEntityKey(true)).toBeNull();
    });

    it('returns key from internal.type:internal.id when available', () => {
      const obj = {
        internal: {
          type: 'Product',
          id: 'prod-123',
        },
        name: 'Test Product',
      };
      expect(defaultGetEntityKey(obj)).toBe('Product:prod-123');
    });

    it('returns null when internal.type is missing', () => {
      const obj = {
        internal: {
          id: 'prod-123',
        },
        name: 'Test Product',
      };
      expect(defaultGetEntityKey(obj)).toBeNull();
    });

    it('returns null when internal.id is missing', () => {
      const obj = {
        internal: {
          type: 'Product',
        },
        name: 'Test Product',
      };
      expect(defaultGetEntityKey(obj)).toBeNull();
    });

    it('returns null when internal is not present', () => {
      const obj = {
        name: 'Test Product',
      };
      expect(defaultGetEntityKey(obj)).toBeNull();
    });

    it('returns null for object without internal property', () => {
      const obj = { foo: 'bar' };
      expect(defaultGetEntityKey(obj)).toBeNull();
    });

    it('uses registry entity key when available', () => {
      // Register an entity key config
      defaultRegistry.registerEntityKeyConfig('test-plugin', {
        idField: 'contentfulId',
        priority: 10,
      });

      const obj = {
        __typename: 'Article',
        contentfulId: 'abc123',
        title: 'Test',
      };

      expect(defaultGetEntityKey(obj)).toBe('Article:abc123');
    });

    it('falls back to internal when registry returns null', () => {
      // Registry will return null because no entity key config matches
      const obj = {
        internal: {
          type: 'LocalType',
          id: 'local-1',
        },
        data: 'test',
      };

      expect(defaultGetEntityKey(obj)).toBe('LocalType:local-1');
    });
  });

  describe('normalizeResponse', () => {
    it('returns primitives unchanged', () => {
      expect(normalizeResponse('string').data).toBe('string');
      expect(normalizeResponse(123).data).toBe(123);
      expect(normalizeResponse(true).data).toBe(true);
      expect(normalizeResponse(null).data).toBeNull();
    });

    it('returns empty entities for primitives', () => {
      const result = normalizeResponse('test');
      expect(result.$entities).toEqual({});
    });

    it('normalizes simple object without entities', () => {
      const data = { name: 'test', value: 42 };
      const result = normalizeResponse(data);

      expect(result.data).toEqual({ name: 'test', value: 42 });
      expect(result.$entities).toEqual({});
    });

    it('extracts entity and replaces with ref', () => {
      const data = {
        product: {
          internal: { type: 'Product', id: 'p1' },
          name: 'Widget',
        },
      };

      const result = normalizeResponse(data);

      expect(result.data).toEqual({
        product: { $ref: 'Product:p1' },
      });
      expect(result.$entities).toEqual({
        'Product:p1': {
          internal: { type: 'Product', id: 'p1' },
          name: 'Widget',
        },
      });
    });

    it('normalizes nested entities', () => {
      const data = {
        product: {
          internal: { type: 'Product', id: 'p1' },
          name: 'Widget',
          category: {
            internal: { type: 'Category', id: 'c1' },
            name: 'Electronics',
          },
        },
      };

      const result = normalizeResponse(data);

      expect(result.data).toEqual({
        product: { $ref: 'Product:p1' },
      });
      expect(result.$entities['Product:p1']).toEqual({
        internal: { type: 'Product', id: 'p1' },
        name: 'Widget',
        category: { $ref: 'Category:c1' },
      });
      expect(result.$entities['Category:c1']).toEqual({
        internal: { type: 'Category', id: 'c1' },
        name: 'Electronics',
      });
    });

    it('deduplicates repeated entities', () => {
      const sharedCategory = {
        internal: { type: 'Category', id: 'c1' },
        name: 'Electronics',
      };

      const data = {
        products: [
          {
            internal: { type: 'Product', id: 'p1' },
            name: 'Widget',
            category: sharedCategory,
          },
          {
            internal: { type: 'Product', id: 'p2' },
            name: 'Gadget',
            category: sharedCategory,
          },
        ],
      };

      const result = normalizeResponse(data);

      // Both products should have refs to the same category
      expect(result.data).toEqual({
        products: [{ $ref: 'Product:p1' }, { $ref: 'Product:p2' }],
      });

      // Category should only appear once in entities
      expect(Object.keys(result.$entities)).toHaveLength(3);
      expect(result.$entities['Category:c1']).toEqual({
        internal: { type: 'Category', id: 'c1' },
        name: 'Electronics',
      });
    });

    it('handles arrays of primitives', () => {
      const data = {
        tags: ['red', 'blue', 'green'],
        counts: [1, 2, 3],
      };

      const result = normalizeResponse(data);

      expect(result.data).toEqual({
        tags: ['red', 'blue', 'green'],
        counts: [1, 2, 3],
      });
      expect(result.$entities).toEqual({});
    });

    it('handles arrays of entities', () => {
      const data = {
        products: [
          { internal: { type: 'Product', id: 'p1' }, name: 'A' },
          { internal: { type: 'Product', id: 'p2' }, name: 'B' },
        ],
      };

      const result = normalizeResponse(data);

      expect(result.data).toEqual({
        products: [{ $ref: 'Product:p1' }, { $ref: 'Product:p2' }],
      });
      expect(result.$entities['Product:p1']).toEqual({
        internal: { type: 'Product', id: 'p1' },
        name: 'A',
      });
      expect(result.$entities['Product:p2']).toEqual({
        internal: { type: 'Product', id: 'p2' },
        name: 'B',
      });
    });

    it('handles deeply nested structures', () => {
      const data = {
        level1: {
          level2: {
            level3: {
              entity: {
                internal: { type: 'Deep', id: 'd1' },
                value: 'nested',
              },
            },
          },
        },
      };

      const result = normalizeResponse(data);

      expect(result.data).toEqual({
        level1: {
          level2: {
            level3: {
              entity: { $ref: 'Deep:d1' },
            },
          },
        },
      });
      expect(result.$entities['Deep:d1']).toEqual({
        internal: { type: 'Deep', id: 'd1' },
        value: 'nested',
      });
    });

    it('uses custom getEntityKey function', () => {
      const customGetEntityKey = (obj: unknown): string | null => {
        if (typeof obj !== 'object' || obj === null) return null;
        const record = obj as Record<string, unknown>;
        if (record['customId']) {
          return `Custom:${record['customId']}`;
        }
        return null;
      };

      const data = {
        item: {
          customId: 'x1',
          name: 'Custom Item',
        },
      };

      const result = normalizeResponse(data, {
        getEntityKey: customGetEntityKey,
      });

      expect(result.data).toEqual({
        item: { $ref: 'Custom:x1' },
      });
      expect(result.$entities['Custom:x1']).toEqual({
        customId: 'x1',
        name: 'Custom Item',
      });
    });

    it('handles mixed arrays with entities and non-entities', () => {
      const data = {
        items: [
          { internal: { type: 'Entity', id: 'e1' }, name: 'Entity' },
          { notAnEntity: true, name: 'Regular' },
        ],
      };

      const result = normalizeResponse(data);

      expect(result.data).toEqual({
        items: [{ $ref: 'Entity:e1' }, { notAnEntity: true, name: 'Regular' }],
      });
      expect(result.$entities['Entity:e1']).toEqual({
        internal: { type: 'Entity', id: 'e1' },
        name: 'Entity',
      });
    });

    it('handles empty arrays', () => {
      const data = { items: [] };
      const result = normalizeResponse(data);

      expect(result.data).toEqual({ items: [] });
      expect(result.$entities).toEqual({});
    });

    it('handles empty objects', () => {
      const data = {};
      const result = normalizeResponse(data);

      expect(result.data).toEqual({});
      expect(result.$entities).toEqual({});
    });

    it('only stores entity once when seen multiple times', () => {
      // Test the "first time seeing this entity" vs "duplicate" branch
      const entity = {
        internal: { type: 'Shared', id: 's1' },
        name: 'Shared Entity',
      };

      const data = {
        first: entity,
        second: entity,
        third: entity,
      };

      const result = normalizeResponse(data);

      expect(result.data).toEqual({
        first: { $ref: 'Shared:s1' },
        second: { $ref: 'Shared:s1' },
        third: { $ref: 'Shared:s1' },
      });
      // Should only have one entity entry
      expect(Object.keys(result.$entities)).toEqual(['Shared:s1']);
    });
  });

  describe('normalizeGraphQLResult', () => {
    it('normalizes result with data', () => {
      const result = {
        data: {
          product: {
            internal: { type: 'Product', id: 'p1' },
            name: 'Test',
          },
        },
      };

      const normalized = normalizeGraphQLResult(result);

      expect(normalized.data).toEqual({
        product: { $ref: 'Product:p1' },
      });
      expect(normalized.$entities['Product:p1']).toEqual({
        internal: { type: 'Product', id: 'p1' },
        name: 'Test',
      });
      expect(normalized.errors).toBeUndefined();
    });

    it('handles result without data (null data)', () => {
      const result = {
        data: undefined,
      };

      const normalized = normalizeGraphQLResult(result);

      expect(normalized.data).toBeNull();
      expect(normalized.$entities).toEqual({});
    });

    it('includes errors when present', () => {
      const errors = [{ message: 'Error 1' }, { message: 'Error 2' }];

      const result = {
        data: { foo: 'bar' },
        errors,
      };

      const normalized = normalizeGraphQLResult(result);

      expect(normalized.errors).toBe(errors);
      expect(normalized.data).toEqual({ foo: 'bar' });
    });

    it('handles errors without data', () => {
      const errors = [{ message: 'Fatal error' }];

      const result = {
        data: undefined,
        errors,
      };

      const normalized = normalizeGraphQLResult(result);

      expect(normalized.data).toBeNull();
      expect(normalized.$entities).toEqual({});
      expect(normalized.errors).toBe(errors);
    });

    it('uses custom getEntityKey option', () => {
      const customGetEntityKey = (obj: unknown): string | null => {
        if (typeof obj !== 'object' || obj === null) return null;
        const record = obj as Record<string, unknown>;
        if (record['uid']) {
          return `Node:${record['uid']}`;
        }
        return null;
      };

      const result = {
        data: {
          node: { uid: 'n1', value: 'test' },
        },
      };

      const normalized = normalizeGraphQLResult(result, {
        getEntityKey: customGetEntityKey,
      });

      expect(normalized.data).toEqual({
        node: { $ref: 'Node:n1' },
      });
      expect(normalized.$entities['Node:n1']).toEqual({
        uid: 'n1',
        value: 'test',
      });
    });

    it('does not include errors property when not present', () => {
      const result = {
        data: { test: 'value' },
      };

      const normalized = normalizeGraphQLResult(result);

      expect('errors' in normalized).toBe(false);
    });
  });
});
