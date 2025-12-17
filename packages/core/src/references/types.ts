/**
 * Generic reference system types.
 *
 * These interfaces allow any source plugin to define its own reference format
 * without the core having hardcoded knowledge of specific data sources.
 */

import type { Node } from '@/nodes/types.js';

/**
 * Context for reference resolution.
 */
export interface ReferenceResolutionContext {
  /** Current resolution depth for cycle prevention */
  resolutionDepth: number;
  /** Maximum allowed resolution depth */
  maxDepth: number;
}

/**
 * Configuration for a reference resolver registered by a plugin.
 *
 * Plugins export this configuration to tell the core how to identify
 * and resolve references from their data source.
 *
 * @example
 * ```typescript
 * // In a Contentful plugin
 * export const referenceResolver: ReferenceResolverConfig = {
 *   id: '@universal-data-layer/plugin-source-contentful',
 *   markerField: '_contentfulRef',
 *   lookupField: 'contentfulId',
 *   isReference: (value) => isContentfulReference(value),
 *   getLookupValue: (ref) => ref.contentfulId,
 *   getPossibleTypes: (ref) => ref.possibleTypes ?? [],
 * };
 * ```
 */
export interface ReferenceResolverConfig {
  /**
   * Unique identifier for this resolver (typically plugin name).
   * @example '@universal-data-layer/plugin-source-contentful'
   */
  id: string;

  /**
   * The marker field name used to identify references from this plugin.
   * Must start with underscore and not double underscore (GraphQL reserved).
   * @example '_contentfulRef'
   */
  markerField: string;

  /**
   * Field name used for looking up the referenced node.
   * This field must be indexed on the relevant node types.
   * @example 'contentfulId'
   */
  lookupField: string;

  /**
   * Type guard function to check if a value is a reference from this plugin.
   */
  isReference: (value: unknown) => boolean;

  /**
   * Extract the lookup value from a reference object.
   * @example (ref) => ref.contentfulId
   */
  getLookupValue: (ref: unknown) => unknown;

  /**
   * Extract possible types from a reference object (for union type generation).
   * Returns empty array if reference doesn't specify possible types.
   */
  getPossibleTypes: (ref: unknown) => string[];

  /**
   * Priority for resolution when multiple resolvers could match.
   * Higher priority resolvers are checked first.
   * @default 0
   */
  priority?: number;
}

/**
 * Configuration for entity key extraction (used in normalization).
 *
 * Plugins export this to tell the normalization system how to
 * extract unique entity keys from their nodes.
 */
export interface EntityKeyConfig {
  /**
   * The ID field to use for entity keys.
   * @example 'contentfulId'
   */
  idField: string;

  /**
   * Priority for key extraction when multiple configs could apply.
   * Higher priority configs are tried first.
   * @default 0
   */
  priority?: number;
}

/**
 * Interface for node store operations needed by the reference registry.
 * This avoids circular dependencies with the full NodeStore.
 */
export interface NodeStoreLike {
  getTypes(): string[];
  getByField(type: string, field: string, value: unknown): Node | undefined;
}
