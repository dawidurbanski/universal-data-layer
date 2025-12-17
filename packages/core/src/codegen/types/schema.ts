/**
 * Core type definitions for the UDL code generation system.
 *
 * These types represent the internal schema format used by all generators.
 * Content type definitions can be created manually, inferred from node stores,
 * introspected from GraphQL APIs, or derived from REST API responses.
 */

/**
 * Supported primitive field types
 */
export type PrimitiveType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'null'
  | 'unknown';

/**
 * Supported complex field types
 */
export type ComplexType = 'array' | 'object' | 'reference';

/**
 * All supported field types
 */
export type FieldType = PrimitiveType | ComplexType;

/**
 * Definition of a single field within a content type
 */
export interface FieldDefinition {
  /** Field name (property key) */
  name: string;

  /** The type of this field */
  type: FieldType;

  /** Whether this field is required (non-nullable) */
  required: boolean;

  /** Optional description for JSDoc generation */
  description?: string;

  /**
   * For array fields: the type definition of array items
   * Required when type is 'array'
   */
  arrayItemType?: FieldDefinition;

  /**
   * For object fields: nested field definitions
   * Required when type is 'object'
   */
  objectFields?: FieldDefinition[];

  /**
   * For reference fields: the name of the referenced content type
   * Required when type is 'reference'
   */
  referenceType?: string;

  /**
   * For literal/enum types: specific literal values.
   * When present, generates union type (e.g., `'pending' | 'completed'`)
   * instead of the base type.
   *
   * @example
   * { type: 'string', literalValues: ['pending', 'completed'] }
   * // Generates: 'pending' | 'completed'
   */
  literalValues?: (string | number | boolean)[];
}

/**
 * Definition of a content type (maps to a TypeScript interface)
 */
export interface ContentTypeDefinition {
  /** Content type name (will be used as interface name) */
  name: string;

  /** Optional description for JSDoc generation */
  description?: string;

  /** Fields belonging to this content type */
  fields: FieldDefinition[];

  /**
   * Field names that are indexed for O(1) lookups.
   * Used by fetch helper generator to create getBy{Field} functions.
   */
  indexes?: string[];

  /**
   * The plugin/source that owns this content type definition.
   * Useful for tracking where types originated.
   */
  owner?: string;
}

import type { CodegenExtensionSpec } from './extension.js';

/**
 * Configuration for the code generation system
 */
export interface CodegenConfig {
  /**
   * Output directory or file path for generated code.
   * If ends with .ts, generates single file.
   * Otherwise, generates multi-file structure in directory.
   * @default './generated'
   */
  output?: string;

  /**
   * Whether to generate type guard functions (is{Type}, assert{Type}).
   * @default false
   */
  guards?: boolean;

  /**
   * Whether to generate fetch helper functions (getAll{Type}s, get{Type}ById, etc.).
   * Fetch helpers use `graphqlFetch` from `universal-data-layer` which automatically
   * uses the configured server endpoint.
   * @default false
   */
  helpers?: boolean;

  /**
   * Custom scalar type mappings.
   * Maps GraphQL/source scalar names to TypeScript types.
   * @example { DateTime: 'Date', JSON: 'Record<string, unknown>' }
   */
  customScalars?: Record<string, string>;

  /**
   * Whether to include the internal field with NodeInternal type in generated types.
   * @default true
   */
  includeInternal?: boolean;

  /**
   * Whether to include JSDoc comments in generated code.
   * @default true
   */
  includeJsDoc?: boolean;

  /**
   * Output format for type definitions.
   * @default 'interface'
   */
  exportFormat?: 'interface' | 'type';

  /**
   * Codegen extensions to run after built-in generators.
   * Can be extension objects or package names (will be dynamically imported).
   *
   * @example
   * ```typescript
   * extensions: ['@udl/codegen-typed-queries']
   * ```
   *
   * @example
   * ```typescript
   * extensions: [
   *   {
   *     name: 'my-extension',
   *     outputDir: 'custom',
   *     async generate(context) {
   *       return { code: '// Generated code' };
   *     },
   *   },
   * ]
   * ```
   */
  extensions?: CodegenExtensionSpec[];
}

/**
 * Resolved codegen config type with all required fields
 */
export type ResolvedCodegenConfig = Required<
  Omit<CodegenConfig, 'extensions'>
> & {
  extensions: CodegenExtensionSpec[];
};
