import { createHash } from 'node:crypto';

/**
 * Creates a deterministic SHA-256 hash from any data structure
 * Used to generate content digests for nodes to detect changes
 *
 * The hash is deterministic and stable across machines, making it suitable
 * for distributed systems and synchronization engines
 *
 * @param data - Any serializable data (object, array, string, number, etc.)
 * @returns SHA-256 hash as a hex string
 *
 * @example
 * ```ts
 * const digest1 = createContentDigest({ name: 'Product', price: 100 });
 * const digest2 = createContentDigest({ name: 'Product', price: 100 });
 * console.log(digest1 === digest2); // true - deterministic
 *
 * const digest3 = createContentDigest({ name: 'Product', price: 200 });
 * console.log(digest1 === digest3); // false - different content
 * ```
 */
export function createContentDigest(data: unknown): string {
  // Serialize data to JSON with sorted keys for deterministic output
  // Handle primitives, null, and undefined by just stringifying them
  let serialized: string;

  if (data === null || data === undefined || typeof data !== 'object') {
    // JSON.stringify(undefined) returns undefined, so we need to handle it specially
    serialized = JSON.stringify(data) ?? 'undefined';
  } else {
    // For objects and arrays, sort keys for deterministic output
    serialized = JSON.stringify(data, Object.keys(data).sort());
  }

  // Create SHA-256 hash
  return createHash('sha256').update(serialized).digest('hex');
}
