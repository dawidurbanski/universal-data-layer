/**
 * Reference system exports.
 *
 * Provides a pluggable reference system that allows any source plugin
 * to define its own reference format without core having hardcoded
 * knowledge of specific data sources.
 */

export type {
  ReferenceResolverConfig,
  ReferenceResolutionContext,
  EntityKeyConfig,
  NodeStoreLike,
} from './types.js';

export { ReferenceRegistry } from './registry.js';

import { ReferenceRegistry } from './registry.js';

/**
 * Default singleton registry instance.
 * Used throughout the application for reference detection and resolution.
 */
export let defaultRegistry = new ReferenceRegistry();

/**
 * Replace the default registry (useful for testing).
 */
export function setDefaultRegistry(registry: ReferenceRegistry): void {
  defaultRegistry = registry;
}

/**
 * Create a new registry instance.
 */
export function createRegistry(): ReferenceRegistry {
  return new ReferenceRegistry();
}
