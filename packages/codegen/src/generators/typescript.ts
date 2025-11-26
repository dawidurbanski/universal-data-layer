/**
 * TypeScript Type Generator
 *
 * Generates TypeScript interface definitions from ContentTypeDefinition schemas.
 */

import type {
  ContentTypeDefinition,
  FieldDefinition,
  FieldType,
} from '@/types/schema.js';

/**
 * Options for TypeScript generation
 */
export interface TypeScriptGeneratorOptions {
  /**
   * Whether generated types should extend the UDL Node interface.
   * @default true
   */
  extendNode?: boolean;

  /**
   * Export format for type definitions.
   * @default 'interface'
   */
  exportFormat?: 'interface' | 'type';

  /**
   * Whether to include JSDoc comments in generated code.
   * @default true
   */
  includeJsDoc?: boolean;

  /**
   * Custom scalar type mappings.
   * Maps custom type names to TypeScript types.
   * @example { DateTime: 'Date', JSON: 'Record<string, unknown>' }
   */
  customScalars?: Record<string, string>;

  /**
   * Indentation string to use.
   * @default '  ' (2 spaces)
   */
  indent?: string;
}

/**
 * Default generator options
 */
const DEFAULT_OPTIONS: Required<TypeScriptGeneratorOptions> = {
  extendNode: true,
  exportFormat: 'interface',
  includeJsDoc: true,
  customScalars: {},
  indent: '  ',
};

/**
 * Map FieldType to TypeScript type string
 */
function fieldTypeToTypeScript(
  fieldType: FieldType,
  customScalars: Record<string, string>
): string {
  // Check custom scalars first
  if (customScalars[fieldType]) {
    return customScalars[fieldType];
  }

  switch (fieldType) {
    case 'string':
      return 'string';
    case 'number':
      return 'number';
    case 'boolean':
      return 'boolean';
    case 'null':
      return 'null';
    case 'array':
      return 'unknown[]'; // Will be overridden with specific type
    case 'object':
      return 'Record<string, unknown>'; // Will be overridden with inline type
    case 'reference':
      return 'unknown'; // Will be overridden with specific type name
    case 'unknown':
    default:
      return 'unknown';
  }
}

/**
 * TypeScript code generator for ContentTypeDefinition schemas.
 *
 * @example
 * ```ts
 * const generator = new TypeScriptGenerator({ includeJsDoc: true });
 *
 * const schemas: ContentTypeDefinition[] = [
 *   {
 *     name: 'Product',
 *     description: 'A product in the store',
 *     fields: [
 *       { name: 'name', type: 'string', required: true },
 *       { name: 'price', type: 'number', required: true },
 *     ],
 *   },
 * ];
 *
 * const code = generator.generate(schemas);
 * // Produces:
 * // import type { Node } from 'universal-data-layer';
 * //
 * // /** A product in the store *\/
 * // export interface Product extends Node {
 * //   name: string;
 * //   price: number;
 * // }
 * ```
 */
export class TypeScriptGenerator {
  private options: Required<TypeScriptGeneratorOptions>;

