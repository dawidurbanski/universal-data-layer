/**
 * Schema Builder for UDL
 *
 * A wrapper around Zod that provides the `s` builder for defining schema hints
 * at createNode/extendNode call sites.
 *
 * @example
 * ```ts
 * import { s } from 'universal-data-layer';
 *
 * await actions.createNode(data, {
 *   schema: s.infer().override({
 *     status: s.enum(['pending', 'completed']),
 *   }),
 * });
 * ```
 */

import { z } from 'zod';

/**
 * Represents a schema that should infer field types from runtime data,
 * with optional field-level overrides for narrower types.
 */
export class InferSchema {
  private _overrides: Record<string, z.ZodTypeAny> = {};

  /**
   * Override specific fields with explicit Zod schemas.
   * Unspecified fields will be inferred from runtime data.
   *
   * @param overrides - Map of field names to Zod schemas
   * @returns this instance for chaining
   *
   * @example
   * ```ts
   * s.infer().override({
   *   status: s.enum(['pending', 'completed']),
   *   priority: s.union([s.literal(1), s.literal(2), s.literal(3)]),
   * })
   * ```
   */
  override(overrides: Record<string, z.ZodTypeAny>): this {
    this._overrides = { ...this._overrides, ...overrides };
    return this;
  }

  /**
   * Get the field overrides.
   */
  getOverrides(): Record<string, z.ZodTypeAny> {
    return this._overrides;
  }

  /**
   * Check if any overrides have been specified.
   */
  hasOverrides(): boolean {
    return Object.keys(this._overrides).length > 0;
  }
}

/**
 * Schema option type for createNode/extendNode.
 * Either an InferSchema (infer + override) or a full ZodObject (explicit schema).
 */
export type SchemaOption = InferSchema | z.ZodObject<z.ZodRawShape>;

/**
 * The schema builder object `s`.
 *
 * Provides a thin wrapper around Zod types with an additional `infer()` method
 * for the UDL-specific "infer from data with overrides" pattern.
 *
 * @example
 * ```ts
 * import { s } from 'universal-data-layer';
 *
 * // Primitive types
 * s.string()
 * s.number()
 * s.boolean()
 *
 * // Literal types for narrowing
 * s.literal('active')
 * s.enum(['pending', 'completed', 'cancelled'])
 *
 * // Complex types
 * s.array(s.string())
 * s.object({ name: s.string() })
 * s.union([s.literal('a'), s.literal('b')])
 *
 * // UDL-specific: infer with overrides
 * s.infer().override({ status: s.enum(['active', 'inactive']) })
 * ```
 */
export const s = {
  // Primitive types
  string: () => z.string(),
  number: () => z.number(),
  boolean: () => z.boolean(),
  null: () => z.null(),
  undefined: () => z.undefined(),

  // Literal type for narrowing
  literal: <T extends string | number | boolean>(value: T) => z.literal(value),

  // Enum for string unions
  enum: <T extends string, U extends readonly [T, ...T[]]>(values: U) =>
    z.enum(values),

  // Collection types
  array: <T extends z.ZodTypeAny>(itemType: T) => z.array(itemType),
  object: <T extends z.ZodRawShape>(shape: T) => z.object(shape),

  // Union type for combining types
  union: <T extends readonly [z.ZodTypeAny, z.ZodTypeAny, ...z.ZodTypeAny[]]>(
    types: T
  ) => z.union(types),

  // Optional wrapper
  optional: <T extends z.ZodTypeAny>(type: T) => type.optional(),

  // Nullable wrapper
  nullable: <T extends z.ZodTypeAny>(type: T) => type.nullable(),

  /**
   * Create an InferSchema that marks "infer types from runtime data".
   * Use `.override()` to narrow specific fields.
   *
   * @example
   * ```ts
   * s.infer() // Infer all fields from data
   * s.infer().override({ status: s.enum(['a', 'b']) }) // Override specific field
   * ```
   */
  infer: () => new InferSchema(),
};

/**
 * Type alias for the schema builder.
 */
export type SchemaBuilder = typeof s;

// Re-export Zod types for advanced usage
export { z };
