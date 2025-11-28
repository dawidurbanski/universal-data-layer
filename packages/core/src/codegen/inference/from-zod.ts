/**
 * Zod Schema to FieldDefinition Converter
 *
 * Converts Zod schema types to UDL FieldDefinition objects for code generation.
 * Used when schema overrides are provided at createNode call sites.
 */

import type { z } from 'zod';
import type { FieldDefinition, FieldType } from '../types/schema.js';

/**
 * Get the internal _def property from a Zod schema
 * This is an internal Zod API but stable across versions
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getZodDef(schema: z.ZodTypeAny): any {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (schema as any)._def;
}

/**
 * Zod type names for internal type checking
 * Supports both Zod v3 (ZodString) and Zod v4 (string) naming conventions
 */
type ZodTypeName =
  | 'string'
  | 'number'
  | 'boolean'
  | 'null'
  | 'undefined'
  | 'literal'
  | 'enum'
  | 'array'
  | 'object'
  | 'union'
  | 'optional'
  | 'nullable';

/**
 * Get the Zod type name from a schema's _def property
 * Supports both Zod v3 and v4 internal structures
 */
function getZodTypeName(schema: z.ZodTypeAny): ZodTypeName | string {
  const def = getZodDef(schema);
  if (!def) return 'unknown';

  // Zod v4 uses _def.type as a string directly (e.g., "string", "enum")
  if (typeof def.type === 'string') {
    return def.type;
  }

  // Zod v3 uses _def.typeName (e.g., "ZodString", "ZodEnum")
  // Convert v3 format to v4 format for consistency
  if (typeof def.typeName === 'string') {
    return def.typeName.replace('Zod', '').toLowerCase();
  }

  return 'unknown';
}

/**
 * Extract literal values from a Zod union of literals
 */
function extractLiteralValues(
  schema: z.ZodTypeAny
): (string | number | boolean)[] | undefined {
  const typeName = getZodTypeName(schema);
  const def = getZodDef(schema);

  // Single literal
  if (typeName === 'literal') {
    // Zod v4 uses values array, v3 uses value
    if (Array.isArray(def.values) && def.values.length > 0) {
      const value = def.values[0];
      if (
        typeof value === 'string' ||
        typeof value === 'number' ||
        typeof value === 'boolean'
      ) {
        return [value];
      }
    }
    // Fallback for v3
    const value = def.value;
    if (
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean'
    ) {
      return [value];
    }
  }

  // Enum (string union shorthand)
  if (typeName === 'enum') {
    // Zod v4 uses entries object, v3 uses values array
    if (def.entries && typeof def.entries === 'object') {
      return Object.keys(def.entries) as string[];
    }
    if (Array.isArray(def.values)) {
      return def.values as string[];
    }
  }

  // Union of literals
  if (typeName === 'union') {
    const options = def.options as z.ZodTypeAny[];
    const literals: (string | number | boolean)[] = [];

    for (const option of options) {
      const optionTypeName = getZodTypeName(option);
      if (optionTypeName === 'literal') {
        const optDef = getZodDef(option);
        // Zod v4 uses values array, v3 uses value
        const value = Array.isArray(optDef.values)
          ? optDef.values[0]
          : optDef.value;
        if (
          typeof value === 'string' ||
          typeof value === 'number' ||
          typeof value === 'boolean'
        ) {
          literals.push(value);
        }
      }
    }

    if (literals.length > 0) {
      return literals;
    }
  }

  return undefined;
}

/**
 * Determine the base FieldType from a Zod schema
 */
function getBaseType(schema: z.ZodTypeAny): FieldType {
  const typeName = getZodTypeName(schema);
  const def = getZodDef(schema);

  switch (typeName) {
    case 'string':
      return 'string';
    case 'number':
      return 'number';
    case 'boolean':
      return 'boolean';
    case 'null':
      return 'null';
    case 'undefined':
      return 'null'; // Map undefined to null for TypeScript output
    case 'literal': {
      // Zod v4 uses values array, v3 uses value
      const value = Array.isArray(def.values) ? def.values[0] : def.value;
      if (typeof value === 'string') return 'string';
      if (typeof value === 'number') return 'number';
      if (typeof value === 'boolean') return 'boolean';
      return 'unknown';
    }
    case 'enum':
      return 'string'; // Enums are always string unions
    case 'array':
      return 'array';
    case 'object':
      return 'object';
    case 'union': {
      // For union of literals, determine the common type
      const options = def.options as z.ZodTypeAny[];
      const firstOption = options?.[0];
      if (firstOption) {
        // Check first option for base type
        return getBaseType(firstOption);
      }
      return 'unknown';
    }
    case 'optional':
    case 'nullable':
      // Unwrap and get inner type - Zod v4 uses innerType, v3 may use different names
      if (def.innerType) {
        return getBaseType(def.innerType);
      }
      // Fallback for different structure
      return 'unknown';
    default:
      return 'unknown';
  }
}