  constructor(options: TypeScriptGeneratorOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Generate TypeScript code for multiple content type definitions.
   *
   * @param schemas - Array of content type definitions to generate
   * @returns Complete TypeScript code as a string
   */
  generate(schemas: ContentTypeDefinition[]): string {
    const parts: string[] = [];

    // Add file header
    parts.push(this.generateHeader());

    // Add imports if extending Node
    if (this.options.extendNode) {
      parts.push(this.generateImports());
      parts.push('');
    }

    // Generate each type
    for (let i = 0; i < schemas.length; i++) {
      const schema = schemas[i];
      if (!schema) continue;

      if (i > 0) {
        parts.push('');
      }
      parts.push(this.generateType(schema));
    }

    return parts.join('\n');
  }

  /**
   * Generate TypeScript code for a single content type definition.
   *
   * @param schema - The content type definition to generate
   * @returns TypeScript code for this type
   */
  generateType(schema: ContentTypeDefinition): string {
    const { exportFormat, extendNode, includeJsDoc, indent } = this.options;
    const lines: string[] = [];

    // Add JSDoc comment
    if (includeJsDoc && schema.description) {
      lines.push(`/** ${schema.description} */`);
    }

    // Generate interface or type alias
    if (exportFormat === 'interface') {
      const extendsClause = extendNode ? ' extends Node' : '';
      lines.push(`export interface ${schema.name}${extendsClause} {`);
    } else {
      const baseType = extendNode ? 'Node & ' : '';
      lines.push(`export type ${schema.name} = ${baseType}{`);
    }

    // Generate fields
    for (const field of schema.fields) {
      const fieldLines = this.generateField(field, indent);
      lines.push(...fieldLines);
    }

    lines.push('}');

    return lines.join('\n');
  }

  /**
   * Generate a single field definition.
   */
  private generateField(field: FieldDefinition, indent: string): string[] {
    const lines: string[] = [];
    const { includeJsDoc } = this.options;

    // Add JSDoc comment for field
    if (includeJsDoc && field.description) {
      lines.push(`${indent}/** ${field.description} */`);
    }

    const optional = field.required ? '' : '?';
    const fieldName = this.escapeFieldName(field.name);
    const typeString = this.getTypeString(field);

    lines.push(`${indent}${fieldName}${optional}: ${typeString};`);

    return lines;
  }

  /**
   * Get the TypeScript type string for a field.
   */
  private getTypeString(field: FieldDefinition): string {
    const { customScalars } = this.options;

    switch (field.type) {
      case 'array':
        return this.getArrayTypeString(field);
      case 'object':
        return this.getObjectTypeString(field);
      case 'reference':
        return field.referenceType || 'unknown';
      default:
        return fieldTypeToTypeScript(field.type, customScalars);
    }
  }

  /**
   * Get TypeScript type string for array fields.
   */
  private getArrayTypeString(field: FieldDefinition): string {
    if (!field.arrayItemType) {
      return 'unknown[]';
    }

    const itemType = this.getTypeString(field.arrayItemType);

    // Use Array<T> syntax for complex types, T[] for simple
    if (itemType.includes('|') || itemType.includes('{')) {
      return `Array<${itemType}>`;
    }

    return `${itemType}[]`;
  }

  /**
   * Get TypeScript type string for object fields (inline type).
   */
  private getObjectTypeString(field: FieldDefinition): string {
    if (!field.objectFields || field.objectFields.length === 0) {
      return 'Record<string, unknown>';
    }

    const { indent } = this.options;
    const innerIndent = indent + indent;

    const fieldStrings = field.objectFields.map((f) => {
      const optional = f.required ? '' : '?';
      const name = this.escapeFieldName(f.name);
      const type = this.getTypeString(f);
      return `${innerIndent}${name}${optional}: ${type};`;
    });

    return `{\n${fieldStrings.join('\n')}\n${indent}}`;
  }

  /**
   * Escape field names that need quoting.
   */
  private escapeFieldName(name: string): string {
    // Check if name is a valid identifier
    if (/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(name)) {
      return name;
    }
    // Quote the name
    return `'${name.replace(/'/g, "\\'")}'`;
  }

  /**
   * Generate file header comment.
   */
  private generateHeader(): string {
    return `/**
 * Auto-generated TypeScript types
 * Generated by @udl/codegen
 * DO NOT EDIT MANUALLY
 */
`;
  }

  /**
   * Generate import statements.
   */
  private generateImports(): string {
    if (this.options.extendNode) {
      return "import type { Node } from 'universal-data-layer';";
    }
    return '';
  }
}

/**
 * Generate TypeScript code from content type definitions.
 *
 * Convenience function that creates a generator and calls generate().
 *
 * @param schemas - Array of content type definitions
 * @param options - Generator options
 * @returns Generated TypeScript code
 */
export function generateTypeScript(
  schemas: ContentTypeDefinition[],
  options: TypeScriptGeneratorOptions = {}
): string {
  const generator = new TypeScriptGenerator(options);
  return generator.generate(schemas);
}
