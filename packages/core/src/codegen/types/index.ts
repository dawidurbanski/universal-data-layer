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
  ResolvedCodegenConfig,
} from './schema.js';

export type {
  CodegenExtension,
  CodegenExtensionContext,
  CodegenExtensionResult,
  CodegenExtensionSpec,
} from './extension.js';
