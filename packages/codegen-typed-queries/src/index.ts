/**
 * @universal-data-layer/codegen-typed-queries
 *
 * TypedDocumentNode query generation extension for Universal Data Layer.
 * Provides compile-time type safety for GraphQL queries.
 */

import type { CodegenExtension } from 'universal-data-layer';
import { QueryDocumentGenerator } from './generator.js';

/**
 * Codegen extension for generating TypedDocumentNode queries
 *
 * This extension scans for .graphql files in your project and generates
 * TypeScript types with full type inference for use with `udl.query()`.
 *
 * @example
 * ```typescript
 * // udl.config.ts
 * import { defineConfig } from 'universal-data-layer';
 *
 * export const { config } = defineConfig({
 *   plugins: ['@universal-data-layer/plugin-source-contentful'],
 *   codegen: {
 *     output: './generated',
 *     extensions: ['@universal-data-layer/codegen-typed-queries'],
 *   },
 * });
 * ```
 */
export const extension: CodegenExtension = {
  name: '@universal-data-layer/codegen-typed-queries',
  outputDir: 'queries',

  async generate(context) {
    const generator = new QueryDocumentGenerator(context.schema, {
      includeJsDoc: context.config.includeJsDoc,
    });

    // Search for .graphql files starting from basePath
    const queries = await generator.discoverQueries([context.basePath]);

    if (queries.length === 0) {
      console.log('  ℹ️  No .graphql files found, skipping query generation');
      return null;
    }

    console.log(
      `  ⸆⸉ Generating TypedDocumentNode for ${queries.length} query(ies)...`
    );

    const code = generator.generate(queries);

    return {
      code,
      wildcardExport: true,
    };
  },
};

export default extension;

// Re-export generator for direct use
export {
  QueryDocumentGenerator,
  generateQueryDocuments,
  type QueryDocumentGeneratorOptions,
  type DiscoveredQuery,
} from './generator.js';

// Re-export TypedDocumentNode so generated code can import from this package
// This avoids pnpm phantom dependency issues
export type { TypedDocumentNode } from '@graphql-typed-document-node/core';