/**
 * Check if a Zod schema represents an optional field
 */
function isOptional(schema: z.ZodTypeAny): boolean {
  const typeName = getZodTypeName(schema);
  return typeName === 'optional' || typeName === 'nullable';
}

/**
 * Unwrap optional/nullable wrappers to get the inner schema
 */
function unwrapSchema(schema: z.ZodTypeAny): z.ZodTypeAny {
  const typeName = getZodTypeName(schema);
  if (typeName === 'optional' || typeName === 'nullable') {
    const innerType = getZodDef(schema).innerType;
    if (innerType) {
      return unwrapSchema(innerType);
    }
  }
  return schema;
}

/**
 * Convert a Zod schema to a FieldDefinition
 *
 * @param name - Field name
 * @param schema - Zod schema type
 * @returns FieldDefinition for the field
 *
 * @example
 * ```ts
 * import { z } from 'zod';
 *
 * // String field
 * zodToFieldDefinition('name', z.string())
 * // { name: 'name', type: 'string', required: true }
 *
 * // Enum field with literals
 * zodToFieldDefinition('status', z.enum(['pending', 'completed']))
 * // { name: 'status', type: 'string', required: true, literalValues: ['pending', 'completed'] }
 *
 * // Optional field
 * zodToFieldDefinition('nickname', z.string().optional())
 * // { name: 'nickname', type: 'string', required: false }
 * ```
 */
export function zodToFieldDefinition(
  name: string,
  schema: z.ZodTypeAny
): FieldDefinition {
  const required = !isOptional(schema);
  const unwrapped = unwrapSchema(schema);
  const type = getBaseType(unwrapped);
  const literalValues = extractLiteralValues(unwrapped);

  const field: FieldDefinition = {
    name,
    type,
    required,
  };

  // Add literal values if present
  if (literalValues && literalValues.length > 0) {
    field.literalValues = literalValues;
  }

  // Handle array item type
  if (type === 'array') {
    const def = getZodDef(unwrapped);
    // Zod v4 uses element, v3 uses type
    const itemSchema = (def.element || def.type) as z.ZodTypeAny;
    if (itemSchema) {
      field.arrayItemType = zodToFieldDefinition('item', itemSchema);
    }
  }

  // Handle object fields
  if (type === 'object') {
    const def = getZodDef(unwrapped);
    // Zod v4 uses shape as object, v3 uses shape as function
    const shape: Record<string, z.ZodTypeAny> =
      typeof def.shape === 'function' ? def.shape() : def.shape;
    if (shape) {
      field.objectFields = Object.entries(shape).map(
        ([fieldName, fieldSchema]) =>
          zodToFieldDefinition(fieldName, fieldSchema)
      );
    }
  }

  return field;
}

/**
 * Apply Zod schema overrides to existing FieldDefinitions
 *
 * @param fields - Array of inferred FieldDefinitions
 * @param overrides - Map of field names to Zod schemas
 * @returns Updated FieldDefinitions with schema overrides applied
 *
 * @example
 * ```ts
 * const fields = [
 *   { name: 'status', type: 'string', required: true },
 *   { name: 'count', type: 'number', required: true },
 * ];
 *
 * const overrides = {
 *   status: z.enum(['pending', 'completed']),
 * };
 *
 * applySchemaOverrides(fields, overrides);
 * // [
 * //   { name: 'status', type: 'string', required: true, literalValues: ['pending', 'completed'] },
 * //   { name: 'count', type: 'number', required: true },
 * // ]
 * ```
 */
export function applySchemaOverrides(
  fields: FieldDefinition[],
  overrides: Record<string, z.ZodTypeAny>
): FieldDefinition[] {
  return fields.map((field) => {
    const override = overrides[field.name];
    if (!override) {
      return field;
    }

    // Convert the override schema to a FieldDefinition
    const overrideField = zodToFieldDefinition(field.name, override);

    // Merge: override takes precedence for type-related properties
    // but preserve description from original if not in override
    const merged: FieldDefinition = {
      ...field,
      type: overrideField.type,
      // Keep required from original unless override is explicitly optional
      required: overrideField.required ? field.required : false,
    };

    // Only include optional properties if they have values
    // (required by exactOptionalPropertyTypes)
    if (overrideField.literalValues) {
      merged.literalValues = overrideField.literalValues;
    }
    if (overrideField.arrayItemType) {
      merged.arrayItemType = overrideField.arrayItemType;
    }
    if (overrideField.objectFields) {
      merged.objectFields = overrideField.objectFields;
    }

    return merged;
  });
}
