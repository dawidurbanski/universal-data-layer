import { createHash } from 'node:crypto';

/**
 * Creates a deterministic node ID from one or more string arguments
 * Generates stable, collision-resistant IDs suitable for cache keys
 *
 * The ID is deterministic across runs and machines, making it ideal for:
 * - Generating stable node IDs from source data
 * - Creating reproducible builds
 * - Synchronizing nodes across distributed systems
 *
 * @param args - One or more strings to hash together
 * @returns SHA-256 hash as a hex string
 *
 * @example
 * ```ts
 * // Create ID from type and external ID
 * const id = createNodeId('Product', 'shopify-123');
 * // Always produces the same ID for the same inputs
 *
 * // Create ID from multiple fields
 * const id2 = createNodeId('Review', 'product-123', 'user-456');
 * ```
 */
export function createNodeId(...args: string[]): string {
  // Join arguments with a delimiter to prevent collisions
  // e.g., ['a', 'bc'] vs ['ab', 'c'] produce different hashes
  const input = args.join(':::');

  // Create SHA-256 hash
  return createHash('sha256').update(input).digest('hex');
}
