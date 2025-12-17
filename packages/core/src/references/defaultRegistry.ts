/**
 * Default registry singleton and factory functions.
 */

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
