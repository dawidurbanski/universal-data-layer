/**
 * Tests for merge-fields utilities
 */

import { describe, it, expect } from 'vitest';
import {
  mergeFieldDefinitions,
  mergeFieldArrays,
} from '@/codegen/inference/utils/merge-fields.js';
import type { FieldDefinition } from '@/codegen/types/schema.js';

describe('mergeFieldDefinitions', () => {
  describe('basic field merging', () => {
    it('should merge two fields with the same type', () => {
      const a: FieldDefinition = {
        name: 'foo',
        type: 'string',
        required: true,
      };
      const b: FieldDefinition = {
        name: 'foo',
        type: 'string',
        required: true,
      };

      const result = mergeFieldDefinitions(a, b);

      expect(result).toEqual({
        name: 'foo',
        type: 'string',
        required: true,
      });
    });

    it('should set required to false if either field is not required', () => {
      const a: FieldDefinition = {
        name: 'foo',
        type: 'string',
        required: true,
      };
      const b: FieldDefinition = {
        name: 'foo',
        type: 'string',
        required: false,
      };

      const result = mergeFieldDefinitions(a, b);

      expect(result.required).toBe(false);
    });

    it('should set required to false when a is not required', () => {
      const a: FieldDefinition = {
        name: 'foo',
        type: 'string',
        required: false,
      };
      const b: FieldDefinition = {
        name: 'foo',
        type: 'string',
        required: true,
      };

      const result = mergeFieldDefinitions(a, b);

      expect(result.required).toBe(false);
    });
  });

  describe('description merging', () => {
    it('should use description from a if present', () => {
      const a: FieldDefinition = {
        name: 'foo',
        type: 'string',
        required: true,
        description: 'Description from a',
      };
      const b: FieldDefinition = {
        name: 'foo',
        type: 'string',
        required: true,
      };

      const result = mergeFieldDefinitions(a, b);

      expect(result.description).toBe('Description from a');
    });

    it('should use description from b if a has none', () => {
      const a: FieldDefinition = {
        name: 'foo',
        type: 'string',
        required: true,
      };
      const b: FieldDefinition = {
        name: 'foo',
        type: 'string',
        required: true,
        description: 'Description from b',
      };

      const result = mergeFieldDefinitions(a, b);

      expect(result.description).toBe('Description from b');
    });

    it('should not include description if neither has one', () => {
      const a: FieldDefinition = {
        name: 'foo',
        type: 'string',
        required: true,
      };
      const b: FieldDefinition = {
        name: 'foo',
        type: 'string',
        required: true,
      };

      const result = mergeFieldDefinitions(a, b);

      expect(result.description).toBeUndefined();
    });
  });

  describe('type conflict resolution', () => {
    it('should prefer non-null type when a is null', () => {
      const a: FieldDefinition = { name: 'foo', type: 'null', required: true };
      const b: FieldDefinition = {
        name: 'foo',
        type: 'string',
        required: true,
      };

      const result = mergeFieldDefinitions(a, b);

      expect(result.type).toBe('string');
    });

    it('should prefer non-unknown type when a is unknown', () => {
      const a: FieldDefinition = {
        name: 'foo',
        type: 'unknown',
        required: true,
      };
      const b: FieldDefinition = {
        name: 'foo',
        type: 'number',
        required: true,
      };

      const result = mergeFieldDefinitions(a, b);

      expect(result.type).toBe('number');
    });

    it('should prefer non-null type when b is null', () => {
      const a: FieldDefinition = {
        name: 'foo',
        type: 'string',
        required: true,
      };
      const b: FieldDefinition = { name: 'foo', type: 'null', required: true };

      const result = mergeFieldDefinitions(a, b);

      expect(result.type).toBe('string');
    });

    it('should prefer non-unknown type when b is unknown', () => {
      const a: FieldDefinition = {
        name: 'foo',
        type: 'number',
        required: true,
      };
      const b: FieldDefinition = {
        name: 'foo',
        type: 'unknown',
        required: true,
      };

      const result = mergeFieldDefinitions(a, b);

      expect(result.type).toBe('number');
    });

    it('should fall back to unknown when types genuinely differ', () => {
      const a: FieldDefinition = {
        name: 'foo',
        type: 'string',
        required: true,
      };
      const b: FieldDefinition = {
        name: 'foo',
        type: 'number',
        required: true,
      };

      const result = mergeFieldDefinitions(a, b);

      expect(result.type).toBe('unknown');
    });

    it('should clear referenceType when falling back to unknown', () => {
      const a: FieldDefinition = {
        name: 'foo',
        type: 'reference',
        required: true,
        referenceType: 'Post',
      };
      const b: FieldDefinition = {
        name: 'foo',
        type: 'string',
        required: true,
      };

      const result = mergeFieldDefinitions(a, b);

      expect(result.type).toBe('unknown');
      expect(result.referenceType).toBeUndefined();
    });
  });

  describe('referenceType handling', () => {
    it('should preserve referenceType from a', () => {
      const a: FieldDefinition = {
        name: 'author',
        type: 'reference',
        required: true,
        referenceType: 'User',
      };
      const b: FieldDefinition = {
        name: 'author',
        type: 'reference',
        required: true,
        referenceType: 'User',
      };

      const result = mergeFieldDefinitions(a, b);

      expect(result.referenceType).toBe('User');
    });

    it('should copy referenceType from b when a type is null', () => {
      const a: FieldDefinition = {
        name: 'author',
        type: 'null',
        required: true,
      };
      const b: FieldDefinition = {
        name: 'author',
        type: 'reference',
        required: true,
        referenceType: 'User',
      };

      const result = mergeFieldDefinitions(a, b);

      expect(result.type).toBe('reference');
      expect(result.referenceType).toBe('User');
    });

    it('should copy referenceType from b when a type is unknown', () => {
      const a: FieldDefinition = {
        name: 'author',
        type: 'unknown',
        required: true,
      };
      const b: FieldDefinition = {
        name: 'author',
        type: 'reference',
        required: true,
        referenceType: 'User',
      };

      const result = mergeFieldDefinitions(a, b);

      expect(result.type).toBe('reference');
      expect(result.referenceType).toBe('User');
    });

    it('should use b referenceType when both are reference but a has no referenceType', () => {
      const a: FieldDefinition = {
        name: 'author',
        type: 'reference',
        required: true,
      };
      const b: FieldDefinition = {
        name: 'author',
        type: 'reference',
        required: true,
        referenceType: 'User',
      };

      const result = mergeFieldDefinitions(a, b);

      expect(result.referenceType).toBe('User');
    });

    it('should keep a referenceType when both have referenceType', () => {
      const a: FieldDefinition = {
        name: 'author',
        type: 'reference',
        required: true,
        referenceType: 'Author',
      };
      const b: FieldDefinition = {
        name: 'author',
        type: 'reference',
        required: true,
        referenceType: 'User',
      };

      const result = mergeFieldDefinitions(a, b);

      expect(result.referenceType).toBe('Author');
    });

    it('should not copy referenceType from b when b has no referenceType', () => {
      const a: FieldDefinition = {
        name: 'author',
        type: 'reference',
        required: true,
        referenceType: 'User',
      };
      const b: FieldDefinition = {
        name: 'author',
        type: 'reference',
        required: true,
      };

      const result = mergeFieldDefinitions(a, b);

      expect(result.referenceType).toBe('User');
    });
  });

  describe('array item type merging', () => {
    it('should merge array item types when both have them', () => {
      const a: FieldDefinition = {
        name: 'tags',
        type: 'array',
        required: true,
        arrayItemType: { name: 'item', type: 'string', required: true },
      };
      const b: FieldDefinition = {
        name: 'tags',
        type: 'array',
        required: true,
        arrayItemType: { name: 'item', type: 'string', required: false },
      };

      const result = mergeFieldDefinitions(a, b);

      expect(result.arrayItemType).toEqual({
        name: 'item',
        type: 'string',
        required: false,
      });
    });

    it('should use a arrayItemType when only a has it', () => {
      const a: FieldDefinition = {
        name: 'tags',
        type: 'array',
        required: true,
        arrayItemType: { name: 'item', type: 'string', required: true },
      };
      const b: FieldDefinition = {
        name: 'tags',
        type: 'array',
        required: true,
      };

      const result = mergeFieldDefinitions(a, b);

      expect(result.arrayItemType).toEqual({
        name: 'item',
        type: 'string',
        required: true,
      });
    });

    it('should use b arrayItemType when only b has it', () => {
      const a: FieldDefinition = {
        name: 'tags',
        type: 'array',
        required: true,
      };
      const b: FieldDefinition = {
        name: 'tags',
        type: 'array',
        required: true,
        arrayItemType: { name: 'item', type: 'number', required: true },
      };

      const result = mergeFieldDefinitions(a, b);

      expect(result.arrayItemType).toEqual({
        name: 'item',
        type: 'number',
        required: true,
      });
    });

    it('should not set arrayItemType when neither has it', () => {
      const a: FieldDefinition = {
        name: 'tags',
        type: 'array',
        required: true,
      };
      const b: FieldDefinition = {
        name: 'tags',
        type: 'array',
        required: true,
      };

      const result = mergeFieldDefinitions(a, b);

      expect(result.arrayItemType).toBeUndefined();
    });
  });

  describe('object fields merging', () => {
    it('should merge object fields from both definitions', () => {
      const a: FieldDefinition = {
        name: 'metadata',
        type: 'object',
        required: true,
        objectFields: [{ name: 'created', type: 'string', required: true }],
      };
      const b: FieldDefinition = {
        name: 'metadata',
        type: 'object',
        required: true,
        objectFields: [{ name: 'created', type: 'string', required: true }],
      };

      const result = mergeFieldDefinitions(a, b);

      expect(result.objectFields).toHaveLength(1);
      expect(result.objectFields?.[0]).toEqual({
        name: 'created',
        type: 'string',
        required: true,
      });
    });

    it('should mark field as optional if only in b', () => {
      const a: FieldDefinition = {
        name: 'metadata',
        type: 'object',
        required: true,
        objectFields: [],
      };
      const b: FieldDefinition = {
        name: 'metadata',
        type: 'object',
        required: true,
        objectFields: [{ name: 'updated', type: 'string', required: true }],
      };

      const result = mergeFieldDefinitions(a, b);

      expect(result.objectFields).toHaveLength(1);
      expect(result.objectFields?.[0]).toEqual({
        name: 'updated',
        type: 'string',
        required: false,
      });
    });

    it('should mark field as optional if only in a', () => {
      const a: FieldDefinition = {
        name: 'metadata',
        type: 'object',
        required: true,
        objectFields: [{ name: 'created', type: 'string', required: true }],
      };
      const b: FieldDefinition = {
        name: 'metadata',
        type: 'object',
        required: true,
        objectFields: [],
      };

      const result = mergeFieldDefinitions(a, b);

      expect(result.objectFields).toHaveLength(1);
      expect(result.objectFields?.[0]).toEqual({
        name: 'created',
        type: 'string',
        required: false,
      });
    });

    it('should merge overlapping fields and mark unique fields as optional', () => {
      const a: FieldDefinition = {
        name: 'metadata',
        type: 'object',
        required: true,
        objectFields: [
          { name: 'shared', type: 'string', required: true },
          { name: 'onlyA', type: 'number', required: true },
        ],
      };
      const b: FieldDefinition = {
        name: 'metadata',
        type: 'object',
        required: true,
        objectFields: [
          { name: 'shared', type: 'string', required: true },
          { name: 'onlyB', type: 'boolean', required: true },
        ],
      };

      const result = mergeFieldDefinitions(a, b);

      expect(result.objectFields).toHaveLength(3);

      const shared = result.objectFields?.find((f) => f.name === 'shared');
      const onlyA = result.objectFields?.find((f) => f.name === 'onlyA');
      const onlyB = result.objectFields?.find((f) => f.name === 'onlyB');

      expect(shared?.required).toBe(true);
      expect(onlyA?.required).toBe(false);
      expect(onlyB?.required).toBe(false);
    });

    it('should handle undefined objectFields as empty array', () => {
      const a: FieldDefinition = {
        name: 'metadata',
        type: 'object',
        required: true,
      };
      const b: FieldDefinition = {
        name: 'metadata',
        type: 'object',
        required: true,
      };

      const result = mergeFieldDefinitions(a, b);

      expect(result.objectFields).toEqual([]);
    });

    it('should handle a with fields and b with undefined objectFields', () => {
      const a: FieldDefinition = {
        name: 'metadata',
        type: 'object',
        required: true,
        objectFields: [{ name: 'field1', type: 'string', required: true }],
      };
      const b: FieldDefinition = {
        name: 'metadata',
        type: 'object',
        required: true,
        // objectFields is undefined
      };

      const result = mergeFieldDefinitions(a, b);

      expect(result.objectFields).toHaveLength(1);
      expect(result.objectFields?.[0]?.name).toBe('field1');
      expect(result.objectFields?.[0]?.required).toBe(false);
    });

    it('should recursively merge nested object fields', () => {
      const a: FieldDefinition = {
        name: 'metadata',
        type: 'object',
        required: true,
        objectFields: [{ name: 'value', type: 'string', required: true }],
      };
      const b: FieldDefinition = {
        name: 'metadata',
        type: 'object',
        required: true,
        objectFields: [{ name: 'value', type: 'null', required: true }],
      };

      const result = mergeFieldDefinitions(a, b);

      expect(result.objectFields?.[0]?.type).toBe('string');
    });
  });

  describe('non-array and non-object types', () => {
    it('should not set arrayItemType for non-array types', () => {
      const a: FieldDefinition = {
        name: 'foo',
        type: 'string',
        required: true,
      };
      const b: FieldDefinition = {
        name: 'foo',
        type: 'string',
        required: true,
      };

      const result = mergeFieldDefinitions(a, b);

      expect(result.arrayItemType).toBeUndefined();
    });

    it('should not set objectFields for non-object types', () => {
      const a: FieldDefinition = {
        name: 'foo',
        type: 'string',
        required: true,
      };
      const b: FieldDefinition = {
        name: 'foo',
        type: 'string',
        required: true,
      };

      const result = mergeFieldDefinitions(a, b);

      expect(result.objectFields).toBeUndefined();
    });
  });
});

