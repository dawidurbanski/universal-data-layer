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

export {
  defaultRegistry,
  setDefaultRegistry,
  createRegistry,
} from './defaultRegistry.js';
