/**
 * Schema inference from UDL Node Store
 *
 * Analyzes nodes in the store to infer ContentTypeDefinition schemas.
 * This allows automatic type generation from runtime data.
 */

import type {
  ContentTypeDefinition,
  FieldDefinition,
  FieldType,
} from '@/codegen/types/schema.js';
import type { z } from 'zod';
import { applySchemaOverrides } from './from-zod.js';
import { mergeFieldArrays, mergeFieldDefinitions } from './utils/index.js';
import { defaultRegistry } from '@/references/index.js';

/**
 * Minimal interface for a UDL Node.
 * Matches the structure from universal-data-layer without creating a hard dependency.
 */
interface NodeLike {
  internal: {
    id: string;
    type: string;
    owner: string;
    contentDigest: string;
  };
  [key: string]: unknown;
}

/**
 * Schema info stored for a node type (matches TypeSchemaInfo from core)
 */
export interface TypeSchemaInfo {
  /** Field overrides from InferSchema */
  overrides?: Record<string, z.ZodTypeAny>;
  /** Full Zod schema (if provided instead of InferSchema) */
  fullSchema?: z.ZodObject<z.ZodRawShape>;
}

/**
 * Minimal interface for a UDL NodeStore.
 * Allows this module to work with any compatible store implementation.
 */
export interface NodeStoreLike {
  /** Get all registered node type names */
  getTypes(): string[];
  /** Get all nodes of a specific type */
  getByType(type: string): NodeLike[];
  /** Get registered index field names for a type */
  getRegisteredIndexes(nodeType: string): string[];
  /** Get schema info for a type (optional - for schema override support) */
  getTypeSchema?(nodeType: string): TypeSchemaInfo | undefined;
}

/**
 * Reserved field names that should be excluded from inference
 * (they are part of the Node interface)
 */
const RESERVED_FIELDS = new Set(['internal', 'parent', 'children']);

/**
 * Infer the FieldType from a JavaScript value
 */
export function inferFieldType(value: unknown): FieldType {
  if (value === null) {
    return 'null';
  }

  if (value === undefined) {
    return 'unknown';
  }

  if (typeof value === 'string') {
    return 'string';
  }

  if (typeof value === 'number') {
    return 'number';
  }

  if (typeof value === 'boolean') {
    return 'boolean';
  }

  if (Array.isArray(value)) {
    return 'array';
  }

  if (typeof value === 'object') {
    return 'object';
  }

  return 'unknown';
}

/**
 * Infer a complete FieldDefinition from a JavaScript value
 */
export function inferFieldDefinition(
  name: string,
  value: unknown
): FieldDefinition {
  // Check for references using the registry (before generic object handling)
  const resolver = defaultRegistry.identifyReference(value);
  if (resolver) {
    const possibleTypes = defaultRegistry.getPossibleTypes(value);
    // Get reference type from possibleTypes if available
    let referenceType: string | undefined;
    if (possibleTypes.length > 0) {
      // If multiple possible types, create a union type
      referenceType = possibleTypes.join(' | ');
    }

    const field: FieldDefinition = {
      name,
      type: 'reference',
      required: true,
    };

    if (referenceType) {
      field.referenceType = referenceType;
    }

    return field;
  }

  const type = inferFieldType(value);

  const field: FieldDefinition = {
    name,
    type,
    required: true, // Will be adjusted when merging multiple samples
  };

  // Handle array items
  if (type === 'array' && Array.isArray(value)) {
    if (value.length > 0) {
      // Infer from first item (use a generic name for array items)
      field.arrayItemType = inferFieldDefinition('item', value[0]);
    } else {
      // Empty array - default to unknown items
      field.arrayItemType = {
        name: 'item',
        type: 'unknown',
        required: true,
      };
    }
  }

  // Handle nested objects
  if (type === 'object' && value !== null && typeof value === 'object') {
    field.objectFields = [];
    for (const [key, val] of Object.entries(value)) {
      field.objectFields.push(inferFieldDefinition(key, val));
    }
  }

  return field;
}

