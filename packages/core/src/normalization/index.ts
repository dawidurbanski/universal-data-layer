/**
 * Response normalization utilities.
 *
 * Transforms GraphQL responses to extract entities and replace with refs,
 * enabling deduplication of repeated data in responses.
 */

/**
 * A normalized GraphQL response with entities extracted
 */
export interface NormalizedResponse<T = unknown> {
  /** The normalized data with refs replacing entities */
  data: T;
  /** Map of entity keys to their data */
  $entities: Record<string, unknown>;
  /** Any GraphQL errors */
  errors?: readonly unknown[] | undefined;
}

/**
 * Options for normalization
 */
export interface NormalizeOptions {
  /**
   * Function to extract an entity key from an object.
   * Returns null if the object is not an entity.
   */
  getEntityKey?: (obj: unknown) => string | null;
}

/**
 * Default entity key extractor.
 * Uses __typename and contentfulId to create unique keys.
 * Falls back to internal.type if __typename is not present.
 */
export function defaultGetEntityKey(obj: unknown): string | null {
  if (typeof obj !== 'object' || obj === null) return null;

  const record = obj as Record<string, unknown>;

  // Try __typename first (auto-injected by server)
  let type = record['__typename'] as string | undefined;

  // Fall back to internal.type for backwards compatibility
  if (!type) {
    const internal = record['internal'] as Record<string, unknown> | undefined;
    type = internal?.['type'] as string | undefined;
  }

  const contentfulId = record['contentfulId'] as string | undefined;

  // Only create entity key if we have both type and contentfulId
  if (type && contentfulId) {
    return `${type}:${contentfulId}`;
  }

  return null;
}

/**
 * Normalizes a GraphQL response by extracting entities and replacing them with refs.
 *
 * This enables:
 * - Deduplication of repeated entities in the response
 * - Smaller payload sizes when the same entity appears multiple times
 * - Easy client-side caching with Apollo-style normalization
 *
 * @param data - The data to normalize
 * @param options - Normalization options
 * @returns Normalized response with $entities map
 *
 * @example
 * ```typescript
 * // Input: 500 variants, 20 unique swatches
 * const data = {
 *   product: {
 *     variants: [
 *       { name: "Red", swatch: { internal: { type: "Swatch" }, contentfulId: "s1", color: "#ff0000" } },
 *       { name: "Blue", swatch: { internal: { type: "Swatch" }, contentfulId: "s2", color: "#0000ff" } },
 *       // ... more variants, many sharing the same swatches
 *     ]
 *   }
 * };
 *
 * // Output: swatches deduplicated in $entities
 * const { data: normalized, $entities } = normalizeResponse(data);
 * // normalized.product.variants[0].swatch = { $ref: "Swatch:s1" }
 * // $entities["Swatch:s1"] = { internal: {...}, contentfulId: "s1", color: "#ff0000" }
 * ```
 */
export function normalizeResponse<T>(
  data: T,
  options: NormalizeOptions = {}
): NormalizedResponse<T> {
  const { getEntityKey = defaultGetEntityKey } = options;
  const entities: Record<string, unknown> = {};

  function walk(value: unknown): unknown {
    // Handle arrays
    if (Array.isArray(value)) {
      return value.map((item) => walk(item));
    }

    // Handle objects
    if (typeof value === 'object' && value !== null) {
      const key = getEntityKey(value);

      // If this is an entity
      if (key) {
        // First time seeing this entity - store it with normalized children
        if (!entities[key]) {
          const normalized: Record<string, unknown> = {};
          for (const [k, v] of Object.entries(value)) {
            normalized[k] = walk(v);
          }
          entities[key] = normalized;
        }

        // Always replace with ref (whether first time or duplicate)
        return { $ref: key };
      }

      // Not an entity - recurse into properties
      const result: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(value)) {
        result[k] = walk(v);
      }
      return result;
    }

    // Primitives pass through unchanged
    return value;
  }

  const normalizedData = walk(data) as T;

  return {
    data: normalizedData,
    $entities: entities,
  };
}

/**
 * Wraps a GraphQL execution result with normalization.
 *
 * @param result - The GraphQL execution result
 * @param options - Normalization options
 * @returns Normalized result with $entities
 */
export function normalizeGraphQLResult(
  result: { data?: unknown; errors?: readonly unknown[] },
  options: NormalizeOptions = {}
): NormalizedResponse {
  const normalized = result.data
    ? normalizeResponse(result.data, options)
    : { data: null, $entities: {} };

  const response: NormalizedResponse = {
    data: normalized.data,
    $entities: normalized.$entities,
  };

  if (result.errors) {
    response.errors = result.errors;
  }

  return response;
}
