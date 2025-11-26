/**
 * Type definitions for the UDL code generation system
 */

export type {
  PrimitiveType,
  ComplexType,
  FieldType,
  FieldDefinition,
  ContentTypeDefinition,
  CodegenConfig,
} from './schema.js';

export { DEFAULT_CODEGEN_CONFIG, resolveCodegenConfig } from './schema.js';
