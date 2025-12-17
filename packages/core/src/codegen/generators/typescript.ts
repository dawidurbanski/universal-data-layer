/**
 * TypeScript Type Generator
 *
 * Generates TypeScript interface definitions from ContentTypeDefinition schemas.
 */

import type {
  ContentTypeDefinition,
  FieldDefinition,
  FieldType,
} from '@/codegen/types/schema.js';

/**
 * Options for TypeScript generation
 */
export interface TypeScriptGeneratorOptions {
  /**
   * Whether to include the internal field with NodeInternal type.
   * @default true
   */
  includeInternal?: boolean;

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
  includeInternal: true,
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
    // The following cases are handled by getTypeString before reaching this function,
    // but are included for completeness and type safety
    /* c8 ignore next 2 */
    case 'array':
      return 'unknown[]';
    /* c8 ignore next 2 */
    case 'object':
      return 'Record<string, unknown>';
    /* c8 ignore next 2 */
    case 'reference':
      return 'unknown';
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
 *     owner: 'shopify-source',
 *     fields: [
 *       { name: 'name', type: 'string', required: true },
 *       { name: 'price', type: 'number', required: true },
 *     ],
 *   },
 * ];
 *
 * const code = generator.generate(schemas);
 * // Produces:
 * // import type { NodeInternal } from 'universal-data-layer/client';
 * //
 * // /** A product in the store *\/
 * // export interface Product {
 * //   name: string;
 * //   price: number;
 * //   internal: NodeInternal<'Product', 'shopify-source'>;
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

    // Add imports if including internal field
    if (this.options.includeInternal && schemas.length > 0) {
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
    const { exportFormat, includeInternal, includeJsDoc, indent } =
      this.options;
    const lines: string[] = [];

    // Add JSDoc comment
    if (includeJsDoc && schema.description) {
      lines.push(`/** ${schema.description} */`);
    }

    // Generate interface or type alias
    if (exportFormat === 'interface') {
      lines.push(`export interface ${schema.name} {`);
    } else {
      lines.push(`export type ${schema.name} = {`);
    }

    // Generate fields
    for (const field of schema.fields) {
      const fieldLines = this.generateField(field, indent);
      lines.push(...fieldLines);
    }

    // Add internal field if enabled
    if (includeInternal) {
      const typeName = schema.name;
      const owner = schema.owner || 'unknown';
      lines.push(`${indent}internal: NodeInternal<'${typeName}', '${owner}'>;`);
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

    // Handle literal values first (from schema overrides)
    // e.g., { type: 'string', literalValues: ['pending', 'completed'] }
    // generates: 'pending' | 'completed'
    if (field.literalValues && field.literalValues.length > 0) {
      return this.getLiteralUnionTypeString(field.literalValues);
    }

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
   * Get TypeScript union type string for literal values.
   */
  private getLiteralUnionTypeString(
    values: (string | number | boolean)[]
  ): string {
    return values
      .map((v) => {
        if (typeof v === 'string') {
          // Escape single quotes in the value
          return `'${v.replace(/'/g, "\\'")}'`;
        }
        // Numbers and booleans don't need quotes
        return String(v);
      })
      .join(' | ');
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
 * Generated by universal-data-layer
 * DO NOT EDIT MANUALLY
 */
`;
  }

  /**
   * Generate import statements.
   * Note: This method is only called when includeInternal is true (see generate method),
   * so the else branch is unreachable but kept for safety.
   */
  /* c8 ignore start */
  private generateImports(): string {
    if (this.options.includeInternal) {
      return "import type { NodeInternal } from 'universal-data-layer/client';";
    }
    return '';
  }
  /* c8 ignore stop */
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
