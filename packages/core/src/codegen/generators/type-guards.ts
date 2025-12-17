/**
 * Type Guard Generator
 *
 * Generates runtime type guard functions (is{Type} and assert{Type})
 * from ContentTypeDefinition schemas.
 */

import type {
  ContentTypeDefinition,
  FieldDefinition,
  FieldType,
} from '@/codegen/types/schema.js';

/**
 * Options for type guard generation
 */
export interface TypeGuardGeneratorOptions {
  /**
   * Whether to generate is{Type} functions.
   * @default true
   */
  generateIsGuards?: boolean;

  /**
   * Whether to generate assert{Type} functions.
   * @default true
   */
  generateAssertGuards?: boolean;

  /**
   * Whether to include JSDoc comments.
   * @default true
   */
  includeJsDoc?: boolean;

  /**
   * Indentation string to use.
   * @default '  ' (2 spaces)
   */
  indent?: string;

  /**
   * Whether to check nested object fields.
   * If false, only checks that nested fields are objects.
   * @default true
   */
  deepCheck?: boolean;

  /**
   * Whether to check array item types.
   * If false, only checks that arrays are arrays.
   * @default false (for performance)
   */
  checkArrayItems?: boolean;
}

/**
 * Default generator options
 */
const DEFAULT_OPTIONS: Required<TypeGuardGeneratorOptions> = {
  generateIsGuards: true,
  generateAssertGuards: true,
  includeJsDoc: true,
  indent: '  ',
  deepCheck: true,
  checkArrayItems: false,
};

/**
 * Get the typeof check for a primitive type
 */
function getTypeofCheck(fieldType: FieldType): string | null {
  switch (fieldType) {
    case 'string':
      return 'string';
    case 'number':
      return 'number';
    case 'boolean':
      return 'boolean';
    default:
      return null;
  }
}

/**
 * Type guard code generator for ContentTypeDefinition schemas.
 *
 * @example
 * ```ts
 * const generator = new TypeGuardGenerator();
 *
 * const schemas: ContentTypeDefinition[] = [
 *   {
 *     name: 'Product',
 *     fields: [
 *       { name: 'name', type: 'string', required: true },
 *       { name: 'price', type: 'number', required: true },
 *     ],
 *   },
 * ];
 *
 * const code = generator.generate(schemas);
 * // Produces isProduct() and assertProduct() functions
 * ```
 */
export class TypeGuardGenerator {
  private options: Required<TypeGuardGeneratorOptions>;

