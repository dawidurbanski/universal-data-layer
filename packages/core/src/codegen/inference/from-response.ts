/**
 * Schema inference from REST API responses
 *
 * Analyzes JSON responses to infer ContentTypeDefinition schemas.
 * Supports single responses or multiple samples for better accuracy.
 */

import type {
  ContentTypeDefinition,
  FieldDefinition,
} from '@/codegen/types/schema.js';
import { inferFieldDefinition } from './from-store.js';
import { mergeFieldArrays } from './utils/index.js';

/**
 * Options for inferring schema from a response
 */
export interface InferFromResponseOptions {
  /**
   * Description for the generated content type.
   */
  description?: string;

  /**
   * Fields that should be marked as indexed.
   */
  indexes?: string[];

  /**
   * Owner/source identifier for the content type.
   */
  owner?: string;

  /**
   * Path to the actual data within the response.
   * Use dot notation for nested paths.
   * @example 'data' for { data: [...] }
   * @example 'response.items' for { response: { items: [...] } }
   */
  dataPath?: string;

  /**
   * Whether the response is an array of items.
   * If true, will infer from the first item.
   * If not specified, will auto-detect.
   */
  isArray?: boolean;
}

/**
 * Extract data from a response using a dot-notation path
 */
function extractDataFromPath(data: unknown, path: string): unknown {
  if (!path) {
    return data;
  }

  const parts = path.split('.');
  let current: unknown = data;

  for (const part of parts) {
    if (current === null || current === undefined) {
      return undefined;
    }
    if (typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }

  return current;
}

/**
 * Infer a ContentTypeDefinition from a single JSON response.
 *
 * @param response - The JSON response to analyze (parsed JSON, not a string)
 * @param typeName - The name for the generated content type
 * @param options - Inference options
 * @returns A ContentTypeDefinition inferred from the response
 *
 * @example
 * ```ts
 * // From a single object response
 * const productResponse = { id: '1', name: 'Widget', price: 29.99 };
 * const schema = inferSchemaFromResponse(productResponse, 'Product');
 *
 * // From an array response
 * const productsResponse = [
 *   { id: '1', name: 'Widget', price: 29.99 },
 *   { id: '2', name: 'Gadget', price: 49.99 },
 * ];
 * const schema = inferSchemaFromResponse(productsResponse, 'Product');
 *
 * // With data path for wrapped responses
 * const apiResponse = { data: { items: [{ id: '1', name: 'Widget' }] } };
 * const schema = inferSchemaFromResponse(apiResponse, 'Product', {
 *   dataPath: 'data.items',
 * });
 * ```
 */
export function inferSchemaFromResponse(
  response: unknown,
  typeName: string,
  options: InferFromResponseOptions = {}
): ContentTypeDefinition {
  const { description, indexes, owner, dataPath, isArray } = options;

  // Extract data from path if specified
  let data = dataPath ? extractDataFromPath(response, dataPath) : response;

  // Handle array responses - infer from all items
  const shouldTreatAsArray = isArray ?? Array.isArray(data);

  if (shouldTreatAsArray && Array.isArray(data)) {
    if (data.length === 0) {
      // Empty array - return empty schema
      return {
        name: typeName,
        fields: [],
        ...(description && { description }),
        ...(indexes && indexes.length > 0 && { indexes }),
        ...(owner && { owner }),
      };
    }

    // Infer from all items and merge
    const allFields: FieldDefinition[][] = [];

    for (const item of data) {
      if (item !== null && typeof item === 'object') {
        const fields = inferFieldsFromObject(item as Record<string, unknown>);
        allFields.push(fields);
      }
    }

    // Merge all field arrays
    let mergedFields = allFields[0] ?? [];
    for (let i = 1; i < allFields.length; i++) {
      mergedFields = mergeFieldArrays(mergedFields, allFields[i] ?? []);
    }

    return {
      name: typeName,
      fields: mergedFields,
      ...(description && { description }),
      ...(indexes && indexes.length > 0 && { indexes }),
      ...(owner && { owner }),
    };
  }

  // Handle single object response
  if (data !== null && typeof data === 'object' && !Array.isArray(data)) {
    const fields = inferFieldsFromObject(data as Record<string, unknown>);

    return {
      name: typeName,
      fields,
      ...(description && { description }),
      ...(indexes && indexes.length > 0 && { indexes }),
      ...(owner && { owner }),
    };
  }

  // Unable to infer from this response type
  return {
    name: typeName,
    fields: [],
    ...(description && { description }),
    ...(indexes && indexes.length > 0 && { indexes }),
    ...(owner && { owner }),
  };
}

/**
 * Infer fields from a plain object
 */
function inferFieldsFromObject(
  obj: Record<string, unknown>
): FieldDefinition[] {
  const fields: FieldDefinition[] = [];

  for (const [key, value] of Object.entries(obj)) {
    fields.push(inferFieldDefinition(key, value));
  }

  return fields;
}

/**
 * Merge multiple response samples into a single ContentTypeDefinition.
 *
 * This is useful when you have multiple API responses and want to
 * detect optional fields by comparing across samples.
 *
 * @param responses - Array of JSON responses to analyze
 * @param typeName - The name for the generated content type
 * @param options - Inference options (applied to all responses)
 * @returns A ContentTypeDefinition merged from all responses
 *
 * @example
 * ```ts
 * const responses = [
 *   { id: '1', name: 'Widget', price: 29.99 },
 *   { id: '2', name: 'Gadget', price: 49.99, discount: 10 },
 *   { id: '3', name: 'Thing', price: 19.99 },
 * ];
 *
 * const schema = mergeResponseInferences(responses, 'Product');
 * // discount field will be marked as optional since it's not in all samples
 * ```
 */
export function mergeResponseInferences(
  responses: unknown[],
  typeName: string,
  options: InferFromResponseOptions = {}
): ContentTypeDefinition {
  if (responses.length === 0) {
    return {
      name: typeName,
      fields: [],
      ...(options.description && { description: options.description }),
      ...(options.indexes &&
        options.indexes.length > 0 && { indexes: options.indexes }),
      ...(options.owner && { owner: options.owner }),
    };
  }

  // Infer from first response
  let merged = inferSchemaFromResponse(responses[0], typeName, options);

  // Merge subsequent responses
  for (let i = 1; i < responses.length; i++) {
    const current = inferSchemaFromResponse(responses[i], typeName, options);
    merged = {
      ...merged,
      fields: mergeFieldArrays(merged.fields, current.fields),
    };
  }

  return merged;
}

/**
 * Infer schema from a JSON string response.
 *
 * Convenience function that parses JSON before inferring.
 *
 * @param jsonString - The JSON string to parse and analyze
 * @param typeName - The name for the generated content type
 * @param options - Inference options
 * @returns A ContentTypeDefinition inferred from the parsed JSON
 *
 * @example
 * ```ts
 * const json = '{"id": "1", "name": "Widget", "price": 29.99}';
 * const schema = inferSchemaFromJsonString(json, 'Product');
 * ```
 */
export function inferSchemaFromJsonString(
  jsonString: string,
  typeName: string,
  options: InferFromResponseOptions = {}
): ContentTypeDefinition {
  try {
    const parsed = JSON.parse(jsonString) as unknown;
    return inferSchemaFromResponse(parsed, typeName, options);
  } catch {
    // Return empty schema on parse error
    return {
      name: typeName,
      fields: [],
      ...(options.description && { description: options.description }),
      ...(options.indexes &&
        options.indexes.length > 0 && { indexes: options.indexes }),
      ...(options.owner && { owner: options.owner }),
    };
  }
}