describe('mergeFieldArrays', () => {
  describe('basic merging', () => {
    it('should return existing fields when incoming is empty', () => {
      const existing: FieldDefinition[] = [
        { name: 'foo', type: 'string', required: true },
      ];
      const incoming: FieldDefinition[] = [];

      const result = mergeFieldArrays(existing, incoming);

      expect(result).toHaveLength(1);
      expect(result[0]?.name).toBe('foo');
      expect(result[0]?.required).toBe(false);
    });

    it('should return incoming fields when existing is empty', () => {
      const existing: FieldDefinition[] = [];
      const incoming: FieldDefinition[] = [
        { name: 'bar', type: 'number', required: true },
      ];

      const result = mergeFieldArrays(existing, incoming);

      expect(result).toHaveLength(1);
      expect(result[0]?.name).toBe('bar');
      expect(result[0]?.required).toBe(false);
    });

    it('should return empty array when both are empty', () => {
      const result = mergeFieldArrays([], []);

      expect(result).toEqual([]);
    });
  });

  describe('field presence', () => {
    it('should merge fields present in both arrays', () => {
      const existing: FieldDefinition[] = [
        { name: 'shared', type: 'string', required: true },
      ];
      const incoming: FieldDefinition[] = [
        { name: 'shared', type: 'string', required: true },
      ];

      const result = mergeFieldArrays(existing, incoming);

      expect(result).toHaveLength(1);
      expect(result[0]?.required).toBe(true);
    });

    it('should mark new fields from incoming as optional', () => {
      const existing: FieldDefinition[] = [
        { name: 'existing', type: 'string', required: true },
      ];
      const incoming: FieldDefinition[] = [
        { name: 'existing', type: 'string', required: true },
        { name: 'new', type: 'number', required: true },
      ];

      const result = mergeFieldArrays(existing, incoming);

      expect(result).toHaveLength(2);
      const newField = result.find((f) => f.name === 'new');
      expect(newField?.required).toBe(false);
    });

    it('should mark fields not in incoming as optional', () => {
      const existing: FieldDefinition[] = [
        { name: 'onlyExisting', type: 'string', required: true },
        { name: 'shared', type: 'string', required: true },
      ];
      const incoming: FieldDefinition[] = [
        { name: 'shared', type: 'string', required: true },
      ];

      const result = mergeFieldArrays(existing, incoming);

      expect(result).toHaveLength(2);
      const onlyExisting = result.find((f) => f.name === 'onlyExisting');
      expect(onlyExisting?.required).toBe(false);
    });
  });

  describe('type merging', () => {
    it('should use mergeFieldDefinitions for overlapping fields', () => {
      const existing: FieldDefinition[] = [
        { name: 'field', type: 'null', required: true },
      ];
      const incoming: FieldDefinition[] = [
        { name: 'field', type: 'string', required: true },
      ];

      const result = mergeFieldArrays(existing, incoming);

      expect(result[0]?.type).toBe('string');
    });
  });

  describe('complex scenarios', () => {
    it('should handle multiple fields with various presence combinations', () => {
      const existing: FieldDefinition[] = [
        { name: 'a', type: 'string', required: true },
        { name: 'b', type: 'number', required: true },
        { name: 'c', type: 'boolean', required: true },
      ];
      const incoming: FieldDefinition[] = [
        { name: 'b', type: 'number', required: true },
        { name: 'c', type: 'boolean', required: false },
        { name: 'd', type: 'string', required: true },
      ];

      const result = mergeFieldArrays(existing, incoming);

      expect(result).toHaveLength(4);

      const fieldA = result.find((f) => f.name === 'a');
      const fieldB = result.find((f) => f.name === 'b');
      const fieldC = result.find((f) => f.name === 'c');
      const fieldD = result.find((f) => f.name === 'd');

      expect(fieldA?.required).toBe(false);
      expect(fieldB?.required).toBe(true);
      expect(fieldC?.required).toBe(false);
      expect(fieldD?.required).toBe(false);
    });
  });
});