// Re-export merge utilities for backward compatibility
export { mergeFieldArrays, mergeFieldDefinitions };

/**
 * Infer fields from a single node, excluding reserved fields
 */
function inferFieldsFromNode(node: Record<string, unknown>): FieldDefinition[] {
  const fields: FieldDefinition[] = [];

  for (const [key, value] of Object.entries(node)) {
    if (RESERVED_FIELDS.has(key)) {
      continue;
    }
    fields.push(inferFieldDefinition(key, value));
  }

  return fields;
}

/**
 * Options for schema inference from store
 */
export interface InferFromStoreOptions {
  /**
   * Maximum number of nodes to sample per type.
   * Higher values give more accurate type inference but take longer.
   * @default 10
   */
  sampleSize?: number;

  /**
   * Include the owner (plugin name) in the content type definition.
   * @default true
   */
  includeOwner?: boolean;

  /**
   * Filter to only include types owned by these plugin names.
   * If not provided, all types are included (unless `types` is specified).
   */
  owners?: string[];

  /**
   * Filter to only include these specific type names.
   * Takes precedence over `owners` filter if both are specified.
   * @example ['Todo', 'User']
   */
  types?: string[];
}

/**
 * Infer content type definitions from a UDL node store.
 *
 * Analyzes nodes to determine:
 * - Field names and types
 * - Required vs optional fields (by comparing across nodes)
 * - Nested object structures
 * - Array item types
 * - Indexed fields
 *
 * @param store - The UDL NodeStore to analyze
 * @param options - Inference options
 * @returns Array of ContentTypeDefinition for all node types in the store
 *
 * @example
 * ```ts
 * import { defaultStore, inferSchemaFromStore } from 'universal-data-layer';
 *
 * const schemas = inferSchemaFromStore(defaultStore);
 * // schemas is ContentTypeDefinition[] ready for code generation
 * ```
 */
export function inferSchemaFromStore(
  store: NodeStoreLike,
  options: InferFromStoreOptions = {}
): ContentTypeDefinition[] {
  const { sampleSize = 10, includeOwner = true, owners, types } = options;

  const contentTypes: ContentTypeDefinition[] = [];

  // Get all registered node types
  const typeNames = store.getTypes();

  for (const typeName of typeNames) {
    // Filter by explicit types list if specified (takes precedence)
    if (types && types.length > 0) {
      if (!types.includes(typeName)) {
        continue;
      }
    }

    // Get nodes of this type
    const nodes = store.getByType(typeName);

    if (nodes.length === 0) {
      continue;
    }

    // Determine owner from the first node
    const owner = nodes[0]?.internal.owner;

    // Filter by owners if specified (only if types filter not used)
    if (!types && owners && owners.length > 0 && owner) {
      if (!owners.includes(owner)) {
        continue;
      }
    }

    // Sample nodes for type inference
    const samplesToAnalyze = nodes.slice(0, sampleSize);

    // Infer fields from the first node
    let mergedFields = inferFieldsFromNode(
      samplesToAnalyze[0] as unknown as Record<string, unknown>
    );

    // Merge with subsequent nodes to detect optional fields and type variations
    for (let i = 1; i < samplesToAnalyze.length; i++) {
      const nodeFields = inferFieldsFromNode(
        samplesToAnalyze[i] as unknown as Record<string, unknown>
      );
      mergedFields = mergeFieldArrays(mergedFields, nodeFields);
    }

    // Apply schema overrides if the store supports it and has overrides for this type
    const schemaInfo = store.getTypeSchema?.(typeName);
    if (schemaInfo?.overrides) {
      mergedFields = applySchemaOverrides(mergedFields, schemaInfo.overrides);
    }

    // Get indexed fields for this type
    const indexes = store.getRegisteredIndexes(typeName);

    // Create content type definition
    const contentType: ContentTypeDefinition = {
      name: typeName,
      fields: mergedFields,
      ...(indexes.length > 0 && { indexes }),
      ...(includeOwner && owner !== undefined && { owner }),
    };

    contentTypes.push(contentType);
  }

  return contentTypes;
}
