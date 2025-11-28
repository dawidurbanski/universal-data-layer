/**
 * Field merging utilities for schema inference
 *
 * Shared utilities for merging FieldDefinition arrays and handling
 * type conflicts when inferring schemas from multiple samples.
 */

import type { FieldDefinition } from '@/codegen/types/schema.js';

/**
 * Merge two field definitions, handling type conflicts
 *
 * When the same field has different types across samples:
 * - If one is 'null' or 'unknown', prefer the other type
 * - If types differ otherwise, fall back to 'unknown'
 * - Mark as not required if either sample had it missing
 */
export function mergeFieldDefinitions(
  a: FieldDefinition,
  b: FieldDefinition
): FieldDefinition {
  // Determine description (only set if one exists)
  const description = a.description ?? b.description;

  // Start with field a as base
  const merged: FieldDefinition = {
    name: a.name,
    type: a.type,
    required: a.required && b.required,
    ...(description !== undefined && { description }),
  };

  // Handle type conflicts
  if (a.type !== b.type) {
    // Prefer non-null/non-unknown types
    if (a.type === 'null' || a.type === 'unknown') {
      merged.type = b.type;
    } else if (b.type === 'null' || b.type === 'unknown') {
      merged.type = a.type;
    } else {
      // Types genuinely differ - fall back to unknown
      merged.type = 'unknown';
    }
  }

  // Merge array item types
  if (merged.type === 'array') {
    if (a.arrayItemType && b.arrayItemType) {
      merged.arrayItemType = mergeFieldDefinitions(
        a.arrayItemType,
        b.arrayItemType
      );
    } else if (a.arrayItemType) {
      merged.arrayItemType = a.arrayItemType;
    } else if (b.arrayItemType) {
      merged.arrayItemType = b.arrayItemType;
    }
  }

  // Merge object fields
  if (merged.type === 'object') {
    const fieldMap = new Map<string, FieldDefinition>();

    // Add all fields from a
    for (const field of a.objectFields || []) {
      fieldMap.set(field.name, { ...field });
    }

    // Merge fields from b
    for (const field of b.objectFields || []) {
      const existing = fieldMap.get(field.name);
      if (existing) {
        fieldMap.set(field.name, mergeFieldDefinitions(existing, field));
      } else {
        // Field only in b - mark as optional
        fieldMap.set(field.name, { ...field, required: false });
      }
    }

    // Mark fields only in a as optional
    for (const field of a.objectFields || []) {
      const inB = (b.objectFields || []).some((f) => f.name === field.name);
      if (!inB) {
        const existing = fieldMap.get(field.name);
        if (existing) {
          existing.required = false;
        }
      }
    }

    merged.objectFields = Array.from(fieldMap.values());
  }

  return merged;
}

/**
 * Merge field arrays from multiple samples, detecting optional fields
 *
 * Fields present in some but not all samples are marked as optional.
 * Type conflicts between samples are resolved using mergeFieldDefinitions.
 */
export function mergeFieldArrays(
  existing: FieldDefinition[],
  incoming: FieldDefinition[]
): FieldDefinition[] {
  const fieldMap = new Map<string, FieldDefinition>();

  // Add existing fields
  for (const field of existing) {
    fieldMap.set(field.name, field);
  }

  // Merge incoming fields
  for (const field of incoming) {
    const existingField = fieldMap.get(field.name);
    if (existingField) {
      fieldMap.set(field.name, mergeFieldDefinitions(existingField, field));
    } else {
      // New field not in all samples - mark as optional
      fieldMap.set(field.name, { ...field, required: false });
    }
  }

  // Mark fields not in incoming as optional
  for (const field of existing) {
    const inIncoming = incoming.some((f) => f.name === field.name);
    if (!inIncoming) {
      const current = fieldMap.get(field.name);
      if (current) {
        current.required = false;
      }
    }
  }

  return Array.from(fieldMap.values());
}
