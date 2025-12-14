/**
 * Code Generation Integration
 *
 * Provides automatic code generation after sourceNodes completes.
 * Supports extensible code generation via the CodegenExtension interface.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { existsSync } from 'node:fs';
import type { GraphQLSchema } from 'graphql';
import type { CodegenConfig } from '@/loader.js';
import type { NodeStore } from '@/nodes/store.js';
import type {
  ContentTypeDefinition,
  CodegenExtensionResult,
} from '@/codegen/types/index.js';
import {
  inferSchemaFromStore,
  TypeScriptGenerator,
  TypeGuardGenerator,
  resolveCodegenConfig,
  loadExtensions,
} from '@/codegen/index.js';

/**
 * Options for running codegen
 */
export interface RunCodegenOptions {
  /** Code generation configuration */
  config: CodegenConfig;
  /** Node store to generate from */
  store: NodeStore;
  /** Base directory for resolving output path */
  basePath?: string;
  /** Filter to only generate types for nodes owned by these plugins */
  owners?: string[];
  /** GraphQL schema for extensions (optional, required for schema-aware extensions) */
  schema?: GraphQLSchema;
}

/**
 * Generated file content
 */
interface GeneratedFiles {
  types: string;
  guards?: string;
  /** Extension-generated files: key is outputDir, value is the result */
  extensions: Map<string, CodegenExtensionResult>;
}

/**
 * Run code generation from the node store
 *
 * @param options - Codegen options
 * @returns Promise that resolves when generation is complete
 */
export async function runCodegen(options: RunCodegenOptions): Promise<void> {
  const { config, store, basePath = process.cwd(), owners, schema } = options;

  // Resolve config with defaults
  const resolvedConfig = resolveCodegenConfig(config);

  // Resolve output path
  const outputDir = resolve(basePath, resolvedConfig.output);

  // Build inference options based on config
  const inferOptions: { owners?: string[]; types?: string[] } = {};
  if ((config as { types?: string[] }).types?.length) {
    inferOptions.types = (config as { types: string[] }).types;
  } else if (owners && owners.length > 0) {
    inferOptions.owners = owners;
  }

  // Infer schemas from the node store
  // Cast store to unknown first since NodeStore and NodeStoreLike have compatible runtime behavior
  // but different TypeScript signatures (index signature vs specific fields)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const schemas = inferSchemaFromStore(store as any, inferOptions);

  if (schemas.length === 0) {
    console.log('ℹ️  No nodes found in store, skipping codegen');
    return;
  }

  console.log(`⸆⸉ Generating types for ${schemas.length} node type(s)...`);

  // Generate code
  const includeJsDoc = resolvedConfig.includeJsDoc;
  const includeInternal = resolvedConfig.includeInternal;

  const files: GeneratedFiles = {
    types: '',
    extensions: new Map(),
  };

  // Generate TypeScript types (always generated)
  const tsGenerator = new TypeScriptGenerator({
    includeJsDoc,
    includeInternal,
  });
  files.types = tsGenerator.generate(schemas);

  // Generate type guards if enabled
  if (resolvedConfig.guards) {
    const guardGenerator = new TypeGuardGenerator({ includeJsDoc });
    files.guards = guardGenerator.generate(schemas);
  }

  // Run codegen extensions
  if (resolvedConfig.extensions.length > 0) {
    await runExtensions(resolvedConfig, schemas, basePath, schema, files);
  }

  // Write files to output directory
  await writeGeneratedFiles(outputDir, files, schemas);

  console.log(`✅ Generated types in ${owners?.join(', ')}`);
}

/**
 * Run codegen extensions
 */
async function runExtensions(
  config: ReturnType<typeof resolveCodegenConfig>,
  schemas: ContentTypeDefinition[],
  basePath: string,
  schema: GraphQLSchema | undefined,
  files: GeneratedFiles
): Promise<void> {
  // Load extensions
  const extensions = await loadExtensions(config.extensions);

  if (extensions.length === 0) {
    return;
  }

  // Create extension context
  const context = {
    schema: schema!,
    types: schemas,
    basePath,
    config,
  };

  // Run each extension
  for (const extension of extensions) {
    // Skip if extension requires schema but none is available
    if (!schema) {
      console.warn(
        `⚠️  Extension "${extension.name}" requires a schema but none is available`
      );
      continue;
    }

    try {
      console.log(`⸆⸉ Running extension "${extension.name}"...`);
      const result = await extension.generate(context);

      if (result) {
        files.extensions.set(extension.outputDir, result);
      }
    } catch (error) {
      console.warn(`⚠️  Extension "${extension.name}" failed:`, error);
    }
  }
}

/**
 * Write generated files to the output directory
 */
async function writeGeneratedFiles(
  outputDir: string,
  files: GeneratedFiles,
  schemas: Array<{ name: string }>
): Promise<void> {
  // Ensure output directory exists
  if (!existsSync(outputDir)) {
    await mkdir(outputDir, { recursive: true });
  }

  // Create subdirectories
  const typesDir = join(outputDir, 'types');
  const guardsDir = join(outputDir, 'guards');

  if (!existsSync(typesDir)) {
    await mkdir(typesDir, { recursive: true });
  }

  // Write types
  await writeFile(join(typesDir, 'index.ts'), files.types);

  // Write guards if generated
  if (files.guards) {
    if (!existsSync(guardsDir)) {
      await mkdir(guardsDir, { recursive: true });
    }
    await writeFile(join(guardsDir, 'index.ts'), files.guards);
  }

  // Write extension-generated files
  for (const [extOutputDir, result] of files.extensions) {
    const extDir = join(outputDir, extOutputDir);
    if (!existsSync(extDir)) {
      await mkdir(extDir, { recursive: true });
    }
    await writeFile(join(extDir, 'index.ts'), result.code);
  }

  // Create main index.ts that re-exports everything
  const indexContent = generateIndexFile(files, schemas);
  await writeFile(join(outputDir, 'index.ts'), indexContent);
}

/**
 * Generate the main index.ts file that re-exports all generated code
 */
function generateIndexFile(
  files: GeneratedFiles,
  schemas: Array<{ name: string }>
): string {
  const lines: string[] = [
    '/**',
    ' * Auto-generated by universal-data-layer',
    ' * DO NOT EDIT MANUALLY',
    ' */',
    '',
  ];

  // Re-export types
  const typeNames = schemas.map((s) => s.name).join(', ');
  lines.push(`// Types`);
  lines.push(`export type { ${typeNames} } from './types/index';`);

  // Re-export guards if generated
  if (files.guards) {
    const guardNames = schemas
      .flatMap((s) => [`is${s.name}`, `assert${s.name}`])
      .join(', ');
    lines.push('');
    lines.push(`// Type Guards`);
    lines.push(`export { ${guardNames} } from './guards/index';`);
  }

  // Re-export extension-generated code
  for (const [extOutputDir, result] of files.extensions) {
    lines.push('');
    lines.push(`// Extension: ${extOutputDir}`);

    // Use wildcard export by default, or named exports if specified
    if (result.wildcardExport !== false) {
      lines.push(`export * from './${extOutputDir}/index';`);
    } else if (result.exports && result.exports.length > 0) {
      lines.push(
        `export { ${result.exports.join(', ')} } from './${extOutputDir}/index';`
      );
    }
  }

  lines.push('');

  return lines.join('\n');
}
