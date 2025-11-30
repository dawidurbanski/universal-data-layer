/**
 * Client-side helper to resolve normalized responses back to nested structure.
 *
 * This is a lightweight utility (~30 lines) with zero dependencies,
 * designed to be used in any client environment.
 */

/**
 * A normalized response with $ref placeholders and $entities map
 */
export interface NormalizedResponse<T = unknown> {
  data: T;
  $entities?: Record<string, unknown>;
}

/**
 * A reference placeholder in a normalized response
 */
interface RefPlaceholder {
  $ref: string;
}

/**
 * Check if a value is a reference placeholder
 */
function isRef(value: unknown): value is RefPlaceholder {
  return (
    typeof value === 'object' &&
    value !== null &&
    '$ref' in value &&
    typeof (value as RefPlaceholder).$ref === 'string'
  );
}

/**
 * Resolves a normalized response back to its nested structure.
 *
 * Takes a response with `$ref` placeholders and `$entities` map,
 * and recursively replaces refs with their actual entity data.
 *
 * @param response - The normalized response from the server
 * @returns The denormalized data with all refs resolved
 *
 * @example
 * ```typescript
 * import { resolveRefs } from 'universal-data-layer/client';
 *
 * // Fetch normalized response from server
 * const response = await fetch('/graphql', {
 *   method: 'POST',
 *   body: JSON.stringify({ query: '{ product { variants { swatch { color } } } }' }),
 * }).then(r => r.json());
 *
 * // Response shape:
 * // {
 * //   data: { product: { variants: [{ $ref: "Variant:v1" }] } },
 * //   $entities: {
 * //     "Variant:v1": { swatch: { $ref: "Swatch:s1" } },
 * //     "Swatch:s1": { color: "#ff0000" }
 * //   }
 * // }
 *
 * // Resolve refs to get nested structure
 * const product = resolveRefs(response);
 * // { product: { variants: [{ swatch: { color: "#ff0000" } }] } }
 * ```
 */
export function resolveRefs<T>(response: NormalizedResponse<T>): T {
  const entities = response.$entities ?? {};
  const seen = new WeakSet<object>(); // Prevent infinite loops on circular refs

  function resolve(value: unknown): unknown {
    // Handle arrays
    if (Array.isArray(value)) {
      return value.map(resolve);
    }

    // Handle objects
    if (typeof value === 'object' && value !== null) {
      // Check if this is a reference
      if (isRef(value)) {
        const entity = entities[value.$ref];
        if (entity && typeof entity === 'object') {
          // Check for circular reference
          if (seen.has(entity as object)) {
            // Return entity as-is to avoid infinite loop
            return entity;
          }
          seen.add(entity as object);
          return resolve(entity);
        }
        // Reference not found - return null
        return null;
      }

      // Regular object - recursively resolve properties
      const result: Record<string, unknown> = {};
      for (const [key, val] of Object.entries(value)) {
        result[key] = resolve(val);
      }
      return result;
    }

    // Primitives pass through unchanged
    return value;
  }

  return resolve(response.data) as T;
}
