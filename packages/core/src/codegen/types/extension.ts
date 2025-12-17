/**
 * Codegen Extension Types
 *
 * Defines the interface for extending UDL's code generation with custom generators.
 * Extensions can generate additional files based on the GraphQL schema and content types.
 */

import type { GraphQLSchema } from 'graphql';
import type { ContentTypeDefinition, ResolvedCodegenConfig } from './schema.js';

/**
 * Context provided to codegen extensions
 */
export interface CodegenExtensionContext {
  /** The GraphQL schema */
  schema: GraphQLSchema;

  /** Inferred content type definitions */
  types: ContentTypeDefinition[];

  /** Base path for discovering files (usually the project root) */
  basePath: string;

  /** Resolved codegen configuration */
  config: ResolvedCodegenConfig;
}

/**
 * Result of a codegen extension
 */
export interface CodegenExtensionResult {
  /** Generated code content */
  code: string;

  /** Export names to include in the main index.ts re-export */
  exports?: string[];

  /**
   * Whether to use wildcard re-export (export * from './outputDir/index.js')
   * If false or not specified, uses named exports from the `exports` array.
   * @default true
   */
  wildcardExport?: boolean;
}

/**
 * Interface for codegen extensions
 *
 * Extensions allow third-party packages to add custom code generation
 * to the UDL codegen pipeline. Each extension generates code that is
 * output to its own subdirectory within the main generated output.
 *
 * @example
 * ```typescript
 * import type { CodegenExtension } from 'universal-data-layer';
 *
 * export const extension: CodegenExtension = {
 *   name: 'my-extension',
 *   outputDir: 'custom',
 *   async generate(context) {
 *     // Generate code based on context.schema, context.types, etc.
 *     return {
 *       code: '// Generated code here',
 *       wildcardExport: true,
 *     };
 *   },
 * };
 * ```
 */
export interface CodegenExtension {
  /**
   * Unique name for this extension.
   * Used for logging and error messages.
   */
  name: string;

  /**
   * Output subdirectory for generated code.
   * This is relative to the main codegen output directory.
   * For example, 'queries' generates to `<output>/queries/index.ts`.
   */
  outputDir: string;

  /**
   * Generate code for this extension.
   *
   * @param context - Context containing schema, types, and configuration
   * @returns Generated code and export information, or null to skip generation
   */
  generate(
    context: CodegenExtensionContext
  ): Promise<CodegenExtensionResult | null>;
}

/**
 * Extension specification - can be an extension object or a package name to import
 */
export type CodegenExtensionSpec = CodegenExtension | string;