  constructor(options: TypeGuardGeneratorOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Generate type guard code for multiple content type definitions.
   *
   * @param schemas - Array of content type definitions
   * @returns Complete TypeScript code as a string
   */
  generate(schemas: ContentTypeDefinition[]): string {
    const parts: string[] = [];

    // Add file header
    parts.push(this.generateHeader());

    // Add type imports
    if (schemas.length > 0) {
      parts.push(this.generateTypeImports(schemas));
      parts.push('');
    }

    // Generate guards for each type
    schemas.forEach((schema, i) => {
      if (i > 0) {
        parts.push('');
      }
      parts.push(this.generateGuardsForType(schema));
    });

    return parts.join('\n');
  }

  /**
   * Generate import statement for all types.
   */
  private generateTypeImports(schemas: ContentTypeDefinition[]): string {
    const typeNames = schemas.map((s) => s.name).join(', ');
    return `import type { ${typeNames} } from '../types/index';`;
  }

  /**
   * Generate guards for a single content type.
   */
  generateGuardsForType(schema: ContentTypeDefinition): string {
    const parts: string[] = [];
    const { generateIsGuards, generateAssertGuards } = this.options;

    if (generateIsGuards) {
      parts.push(this.generateIsGuard(schema));
    }

    if (generateAssertGuards) {
      if (generateIsGuards) {
        parts.push('');
      }
      parts.push(this.generateAssertGuard(schema));
    }

    return parts.join('\n');
  }

  /**
   * Generate is{Type} guard function.
   */
  private generateIsGuard(schema: ContentTypeDefinition): string {
    const { includeJsDoc, indent } = this.options;
    const lines: string[] = [];

    // JSDoc
    if (includeJsDoc) {
      lines.push(`/**`);
      lines.push(` * Type guard for ${schema.name}.`);
      lines.push(` * @param value - The value to check`);
      lines.push(` * @returns True if value is a valid ${schema.name}`);
      lines.push(` */`);
    }

    // Function signature
    lines.push(
      `export function is${schema.name}(value: unknown): value is ${schema.name} {`
    );

    // Basic object check
    lines.push(`${indent}if (typeof value !== 'object' || value === null) {`);
    lines.push(`${indent}${indent}return false;`);
    lines.push(`${indent}}`);

    // Cast to record for property access
    lines.push(`${indent}const obj = value as Record<string, unknown>;`);

    // Generate field checks
    for (const field of schema.fields) {
      const checks = this.generateFieldCheck(field, 'obj', indent);
      lines.push(...checks);
    }

    // Return true if all checks passed
    lines.push(`${indent}return true;`);
    lines.push('}');

    return lines.join('\n');
  }

  /**
   * Generate assert{Type} guard function.
   */
  private generateAssertGuard(schema: ContentTypeDefinition): string {
    const { includeJsDoc, indent } = this.options;
    const lines: string[] = [];

    // JSDoc
    if (includeJsDoc) {
      lines.push(`/**`);
      lines.push(` * Assertion guard for ${schema.name}.`);
      lines.push(` * @param value - The value to check`);
      lines.push(` * @throws TypeError if value is not a valid ${schema.name}`);
      lines.push(` */`);
    }

    // Function signature
    lines.push(
      `export function assert${schema.name}(value: unknown): asserts value is ${schema.name} {`
    );

    // Call is guard and throw if false
    lines.push(`${indent}if (!is${schema.name}(value)) {`);
    lines.push(
      `${indent}${indent}throw new TypeError('Value is not a valid ${schema.name}');`
    );
    lines.push(`${indent}}`);
    lines.push('}');

    return lines.join('\n');
  }

  /**
   * Generate checks for a single field.
   */
  private generateFieldCheck(
    field: FieldDefinition,
    objVar: string,
    indent: string
  ): string[] {
    const lines: string[] = [];
    const fieldAccess = this.getFieldAccess(objVar, field.name);

    if (field.required) {
      // Required field - must exist and have correct type
      lines.push(
        ...this.generateRequiredFieldCheck(field, fieldAccess, indent)
      );
    } else {
      // Optional field - only check type if present
      lines.push(`${indent}if (${fieldAccess} !== undefined) {`);
      const innerChecks = this.generateTypeCheck(
        field,
        fieldAccess,
        indent + this.options.indent
      );
      lines.push(...innerChecks);
      lines.push(`${indent}}`);
    }

    return lines;
  }

  /**
   * Generate check for a required field.
   */
  private generateRequiredFieldCheck(
    field: FieldDefinition,
    fieldAccess: string,
    indent: string
  ): string[] {
    return this.generateTypeCheck(field, fieldAccess, indent);
  }

  /**
   * Generate type check for a field.
   */
  private generateTypeCheck(
    field: FieldDefinition,
    fieldAccess: string,
    indent: string
  ): string[] {
    const lines: string[] = [];
    const { deepCheck, checkArrayItems } = this.options;

    switch (field.type) {
      case 'string':
      case 'number':
      case 'boolean': {
        const typeofValue = getTypeofCheck(field.type);
        lines.push(
          `${indent}if (typeof ${fieldAccess} !== '${typeofValue}') {`
        );
        lines.push(`${indent}${this.options.indent}return false;`);
        lines.push(`${indent}}`);
        break;
      }

      case 'null':
        lines.push(`${indent}if (${fieldAccess} !== null) {`);
        lines.push(`${indent}${this.options.indent}return false;`);
        lines.push(`${indent}}`);
        break;

      case 'array':
        lines.push(`${indent}if (!Array.isArray(${fieldAccess})) {`);
        lines.push(`${indent}${this.options.indent}return false;`);
        lines.push(`${indent}}`);

        // Optionally check array items
        if (checkArrayItems && field.arrayItemType) {
          const itemType = field.arrayItemType;
          const typeofItem = getTypeofCheck(itemType.type);
          if (typeofItem) {
            lines.push(
              `${indent}if (!${fieldAccess}.every((item: unknown) => typeof item === '${typeofItem}')) {`
            );
            lines.push(`${indent}${this.options.indent}return false;`);
            lines.push(`${indent}}`);
          }
        }
        break;

      case 'object':
        lines.push(
          `${indent}if (typeof ${fieldAccess} !== 'object' || ${fieldAccess} === null || Array.isArray(${fieldAccess})) {`
        );
        lines.push(`${indent}${this.options.indent}return false;`);
        lines.push(`${indent}}`);

        // Optionally check nested object fields
        if (deepCheck && field.objectFields && field.objectFields.length > 0) {
          // Filter to only required fields that will actually generate checks
          const fieldsToCheck = field.objectFields.filter(
            (f) => f.required && f.type !== 'unknown'
          );

          // Only create the nested variable if there are checks to generate
          if (fieldsToCheck.length > 0) {
            const nestedVar = `${fieldAccess}Obj`;
            lines.push(
              `${indent}const ${this.sanitizeVarName(nestedVar)} = ${fieldAccess} as Record<string, unknown>;`
            );
            for (const nestedField of fieldsToCheck) {
              const nestedAccess = this.getFieldAccess(
                this.sanitizeVarName(nestedVar),
                nestedField.name
              );
              const nestedChecks = this.generateTypeCheck(
                nestedField,
                nestedAccess,
                indent
              );
              lines.push(...nestedChecks);
            }
          }
        }
        break;

      case 'reference':
        // For references, we just check it's an object (we can't check the actual type at runtime without the guard)
        lines.push(
          `${indent}if (typeof ${fieldAccess} !== 'object' || ${fieldAccess} === null) {`
        );
        lines.push(`${indent}${this.options.indent}return false;`);
        lines.push(`${indent}}`);
        break;

      case 'unknown':
      default:
        // No check needed for unknown type
        break;
    }

    return lines;
  }

  /**
   * Get field access expression.
   * Always uses bracket notation for compatibility with noPropertyAccessFromIndexSignature.
   */
  private getFieldAccess(objVar: string, fieldName: string): string {
    return `${objVar}['${fieldName.replace(/'/g, "\\'")}']`;
  }

  /**
   * Sanitize a variable name for use in generated code.
   */
  private sanitizeVarName(name: string): string {
    return name.replace(/[^a-zA-Z0-9_$]/g, '_');
  }

  /**
   * Generate file header comment.
   */
  private generateHeader(): string {
    return `/**
 * Auto-generated type guards
 * Generated by universal-data-layer
 * DO NOT EDIT MANUALLY
 */

/* eslint-disable @typescript-eslint/no-unused-vars */
`;
  }
}

/**
 * Generate type guard code from content type definitions.
 *
 * Convenience function that creates a generator and calls generate().
 *
 * @param schemas - Array of content type definitions
 * @param options - Generator options
 * @returns Generated TypeScript code
 */
export function generateTypeGuards(
  schemas: ContentTypeDefinition[],
  options: TypeGuardGeneratorOptions = {}
): string {
  const generator = new TypeGuardGenerator(options);
  return generator.generate(schemas);
}
