/**
 * Schema inference utilities
 *
 * Provides functions to infer ContentTypeDefinition schemas from various sources:
 * - UDL Node Store (runtime data)
 * - GraphQL introspection (external APIs)
 * - REST API responses (JSON samples)
 */

export {
  inferSchemaFromStore,
  inferFieldType,
  inferFieldDefinition,
  mergeFieldDefinitions,
  type InferFromStoreOptions,
  type NodeStoreLike,
} from './from-store.js';

export {
  introspectGraphQLSchema,
  parseIntrospectionResult,
  clearIntrospectionCache,
  type IntrospectOptions,
} from './from-graphql.js';
