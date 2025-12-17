import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import {
  zodToFieldDefinition,
  applySchemaOverrides,
} from '@/codegen/inference/from-zod.js';
import type { FieldDefinition } from '@/codegen/types/schema.js';

describe('zodToFieldDefinition', () => {
  describe('primitive types', () => {
    it('converts z.string() to string type', () => {
      const result = zodToFieldDefinition('name', z.string());
      expect(result).toEqual({
        name: 'name',
        type: 'string',
        required: true,
      });
    });

    it('converts z.number() to number type', () => {
      const result = zodToFieldDefinition('age', z.number());
      expect(result).toEqual({
        name: 'age',
        type: 'number',
        required: true,
      });
    });

    it('converts z.boolean() to boolean type', () => {
      const result = zodToFieldDefinition('active', z.boolean());
      expect(result).toEqual({
        name: 'active',
        type: 'boolean',
        required: true,
      });
    });

    it('converts z.null() to null type', () => {
      const result = zodToFieldDefinition('empty', z.null());
      expect(result).toEqual({
        name: 'empty',
        type: 'null',
        required: true,
      });
    });

    it('converts z.undefined() to null type', () => {
      const result = zodToFieldDefinition('undef', z.undefined());
      expect(result).toEqual({
        name: 'undef',
        type: 'null',
        required: true,
      });
    });
  });

  describe('literal types', () => {
    it('converts z.literal() with string value', () => {
      const result = zodToFieldDefinition('status', z.literal('active'));
      expect(result).toEqual({
        name: 'status',
        type: 'string',
        required: true,
        literalValues: ['active'],
      });
    });

    it('converts z.literal() with number value', () => {
      const result = zodToFieldDefinition('code', z.literal(42));
      expect(result).toEqual({
        name: 'code',
        type: 'number',
        required: true,
        literalValues: [42],
      });
    });

    it('converts z.literal() with boolean value', () => {
      const result = zodToFieldDefinition('flag', z.literal(true));
      expect(result).toEqual({
        name: 'flag',
        type: 'boolean',
        required: true,
        literalValues: [true],
      });
    });
  });

  describe('enum types', () => {
    it('converts z.enum() to string type with literalValues', () => {
      const result = zodToFieldDefinition(
        'status',
        z.enum(['pending', 'completed', 'cancelled'])
      );
      expect(result).toEqual({
        name: 'status',
        type: 'string',
        required: true,
        literalValues: ['pending', 'completed', 'cancelled'],
      });
    });
  });

  describe('union types', () => {
    it('converts union of string literals to string type with literalValues', () => {
      const result = zodToFieldDefinition(
        'state',
        z.union([z.literal('on'), z.literal('off')])
      );
      expect(result).toEqual({
        name: 'state',
        type: 'string',
        required: true,
        literalValues: ['on', 'off'],
      });
    });

    it('converts union of number literals to number type with literalValues', () => {
      const result = zodToFieldDefinition(
        'level',
        z.union([z.literal(1), z.literal(2), z.literal(3)])
      );
      expect(result).toEqual({
        name: 'level',
        type: 'number',
        required: true,
        literalValues: [1, 2, 3],
      });
    });

    it('converts union of boolean literals to boolean type with literalValues', () => {
      const result = zodToFieldDefinition(
        'toggle',
        z.union([z.literal(true), z.literal(false)])
      );
      expect(result).toEqual({
        name: 'toggle',
        type: 'boolean',
        required: true,
        literalValues: [true, false],
      });
    });

    it('converts union of mixed types and uses first option type', () => {
      const result = zodToFieldDefinition(
        'mixed',
        z.union([z.string(), z.number()])
      );
      // When union has no literal values, literalValues is not set
      expect(result).toEqual({
        name: 'mixed',
        type: 'string',
        required: true,
      });
    });

    it('handles empty union options gracefully', () => {
      // Create a mock schema with empty options
      const emptyUnion = {
        _def: {
          type: 'union',
          options: [],
        },
      } as unknown as z.ZodTypeAny;

      const result = zodToFieldDefinition('empty', emptyUnion);
      expect(result).toEqual({
        name: 'empty',
        type: 'unknown',
        required: true,
      });
    });
  });

  describe('optional and nullable types', () => {
    it('converts z.string().optional() to optional string', () => {
      const result = zodToFieldDefinition('nickname', z.string().optional());
      expect(result).toEqual({
        name: 'nickname',
        type: 'string',
        required: false,
      });
    });

    it('converts z.number().nullable() to optional number', () => {
      const result = zodToFieldDefinition('score', z.number().nullable());
      expect(result).toEqual({
        name: 'score',
        type: 'number',
        required: false,
      });
    });

    it('converts nested optional/nullable wrappers', () => {
      const result = zodToFieldDefinition(
        'value',
        z.string().optional().nullable()
      );
      expect(result).toEqual({
        name: 'value',
        type: 'string',
        required: false,
      });
    });

    it('converts optional enum to optional string with literalValues', () => {
      const result = zodToFieldDefinition(
        'status',
        z.enum(['a', 'b']).optional()
      );
      expect(result).toEqual({
        name: 'status',
        type: 'string',
        required: false,
        literalValues: ['a', 'b'],
      });
    });
  });

  describe('array types', () => {
    it('converts z.array(z.string()) to array with string item type', () => {
      const result = zodToFieldDefinition('tags', z.array(z.string()));
      expect(result).toEqual({
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

    it('converts z.array(z.number()) to array with number item type', () => {
      const result = zodToFieldDefinition('scores', z.array(z.number()));
      expect(result).toEqual({
        name: 'scores',
        type: 'array',
        required: true,
        arrayItemType: {
          name: 'item',
          type: 'number',
          required: true,
        },
      });
    });

    it('converts nested arrays', () => {
      const result = zodToFieldDefinition(
        'matrix',
        z.array(z.array(z.number()))
      );
      expect(result).toEqual({
        name: 'matrix',
        type: 'array',
        required: true,
        arrayItemType: {
          name: 'item',
          type: 'array',
          required: true,
          arrayItemType: {
            name: 'item',
            type: 'number',
            required: true,
          },
        },
      });
    });

    it('converts optional array', () => {
      const result = zodToFieldDefinition(
        'items',
        z.array(z.string()).optional()
      );
      expect(result).toEqual({
        name: 'items',
        type: 'array',
        required: false,
        arrayItemType: {
          name: 'item',
          type: 'string',
          required: true,
        },
      });
    });

    it('handles array without element type gracefully', () => {
      // Create a mock array schema without element using typeName to avoid
      // the "type" property being used as itemSchema fallback
      const arrayWithoutElement = {
        _def: {
          typeName: 'ZodArray',
          // No element or type property
        },
      } as unknown as z.ZodTypeAny;

      const result = zodToFieldDefinition('arr', arrayWithoutElement);
      expect(result).toEqual({
        name: 'arr',
        type: 'array',
        required: true,
      });
    });
  });

  describe('object types', () => {
    it('converts z.object() to object with fields', () => {
      const result = zodToFieldDefinition(
        'user',
        z.object({
          name: z.string(),
          age: z.number(),
        })
      );
      expect(result).toEqual({
        name: 'user',
        type: 'object',
        required: true,
        objectFields: [
          { name: 'name', type: 'string', required: true },
          { name: 'age', type: 'number', required: true },
        ],
      });
    });

    it('converts nested objects', () => {
      const result = zodToFieldDefinition(
        'profile',
        z.object({
          user: z.object({
            name: z.string(),
          }),
        })
      );
      expect(result).toEqual({
        name: 'profile',
        type: 'object',
        required: true,
        objectFields: [
          {
            name: 'user',
            type: 'object',
            required: true,
            objectFields: [{ name: 'name', type: 'string', required: true }],
          },
        ],
      });
    });

    it('converts object with optional fields', () => {
      const result = zodToFieldDefinition(
        'config',
        z.object({
          required: z.string(),
          optional: z.string().optional(),
        })
      );
      expect(result).toEqual({
        name: 'config',
        type: 'object',
        required: true,
        objectFields: [
          { name: 'required', type: 'string', required: true },
          { name: 'optional', type: 'string', required: false },
        ],
      });
    });

    it('converts optional object', () => {
      const result = zodToFieldDefinition(
        'data',
        z.object({ value: z.string() }).optional()
      );
      expect(result).toEqual({
        name: 'data',
        type: 'object',
        required: false,
        objectFields: [{ name: 'value', type: 'string', required: true }],
      });
    });

    it('handles object without shape gracefully', () => {
      // Create a mock object schema without shape
      const objectWithoutShape = {
        _def: {
          type: 'object',
        },
      } as unknown as z.ZodTypeAny;

      const result = zodToFieldDefinition('obj', objectWithoutShape);
      expect(result).toEqual({
        name: 'obj',
        type: 'object',
        required: true,
      });
    });
  });

  describe('unknown types', () => {
    it('returns unknown type for unsupported schema', () => {
      // Create a mock schema with unknown type
      const unknownSchema = {
        _def: {
          type: 'unsupported',
        },
      } as unknown as z.ZodTypeAny;

      const result = zodToFieldDefinition('unknown', unknownSchema);
      expect(result).toEqual({
        name: 'unknown',
        type: 'unknown',
        required: true,
      });
    });

    it('handles schema with no _def', () => {
      const noDefSchema = {} as unknown as z.ZodTypeAny;

      const result = zodToFieldDefinition('noDef', noDefSchema);
      expect(result).toEqual({
        name: 'noDef',
        type: 'unknown',
        required: true,
      });
    });

    it('handles literal with non-primitive value', () => {
      // Create a mock literal with unsupported value type
      const literalWithObject = {
        _def: {
          type: 'literal',
          value: { foo: 'bar' }, // v3 style
        },
      } as unknown as z.ZodTypeAny;

      const result = zodToFieldDefinition('objLiteral', literalWithObject);
      expect(result).toEqual({
        name: 'objLiteral',
        type: 'unknown',
        required: true,
      });
    });
  });

  describe('Zod v3 compatibility (typeName format)', () => {
    it('handles Zod v3 string type (ZodString)', () => {
      const v3Schema = {
        _def: {
          typeName: 'ZodString',
        },
      } as unknown as z.ZodTypeAny;

      const result = zodToFieldDefinition('v3str', v3Schema);
      expect(result).toEqual({
        name: 'v3str',
        type: 'string',
        required: true,
      });
    });

    it('handles Zod v3 number type (ZodNumber)', () => {
      const v3Schema = {
        _def: {
          typeName: 'ZodNumber',
        },
      } as unknown as z.ZodTypeAny;

      const result = zodToFieldDefinition('v3num', v3Schema);
      expect(result).toEqual({
        name: 'v3num',
        type: 'number',
        required: true,
      });
    });

    it('handles Zod v3 enum with values array', () => {
      const v3Enum = {
        _def: {
          typeName: 'ZodEnum',
          values: ['a', 'b', 'c'],
        },
      } as unknown as z.ZodTypeAny;

      const result = zodToFieldDefinition('v3enum', v3Enum);
      expect(result).toEqual({
        name: 'v3enum',
        type: 'string',
        required: true,
        literalValues: ['a', 'b', 'c'],
      });
    });

    it('handles Zod v3 literal with value property', () => {
      const v3Literal = {
        _def: {
          typeName: 'ZodLiteral',
          value: 'test',
        },
      } as unknown as z.ZodTypeAny;

      const result = zodToFieldDefinition('v3lit', v3Literal);
      expect(result).toEqual({
        name: 'v3lit',
        type: 'string',
        required: true,
        literalValues: ['test'],
      });
    });

    it('handles Zod v3 optional with innerType', () => {
      const innerString = {
        _def: {
          typeName: 'ZodString',
        },
      } as unknown as z.ZodTypeAny;

      const v3Optional = {
        _def: {
          typeName: 'ZodOptional',
          innerType: innerString,
        },
      } as unknown as z.ZodTypeAny;

      const result = zodToFieldDefinition('v3opt', v3Optional);
      expect(result).toEqual({
        name: 'v3opt',
        type: 'string',
        required: false,
      });
    });

    it('handles Zod v3 object with shape function', () => {
      const stringSchema = {
        _def: {
          typeName: 'ZodString',
        },
      } as unknown as z.ZodTypeAny;

      const v3Object = {
        _def: {
          typeName: 'ZodObject',
          shape: () => ({
            name: stringSchema,
          }),
        },
      } as unknown as z.ZodTypeAny;

      const result = zodToFieldDefinition('v3obj', v3Object);
      expect(result).toEqual({
        name: 'v3obj',
        type: 'object',
        required: true,
        objectFields: [{ name: 'name', type: 'string', required: true }],
      });
    });

    it('handles Zod v3 union with literal options', () => {
      const litA = {
        _def: {
          typeName: 'ZodLiteral',
          value: 'a',
        },
      } as unknown as z.ZodTypeAny;

      const litB = {
        _def: {
          typeName: 'ZodLiteral',
          value: 'b',
        },
      } as unknown as z.ZodTypeAny;

      const v3Union = {
        _def: {
          typeName: 'ZodUnion',
          options: [litA, litB],
        },
      } as unknown as z.ZodTypeAny;

      const result = zodToFieldDefinition('v3union', v3Union);
      expect(result).toEqual({
        name: 'v3union',
        type: 'string',
        required: true,
        literalValues: ['a', 'b'],
      });
    });
  });

  describe('Zod v4 compatibility (entries format for enum)', () => {
    it('handles Zod v4 enum with entries object', () => {
      const v4Enum = {
        _def: {
          type: 'enum',
          entries: {
            active: 'active',
            inactive: 'inactive',
          },
        },
      } as unknown as z.ZodTypeAny;

      const result = zodToFieldDefinition('v4enum', v4Enum);
      expect(result).toEqual({
        name: 'v4enum',
        type: 'string',
        required: true,
        literalValues: ['active', 'inactive'],
      });
    });

    it('handles Zod v4 literal with values array', () => {
      const v4Literal = {
        _def: {
          type: 'literal',
          values: ['test'],
        },
      } as unknown as z.ZodTypeAny;

      const result = zodToFieldDefinition('v4lit', v4Literal);
      expect(result).toEqual({
        name: 'v4lit',
        type: 'string',
        required: true,
        literalValues: ['test'],
      });
    });
  });

  describe('edge cases', () => {
    it('handles schema with _def but no type or typeName properties', () => {
      // This tests line 58-59 - when neither def.type nor def.typeName is a string
      const schemaWithEmptyDef = {
        _def: {
          // neither type nor typeName
          someOtherProp: 123,
        },
      } as unknown as z.ZodTypeAny;

      const result = zodToFieldDefinition('emptyDef', schemaWithEmptyDef);
      expect(result).toEqual({
        name: 'emptyDef',
        type: 'unknown',
        required: true,
      });
    });

    it('handles union where first option is optional type (hits getBaseType optional branch)', () => {
      // This tests lines 182-183 - getBaseType is called recursively on union options
      // When first option is optional, we need to hit the optional/nullable branch in getBaseType
      const innerString = {
        _def: {
          type: 'string',
        },
      } as unknown as z.ZodTypeAny;

      const optionalString = {
        _def: {
          type: 'optional',
          innerType: innerString,
        },
      } as unknown as z.ZodTypeAny;

      const unionWithOptional = {
        _def: {
          type: 'union',
          options: [optionalString],
        },
      } as unknown as z.ZodTypeAny;

      const result = zodToFieldDefinition('unionOpt', unionWithOptional);
      // getBaseType calls itself recursively on firstOption which is optional
      // This hits lines 182-183 where it returns getBaseType(def.innerType)
      expect(result).toEqual({
        name: 'unionOpt',
        type: 'string',
        required: true,
      });
    });

    it('handles optional/nullable without innerType', () => {
      const optionalWithoutInner = {
        _def: {
          type: 'optional',
        },
      } as unknown as z.ZodTypeAny;

      const result = zodToFieldDefinition('noInner', optionalWithoutInner);
      expect(result).toEqual({
        name: 'noInner',
        type: 'unknown',
        required: false,
      });
    });

    it('handles union with non-literal options that do not produce literal values', () => {
      const strSchema = {
        _def: {
          type: 'string',
        },
      } as unknown as z.ZodTypeAny;

      const numSchema = {
        _def: {
          type: 'number',
        },
      } as unknown as z.ZodTypeAny;

      const mixedUnion = {
        _def: {
          type: 'union',
          options: [strSchema, numSchema],
        },
      } as unknown as z.ZodTypeAny;

      const result = zodToFieldDefinition('mixedUnion', mixedUnion);
      // No literalValues since options are not literals
      expect(result).toEqual({
        name: 'mixedUnion',
        type: 'string',
        required: true,
      });
    });

    it('handles literal with non-primitive in union (should be skipped)', () => {
      const litObj = {
        _def: {
          type: 'literal',
          value: { obj: true },
        },
      } as unknown as z.ZodTypeAny;

      const litStr = {
        _def: {
          type: 'literal',
          value: 'valid',
        },
      } as unknown as z.ZodTypeAny;

      const unionWithObjLit = {
        _def: {
          type: 'union',
          options: [litObj, litStr],
        },
      } as unknown as z.ZodTypeAny;

      const result = zodToFieldDefinition('unionObjLit', unionWithObjLit);
      // Only 'valid' should be in literalValues, obj literal is skipped
      expect(result).toEqual({
        name: 'unionObjLit',
        type: 'unknown',
        required: true,
        literalValues: ['valid'],
      });
    });

    it('handles literal with empty values array', () => {
      const emptyLiteral = {
        _def: {
          type: 'literal',
          values: [],
        },
      } as unknown as z.ZodTypeAny;

      const result = zodToFieldDefinition('emptyLit', emptyLiteral);
      // Falls through to check def.value which is undefined
      expect(result).toEqual({
        name: 'emptyLit',
        type: 'unknown',
        required: true,
      });
    });
  });
});

describe('applySchemaOverrides', () => {
  const baseFields: FieldDefinition[] = [
    { name: 'status', type: 'string', required: true },
    { name: 'count', type: 'number', required: true },
    { name: 'title', type: 'string', required: true },
    { name: 'description', type: 'string', required: false },
  ];

  it('returns fields unchanged when no overrides provided', () => {
    const result = applySchemaOverrides(baseFields, {});
    expect(result).toEqual(baseFields);
  });

  it('applies enum override to string field', () => {
    const result = applySchemaOverrides(baseFields, {
      status: z.enum(['pending', 'completed', 'cancelled']),
    });

    expect(result[0]).toEqual({
      name: 'status',
      type: 'string',
      required: true,
      literalValues: ['pending', 'completed', 'cancelled'],
    });
  });

  it('preserves non-overridden fields', () => {
    const result = applySchemaOverrides(baseFields, {
      status: z.enum(['a', 'b']),
    });

    expect(result[1]).toEqual({
      name: 'count',
      type: 'number',
      required: true,
    });
    expect(result[2]).toEqual({
      name: 'title',
      type: 'string',
      required: true,
    });
    expect(result[3]).toEqual({
      name: 'description',
      type: 'string',
      required: false,
    });
  });

  it('applies optional override to make field optional', () => {
    const result = applySchemaOverrides(baseFields, {
      title: z.string().optional(),
    });

    expect(result[2]).toEqual({
      name: 'title',
      type: 'string',
      required: false,
    });
  });

  it('preserves original required status when override is required', () => {
    const result = applySchemaOverrides(baseFields, {
      description: z.string(),
    });

    // Original is required: false, override is required: true
    // Result keeps original required: false
    expect(result[3]).toEqual({
      name: 'description',
      type: 'string',
      required: false,
    });
  });

  it('applies array override', () => {
    const result = applySchemaOverrides(baseFields, {
      title: z.array(z.string()),
    });

    expect(result[2]).toEqual({
      name: 'title',
      type: 'array',
      required: true,
      arrayItemType: {
        name: 'item',
        type: 'string',
        required: true,
      },
    });
  });

  it('applies object override', () => {
    const result = applySchemaOverrides(baseFields, {
      title: z.object({
        en: z.string(),
        es: z.string().optional(),
      }),
    });

    expect(result[2]).toEqual({
      name: 'title',
      type: 'object',
      required: true,
      objectFields: [
        { name: 'en', type: 'string', required: true },
        { name: 'es', type: 'string', required: false },
      ],
    });
  });

  it('applies multiple overrides at once', () => {
    const result = applySchemaOverrides(baseFields, {
      status: z.enum(['active', 'inactive']),
      count: z.literal(42),
    });

    expect(result[0]).toEqual({
      name: 'status',
      type: 'string',
      required: true,
      literalValues: ['active', 'inactive'],
    });

    expect(result[1]).toEqual({
      name: 'count',
      type: 'number',
      required: true,
      literalValues: [42],
    });
  });

  it('ignores overrides for non-existent fields', () => {
    const result = applySchemaOverrides(baseFields, {
      nonExistent: z.string(),
    });

    expect(result).toEqual(baseFields);
  });

  it('handles empty fields array', () => {
    const result = applySchemaOverrides([], {
      status: z.enum(['a', 'b']),
    });

    expect(result).toEqual([]);
  });
});
