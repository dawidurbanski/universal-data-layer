import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { InferSchema, s } from '@/schema-builder.js';

describe('schema-builder', () => {
  describe('InferSchema', () => {
    describe('override', () => {
      it('should add overrides to the schema', () => {
        const schema = new InferSchema();
        const statusSchema = z.enum(['pending', 'completed']);

        schema.override({ status: statusSchema });

        const overrides = schema.getOverrides();
        expect(overrides['status']).toBe(statusSchema);
      });

      it('should merge multiple overrides', () => {
        const schema = new InferSchema();
        const statusSchema = z.enum(['pending', 'completed']);
        const prioritySchema = z.number();

        schema.override({ status: statusSchema });
        schema.override({ priority: prioritySchema });

        const overrides = schema.getOverrides();
        expect(overrides['status']).toBe(statusSchema);
        expect(overrides['priority']).toBe(prioritySchema);
      });

      it('should allow overriding existing override', () => {
        const schema = new InferSchema();
        const statusSchema1 = z.enum(['pending', 'completed']);
        const statusSchema2 = z.enum(['active', 'inactive']);

        schema.override({ status: statusSchema1 });
        schema.override({ status: statusSchema2 });

        const overrides = schema.getOverrides();
        expect(overrides['status']).toBe(statusSchema2);
      });

      it('should return this for chaining', () => {
        const schema = new InferSchema();
        const result = schema.override({ status: z.string() });

        expect(result).toBe(schema);
      });

      it('should support chained override calls', () => {
        const schema = new InferSchema();
        const statusSchema = z.string();
        const prioritySchema = z.number();

        schema
          .override({ status: statusSchema })
          .override({ priority: prioritySchema });

        const overrides = schema.getOverrides();
        expect(overrides['status']).toBe(statusSchema);
        expect(overrides['priority']).toBe(prioritySchema);
      });
    });

    describe('getOverrides', () => {
      it('should return empty object when no overrides set', () => {
        const schema = new InferSchema();

        const overrides = schema.getOverrides();

        expect(overrides).toEqual({});
      });

      it('should return all overrides', () => {
        const schema = new InferSchema();
        const statusSchema = z.string();
        const prioritySchema = z.number();

        schema.override({ status: statusSchema, priority: prioritySchema });

        const overrides = schema.getOverrides();
        expect(Object.keys(overrides)).toHaveLength(2);
        expect(overrides['status']).toBe(statusSchema);
        expect(overrides['priority']).toBe(prioritySchema);
      });
    });

    describe('hasOverrides', () => {
      it('should return false when no overrides set', () => {
        const schema = new InferSchema();

        expect(schema.hasOverrides()).toBe(false);
      });

      it('should return true when overrides are set', () => {
        const schema = new InferSchema();

        schema.override({ status: z.string() });

        expect(schema.hasOverrides()).toBe(true);
      });

      it('should return true with multiple overrides', () => {
        const schema = new InferSchema();

        schema.override({ status: z.string(), priority: z.number() });

        expect(schema.hasOverrides()).toBe(true);
      });
    });
  });

  describe('s (schema builder)', () => {
    describe('primitive types', () => {
      it('should create string schema', () => {
        const schema = s.string();

        expect(schema.parse('hello')).toBe('hello');
        expect(() => schema.parse(123)).toThrow();
      });

      it('should create number schema', () => {
        const schema = s.number();

        expect(schema.parse(42)).toBe(42);
        expect(schema.parse(3.14)).toBe(3.14);
        expect(() => schema.parse('42')).toThrow();
      });

      it('should create boolean schema', () => {
        const schema = s.boolean();

        expect(schema.parse(true)).toBe(true);
        expect(schema.parse(false)).toBe(false);
        expect(() => schema.parse('true')).toThrow();
      });

      it('should create null schema', () => {
        const schema = s.null();

        expect(schema.parse(null)).toBe(null);
        expect(() => schema.parse(undefined)).toThrow();
        expect(() => schema.parse('')).toThrow();
      });

      it('should create undefined schema', () => {
        const schema = s.undefined();

        expect(schema.parse(undefined)).toBe(undefined);
        expect(() => schema.parse(null)).toThrow();
      });
    });

    describe('literal', () => {
      it('should create string literal schema', () => {
        const schema = s.literal('active');

        expect(schema.parse('active')).toBe('active');
        expect(() => schema.parse('inactive')).toThrow();
      });

      it('should create number literal schema', () => {
        const schema = s.literal(42);

        expect(schema.parse(42)).toBe(42);
        expect(() => schema.parse(43)).toThrow();
      });

      it('should create boolean literal schema', () => {
        const schema = s.literal(true);

        expect(schema.parse(true)).toBe(true);
        expect(() => schema.parse(false)).toThrow();
      });
    });

    describe('enum', () => {
      it('should create enum schema with string values', () => {
        const schema = s.enum(['pending', 'completed', 'cancelled']);

        expect(schema.parse('pending')).toBe('pending');
        expect(schema.parse('completed')).toBe('completed');
        expect(schema.parse('cancelled')).toBe('cancelled');
        expect(() => schema.parse('unknown')).toThrow();
      });

      it('should create enum schema with two values', () => {
        const schema = s.enum(['yes', 'no']);

        expect(schema.parse('yes')).toBe('yes');
        expect(schema.parse('no')).toBe('no');
        expect(() => schema.parse('maybe')).toThrow();
      });
    });

    describe('array', () => {
      it('should create array of strings schema', () => {
        const schema = s.array(s.string());

        expect(schema.parse(['a', 'b', 'c'])).toEqual(['a', 'b', 'c']);
        expect(schema.parse([])).toEqual([]);
        expect(() => schema.parse([1, 2, 3])).toThrow();
      });

      it('should create array of numbers schema', () => {
        const schema = s.array(s.number());

        expect(schema.parse([1, 2, 3])).toEqual([1, 2, 3]);
        expect(() => schema.parse(['a', 'b'])).toThrow();
      });

      it('should create nested array schema', () => {
        const schema = s.array(s.array(s.number()));

        expect(
          schema.parse([
            [1, 2],
            [3, 4],
          ])
        ).toEqual([
          [1, 2],
          [3, 4],
        ]);
      });
    });

    describe('object', () => {
      it('should create object schema', () => {
        const schema = s.object({
          name: s.string(),
          age: s.number(),
        });

        expect(schema.parse({ name: 'John', age: 30 })).toEqual({
          name: 'John',
          age: 30,
        });
      });

      it('should fail on missing properties', () => {
        const schema = s.object({
          name: s.string(),
          age: s.number(),
        });

        expect(() => schema.parse({ name: 'John' })).toThrow();
      });

      it('should create nested object schema', () => {
        const schema = s.object({
          user: s.object({
            name: s.string(),
          }),
        });

        expect(schema.parse({ user: { name: 'John' } })).toEqual({
          user: { name: 'John' },
        });
      });
    });

    describe('union', () => {
      it('should create union of string literals', () => {
        const schema = s.union([s.literal('a'), s.literal('b')]);

        expect(schema.parse('a')).toBe('a');
        expect(schema.parse('b')).toBe('b');
        expect(() => schema.parse('c')).toThrow();
      });

      it('should create union of different types', () => {
        const schema = s.union([s.string(), s.number()]);

        expect(schema.parse('hello')).toBe('hello');
        expect(schema.parse(42)).toBe(42);
        expect(() => schema.parse(true)).toThrow();
      });

      it('should create union with more than two types', () => {
        const schema = s.union([s.string(), s.number(), s.boolean()]);

        expect(schema.parse('hello')).toBe('hello');
        expect(schema.parse(42)).toBe(42);
        expect(schema.parse(true)).toBe(true);
        expect(() => schema.parse(null)).toThrow();
      });
    });

    describe('optional', () => {
      it('should make type optional', () => {
        const schema = s.optional(s.string());

        expect(schema.parse('hello')).toBe('hello');
        expect(schema.parse(undefined)).toBe(undefined);
      });

      it('should work with complex types', () => {
        const schema = s.optional(s.object({ name: s.string() }));

        expect(schema.parse({ name: 'John' })).toEqual({ name: 'John' });
        expect(schema.parse(undefined)).toBe(undefined);
      });
    });

    describe('nullable', () => {
      it('should make type nullable', () => {
        const schema = s.nullable(s.string());

        expect(schema.parse('hello')).toBe('hello');
        expect(schema.parse(null)).toBe(null);
        expect(() => schema.parse(undefined)).toThrow();
      });

      it('should work with complex types', () => {
        const schema = s.nullable(s.object({ name: s.string() }));

        expect(schema.parse({ name: 'John' })).toEqual({ name: 'John' });
        expect(schema.parse(null)).toBe(null);
      });
    });

    describe('infer', () => {
      it('should create InferSchema instance', () => {
        const schema = s.infer();

        expect(schema).toBeInstanceOf(InferSchema);
      });

      it('should create fresh InferSchema each time', () => {
        const schema1 = s.infer();
        const schema2 = s.infer();

        expect(schema1).not.toBe(schema2);
      });

      it('should support override chaining', () => {
        const schema = s.infer().override({
          status: s.enum(['pending', 'completed']),
        });

        expect(schema).toBeInstanceOf(InferSchema);
        expect(schema.hasOverrides()).toBe(true);

        const overrides = schema.getOverrides();
        expect(overrides['status']).toBeDefined();
      });

      it('should work with the full UDL pattern', () => {
        const schema = s.infer().override({
          status: s.enum(['pending', 'completed']),
          priority: s.union([s.literal(1), s.literal(2), s.literal(3)]),
          tags: s.array(s.string()),
        });

        const overrides = schema.getOverrides();
        const statusSchema = overrides['status']!;
        const prioritySchema = overrides['priority']!;
        const tagsSchema = overrides['tags']!;

        // Verify status enum
        expect(statusSchema.parse('pending')).toBe('pending');
        expect(statusSchema.parse('completed')).toBe('completed');
        expect(() => statusSchema.parse('unknown')).toThrow();

        // Verify priority union
        expect(prioritySchema.parse(1)).toBe(1);
        expect(prioritySchema.parse(2)).toBe(2);
        expect(prioritySchema.parse(3)).toBe(3);
        expect(() => prioritySchema.parse(4)).toThrow();

        // Verify tags array
        expect(tagsSchema.parse(['a', 'b'])).toEqual(['a', 'b']);
        expect(() => tagsSchema.parse([1, 2])).toThrow();
      });
    });
  });
});
