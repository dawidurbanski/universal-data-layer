import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import {
  zodToFieldDefinition,
  applySchemaOverrides,
} from '../../src/inference/from-zod.js';
import type { FieldDefinition } from '../../src/types/schema.js';

describe('zodToFieldDefinition', () => {
  describe('primitive types', () => {
    it('should convert z.string() to string field', () => {
      const field = zodToFieldDefinition('name', z.string());
      expect(field).toEqual({
        name: 'name',
        type: 'string',
        required: true,
      });
    });

    it('should convert z.number() to number field', () => {
      const field = zodToFieldDefinition('count', z.number());
      expect(field).toEqual({
        name: 'count',
        type: 'number',
        required: true,
      });
    });

    it('should convert z.boolean() to boolean field', () => {
      const field = zodToFieldDefinition('active', z.boolean());
      expect(field).toEqual({
        name: 'active',
        type: 'boolean',
        required: true,
      });
    });

    it('should convert z.null() to null field', () => {
      const field = zodToFieldDefinition('empty', z.null());
      expect(field).toEqual({
        name: 'empty',
        type: 'null',
        required: true,
      });
    });
  });

  describe('literal types', () => {
    it('should convert z.literal(string) to string field with literalValues', () => {
      const field = zodToFieldDefinition('status', z.literal('active'));
      expect(field).toEqual({
        name: 'status',
        type: 'string',
        required: true,
        literalValues: ['active'],
      });
    });

    it('should convert z.literal(number) to number field with literalValues', () => {
      const field = zodToFieldDefinition('priority', z.literal(1));
      expect(field).toEqual({
        name: 'priority',
        type: 'number',
        required: true,
        literalValues: [1],
      });
    });

    it('should convert z.literal(boolean) to boolean field with literalValues', () => {
      const field = zodToFieldDefinition('flag', z.literal(true));
      expect(field).toEqual({
        name: 'flag',
        type: 'boolean',
        required: true,
        literalValues: [true],
      });
    });
  });

  describe('enum types', () => {
    it('should convert z.enum() to string field with literalValues', () => {
      const field = zodToFieldDefinition(
        'status',
        z.enum(['pending', 'in_progress', 'completed'])
      );
      expect(field).toEqual({
        name: 'status',
        type: 'string',
        required: true,
        literalValues: ['pending', 'in_progress', 'completed'],
      });
    });
  });

  describe('union types', () => {
    it('should convert union of string literals to field with literalValues', () => {
      const field = zodToFieldDefinition(
        'status',
        z.union([z.literal('a'), z.literal('b'), z.literal('c')])
      );
      expect(field).toEqual({
        name: 'status',
        type: 'string',
        required: true,
        literalValues: ['a', 'b', 'c'],
      });
    });

    it('should convert union of number literals to field with literalValues', () => {
      const field = zodToFieldDefinition(
        'level',
        z.union([z.literal(1), z.literal(2), z.literal(3)])
      );
      expect(field).toEqual({
        name: 'level',
        type: 'number',
        required: true,
        literalValues: [1, 2, 3],
      });
    });
  });

  describe('optional types', () => {
    it('should mark z.string().optional() as not required', () => {
      const field = zodToFieldDefinition('nickname', z.string().optional());
      expect(field).toEqual({
        name: 'nickname',
        type: 'string',
        required: false,
      });
    });

    it('should mark z.enum().nullable() as not required', () => {
      const field = zodToFieldDefinition(
        'status',
        z.enum(['a', 'b']).nullable()
      );
      expect(field).toEqual({
        name: 'status',
        type: 'string',
        required: false,
        literalValues: ['a', 'b'],
      });
    });
  });

  describe('array types', () => {
    it('should convert z.array(z.string()) to array field', () => {
      const field = zodToFieldDefinition('tags', z.array(z.string()));
      expect(field).toEqual({
        name: 'tags',
        type: 'array',
        required: true,
        arrayItemType: {
          name: 'item',
          type: 'string',
          required: true,
        },
      });
    });

    it('should handle array of enums', () => {
      const field = zodToFieldDefinition(
        'statuses',
        z.array(z.enum(['a', 'b']))
      );
      expect(field.type).toBe('array');
      expect(field.arrayItemType).toEqual({
        name: 'item',
        type: 'string',
        required: true,
        literalValues: ['a', 'b'],
      });
    });
  });

  describe('object types', () => {
    it('should convert z.object() to object field', () => {
      const field = zodToFieldDefinition(
        'address',
        z.object({
          street: z.string(),
          city: z.string(),
        })
      );
      expect(field).toEqual({
        name: 'address',
        type: 'object',
        required: true,
        objectFields: [
          { name: 'street', type: 'string', required: true },
          { name: 'city', type: 'string', required: true },
        ],
      });
    });

    it('should handle nested optional fields', () => {
      const field = zodToFieldDefinition(
        'config',
        z.object({
          name: z.string(),
          debug: z.boolean().optional(),
        })
      );
      expect(field.objectFields).toEqual([
        { name: 'name', type: 'string', required: true },
        { name: 'debug', type: 'boolean', required: false },
      ]);
    });
  });
});

describe('applySchemaOverrides', () => {
  it('should return fields unchanged when no overrides match', () => {
    const fields: FieldDefinition[] = [
      { name: 'id', type: 'number', required: true },
      { name: 'name', type: 'string', required: true },
    ];

    const result = applySchemaOverrides(fields, {});
    expect(result).toEqual(fields);
  });

  it('should apply enum override to string field', () => {
    const fields: FieldDefinition[] = [
      { name: 'status', type: 'string', required: true },
      { name: 'name', type: 'string', required: true },
    ];

    const overrides = {
      status: z.enum(['pending', 'completed']),
    };

    const result = applySchemaOverrides(fields, overrides);

    expect(result[0]).toEqual({
      name: 'status',
      type: 'string',
      required: true,
      literalValues: ['pending', 'completed'],
    });
    // Other fields unchanged
    expect(result[1]).toEqual({ name: 'name', type: 'string', required: true });
  });

  it('should apply multiple overrides', () => {
    const fields: FieldDefinition[] = [
      { name: 'status', type: 'string', required: true },
      { name: 'priority', type: 'number', required: true },
    ];

    const overrides = {
      status: z.enum(['pending', 'completed']),
      priority: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    };

    const result = applySchemaOverrides(fields, overrides);

    expect(result[0]?.literalValues).toEqual(['pending', 'completed']);
    expect(result[1]?.literalValues).toEqual([1, 2, 3]);
  });

  it('should preserve field description from original', () => {
    const fields: FieldDefinition[] = [
      {
        name: 'status',
        type: 'string',
        required: true,
        description: 'The current status',
      },
    ];

    const overrides = {
      status: z.enum(['a', 'b']),
    };

    const result = applySchemaOverrides(fields, overrides);
    expect(result[0]?.description).toBe('The current status');
  });

  it('should make field optional if override is optional', () => {
    const fields: FieldDefinition[] = [
      { name: 'status', type: 'string', required: true },
    ];

    const overrides = {
      status: z.enum(['a', 'b']).optional(),
    };

    const result = applySchemaOverrides(fields, overrides);
    expect(result[0]?.required).toBe(false);
  });
});
