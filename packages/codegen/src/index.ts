/**
 * @udl/codegen - Type generation utilities for Universal Data Layer
 *
 * This package provides tools to generate TypeScript types, type guards,
 * and fetch helpers from UDL node stores, GraphQL schemas, or REST API responses.
 *
 * @example
 * ```ts
 * import {
 *   SchemaRegistry,
 *   inferSchemaFromStore,
 *   TypeScriptGenerator,
 * } from '@udl/codegen';
 *
 * // Create a registry and populate it
 * const registry = new SchemaRegistry();
 * registry.registerAll(inferSchemaFromStore(nodeStore));
 *
 * // Generate TypeScript code
 * const generator = new TypeScriptGenerator({ includeJsDoc: true });
 * const code = generator.generate(registry.getAll());
 * ```
 */

// Types
export type {
  PrimitiveType,
  ComplexType,
  FieldType,
  FieldDefinition,
  ContentTypeDefinition,
  CodegenConfig,
} from './types/index.js';

export { DEFAULT_CODEGEN_CONFIG, resolveCodegenConfig } from './types/index.js';

// Registry
export {
  SchemaRegistry,
  defaultRegistry,
  type RegisterTypesContext,
} from './registry.js';

// Inference
export {
  // From store
  inferSchemaFromStore,
  inferFieldType,
  inferFieldDefinition,
  mergeFieldDefinitions,
  type InferFromStoreOptions,
  type NodeStoreLike,
  // From GraphQL
  introspectGraphQLSchema,
  parseIntrospectionResult,
  clearIntrospectionCache,
  type IntrospectOptions,
} from './inference/index.js';
