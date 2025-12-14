/**
 * Reference Registry
 *
 * Central registry for reference resolvers from all plugins.
 * Provides unified detection and resolution of references regardless
 * of the source plugin that created them.
 */

import type { Node } from '@/nodes/types.js';
import type {
  ReferenceResolverConfig,
  ReferenceResolutionContext,
  EntityKeyConfig,
  NodeStoreLike,
} from './types.js';

/**
 * Maximum depth for reference resolution to prevent infinite loops.
 */
const DEFAULT_MAX_DEPTH = 5;

/**
 * Central registry for reference resolvers.
 *
 * Plugins register their reference formats and the registry
 * provides unified detection and resolution.
 */
export class ReferenceRegistry {
  private resolvers: Map<string, ReferenceResolverConfig> = new Map();
  private entityKeyConfigs: Map<string, EntityKeyConfig> = new Map();
  private sortedResolvers: ReferenceResolverConfig[] = [];
  private sortedEntityKeyConfigs: Array<{
    pluginId: string;
    config: EntityKeyConfig;
  }> = [];
  private store: NodeStoreLike | null = null;

  /**
   * Set the node store for reference resolution.
   * Must be called before resolving references.
   */
  setStore(store: NodeStoreLike): void {
    this.store = store;
  }

  /**
   * Get the current store.
   */
  getStore(): NodeStoreLike | null {
    return this.store;
  }

  /**
   * Register a reference resolver for a plugin.
   * @throws if a resolver with the same ID is already registered
   */
  registerResolver(config: ReferenceResolverConfig): void {
    if (this.resolvers.has(config.id)) {
      throw new Error(
        `Reference resolver with ID "${config.id}" is already registered`
      );
    }

    this.resolvers.set(config.id, config);
    this.rebuildSortedResolvers();
  }

  /**
   * Unregister a resolver by ID.
   */
  unregisterResolver(id: string): void {
    this.resolvers.delete(id);
    this.rebuildSortedResolvers();
  }

  /**
   * Get a resolver by ID.
   */
  getResolver(id: string): ReferenceResolverConfig | undefined {
    return this.resolvers.get(id);
  }

  /**
   * Get all registered resolvers, sorted by priority (highest first).
   */
  getResolvers(): ReferenceResolverConfig[] {
    return [...this.sortedResolvers];
  }

  /**
   * Check if a value is a reference from any registered resolver.
   * Returns the matching resolver config or null.
   */
  identifyReference(value: unknown): ReferenceResolverConfig | null {
    for (const resolver of this.sortedResolvers) {
      if (resolver.isReference(value)) {
        return resolver;
      }
    }
    return null;
  }

  /**
   * Check if a value is a reference (from any registered resolver).
   */
  isReference(value: unknown): boolean {
    return this.identifyReference(value) !== null;
  }

  /**
   * Check if a value is an array of references.
   */
  isReferenceArray(value: unknown): boolean {
    if (!Array.isArray(value) || value.length === 0) {
      return false;
    }
    return this.isReference(value[0]);
  }

  /**
   * Resolve a reference to its target node.
   */
  resolveReference(
    ref: unknown,
    context?: Partial<ReferenceResolutionContext>
  ): Node | null {
    const depth = context?.resolutionDepth ?? 0;
    const maxDepth = context?.maxDepth ?? DEFAULT_MAX_DEPTH;

    if (depth >= maxDepth) {
      return null;
    }

    if (!this.store) {
      console.warn(
        'ReferenceRegistry: No store set, cannot resolve references'
      );
      return null;
    }

    const resolver = this.identifyReference(ref);
    if (!resolver) {
      return null;
    }

    const lookupValue = resolver.getLookupValue(ref);
    const possibleTypes = resolver.getPossibleTypes(ref);

    // Try each possible type to find the node
    if (possibleTypes.length > 0) {
      for (const typeName of possibleTypes) {
        const node = this.store.getByField(
          typeName,
          resolver.lookupField,
          lookupValue
        );
        if (node) {
          return node;
        }
      }
    }

    // Fallback: search all types if no possibleTypes specified
    const allTypes = this.store.getTypes();
    for (const typeName of allTypes) {
      const node = this.store.getByField(
        typeName,
        resolver.lookupField,
        lookupValue
      );
      if (node) {
        return node;
      }
    }

    return null;
  }

  /**
   * Get possible types for a reference.
   */
  getPossibleTypes(ref: unknown): string[] {
    const resolver = this.identifyReference(ref);
    if (!resolver) {
      return [];
    }
    return resolver.getPossibleTypes(ref);
  }

  /**
   * Get the lookup field for a reference.
   */
  getLookupField(ref: unknown): string | null {
    const resolver = this.identifyReference(ref);
    return resolver?.lookupField ?? null;
  }

  /**
   * Register an entity key configuration for normalization.
   */
  registerEntityKeyConfig(pluginId: string, config: EntityKeyConfig): void {
    this.entityKeyConfigs.set(pluginId, config);
    this.rebuildSortedEntityKeyConfigs();
  }

  /**
   * Unregister an entity key configuration.
   */
  unregisterEntityKeyConfig(pluginId: string): void {
    this.entityKeyConfigs.delete(pluginId);
    this.rebuildSortedEntityKeyConfigs();
  }

  /**
   * Get entity key for an object using registered configurations.
   * Returns null if no config matches.
   */
  getEntityKey(obj: unknown): string | null {
    if (typeof obj !== 'object' || obj === null) {
      return null;
    }

    const record = obj as Record<string, unknown>;

    // Get type from __typename or internal.type
    let type = record['__typename'] as string | undefined;
    if (!type) {
      const internal = record['internal'] as
        | Record<string, unknown>
        | undefined;
      type = internal?.['type'] as string | undefined;
    }

    if (!type) {
      return null;
    }

    // Try each entity key config in priority order
    for (const { config } of this.sortedEntityKeyConfigs) {
      const idValue = record[config.idField];
      if (idValue !== undefined && idValue !== null) {
        return `${type}:${idValue}`;
      }
    }

    return null;
  }

  /**
   * Clear all registrations (useful for testing).
   */
  clear(): void {
    this.resolvers.clear();
    this.entityKeyConfigs.clear();
    this.sortedResolvers = [];
    this.sortedEntityKeyConfigs = [];
  }

  /**
   * Rebuild the sorted resolvers array after registration changes.
   */
  private rebuildSortedResolvers(): void {
    this.sortedResolvers = Array.from(this.resolvers.values()).sort(
      (a, b) => (b.priority ?? 0) - (a.priority ?? 0)
    );
  }

  /**
   * Rebuild the sorted entity key configs array after registration changes.
   */
  private rebuildSortedEntityKeyConfigs(): void {
    this.sortedEntityKeyConfigs = Array.from(this.entityKeyConfigs.entries())
      .map(([pluginId, config]) => ({ pluginId, config }))
      .sort((a, b) => (b.config.priority ?? 0) - (a.config.priority ?? 0));
  }
}
