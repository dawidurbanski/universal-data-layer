/**
 * Fetch Helper Generator
 *
 * Generates typed fetch helper functions that use the UDL GraphQL API.
 * Creates getAll{Type}s(), get{Type}ById(), and get{Type}By{Index}() functions.
 */

import type { ContentTypeDefinition, FieldDefinition } from '@/types/schema.js';

/**
 * Options for fetch helper generation
 */
export interface FetchHelperGeneratorOptions {
  /**
   * The GraphQL endpoint URL.
   * @default 'http://localhost:4000/graphql'
   */
  endpoint?: string;

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
   * Whether to include the internal fields in queries.
   * @default true
   */
  includeInternalFields?: boolean;

  /**
   * Custom fetch function name to use.
   * If not provided, uses global fetch.
   */
  customFetchFn?: string;

  /**
   * Whether to generate async/await style or Promise chains.
   * @default 'async'
   */
  style?: 'async' | 'promise';
}

/**
 * Default generator options
 */
const DEFAULT_OPTIONS: Required<FetchHelperGeneratorOptions> = {
  endpoint: 'http://localhost:4000/graphql',
  includeJsDoc: true,
  indent: '  ',
  includeInternalFields: true,
  customFetchFn: '',
  style: 'async',
};

/**
 * Fetch helper code generator for ContentTypeDefinition schemas.
 *
 * @example
 * ```ts
 * const generator = new FetchHelperGenerator({
 *   endpoint: 'http://localhost:4000/graphql',
 * });
 *
 * const schemas: ContentTypeDefinition[] = [
 *   {
 *     name: 'Product',
 *     fields: [
 *       { name: 'name', type: 'string', required: true },
 *       { name: 'slug', type: 'string', required: true },
 *     ],
 *     indexes: ['slug'],
 *   },
 * ];
 *
 * const code = generator.generate(schemas);
 * // Produces getAllProducts(), getProductById(), getProductBySlug() functions
 * ```
 */
export class FetchHelperGenerator {
  private options: Required<FetchHelperGeneratorOptions>;

  constructor(options: FetchHelperGeneratorOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Generate fetch helper code for multiple content type definitions.
   *
   * @param schemas - Array of content type definitions
   * @returns Complete TypeScript code as a string
   */
  generate(schemas: ContentTypeDefinition[]): string {
    const parts: string[] = [];

    // Add file header
    parts.push(this.generateHeader());

    // Add endpoint constant
    parts.push(this.generateEndpointConstant());
    parts.push('');

    // Add helper functions
    parts.push(this.generateFetchHelper());
    parts.push('');

    // Generate helpers for each type
    for (let i = 0; i < schemas.length; i++) {
      const schema = schemas[i];
      if (!schema) continue;

      if (i > 0) {
        parts.push('');
      }
      parts.push(this.generateHelpersForType(schema));
    }

    return parts.join('\n');
  }

  /**
   * Generate helpers for a single content type.
   */
  generateHelpersForType(schema: ContentTypeDefinition): string {
    const parts: string[] = [];

    // Generate getAll function
    parts.push(this.generateGetAll(schema));
    parts.push('');

    // Generate getById function
    parts.push(this.generateGetById(schema));

    // Generate getBy{Index} functions for each indexed field
    if (schema.indexes && schema.indexes.length > 0) {
      for (const indexField of schema.indexes) {
        parts.push('');
        parts.push(this.generateGetByIndex(schema, indexField));
      }
    }

    return parts.join('\n');
  }

  /**
   * Generate getAll{Type}s function.
   */
  private generateGetAll(schema: ContentTypeDefinition): string {
    const { includeJsDoc, indent } = this.options;
    const lines: string[] = [];
    const typeName = schema.name;
    const queryName = `all${typeName}`;
    const fnName = `getAll${this.pluralize(typeName)}`;

    // JSDoc
    if (includeJsDoc) {
      lines.push(`/**`);
      lines.push(` * Fetch all ${typeName} nodes.`);
      lines.push(` * @returns Promise resolving to array of ${typeName}`);
      lines.push(` */`);
    }

    // Function signature
    lines.push(`export async function ${fnName}(): Promise<${typeName}[]> {`);

    // Build query
    const fieldsQuery = this.buildFieldsQuery(schema.fields);
    const query = `{ ${queryName} { ${fieldsQuery} } }`;

    // Function body
    lines.push(
      `${indent}const data = await graphqlFetch<{ ${queryName}: ${typeName}[] }>(`
    );
    lines.push(`${indent}${indent}\`${query}\``);
    lines.push(`${indent});`);
    lines.push(`${indent}return data.${queryName};`);
    lines.push('}');

    return lines.join('\n');
  }

  /**
   * Generate get{Type}ById function.
   */
  private generateGetById(schema: ContentTypeDefinition): string {
    const { includeJsDoc, indent } = this.options;
    const lines: string[] = [];
    const typeName = schema.name;
    const queryName = typeName.charAt(0).toLowerCase() + typeName.slice(1);
    const fnName = `get${typeName}ById`;

    // JSDoc
    if (includeJsDoc) {
      lines.push(`/**`);
      lines.push(` * Fetch a ${typeName} by its internal ID.`);
      lines.push(` * @param id - The internal ID of the ${typeName}`);
      lines.push(
        ` * @returns Promise resolving to ${typeName} or null if not found`
      );
      lines.push(` */`);
    }

    // Function signature
    lines.push(
      `export async function ${fnName}(id: string): Promise<${typeName} | null> {`
    );

    // Build query with variable
    const fieldsQuery = this.buildFieldsQuery(schema.fields);
    const query = `query Get${typeName}ById($id: ID!) { ${queryName}(id: $id) { ${fieldsQuery} } }`;

    // Function body
    lines.push(
      `${indent}const data = await graphqlFetch<{ ${queryName}: ${typeName} | null }>(`
    );
    lines.push(`${indent}${indent}\`${query}\`,`);
    lines.push(`${indent}${indent}{ id }`);
    lines.push(`${indent});`);
    lines.push(`${indent}return data.${queryName};`);
    lines.push('}');

    return lines.join('\n');
  }

  /**
   * Generate get{Type}By{Index} function for an indexed field.
   */
  private generateGetByIndex(
    schema: ContentTypeDefinition,
    indexField: string
  ): string {
    const { includeJsDoc, indent } = this.options;
    const lines: string[] = [];
    const typeName = schema.name;
    const capitalizedIndex =
      indexField.charAt(0).toUpperCase() + indexField.slice(1);
    const queryName = `${typeName.charAt(0).toLowerCase() + typeName.slice(1)}By${capitalizedIndex}`;
    const fnName = `get${typeName}By${capitalizedIndex}`;

    // Find the field to determine its type
    const field = schema.fields.find((f) => f.name === indexField);
    const paramType = field ? this.getParamType(field.type) : 'string';
    const gqlType = field ? this.getGraphQLType(field.type) : 'String';

    // JSDoc
    if (includeJsDoc) {
      lines.push(`/**`);
      lines.push(` * Fetch a ${typeName} by its ${indexField}.`);
      lines.push(` * @param ${indexField} - The ${indexField} to search for`);
      lines.push(
        ` * @returns Promise resolving to ${typeName} or null if not found`
      );
      lines.push(` */`);
    }

    // Function signature
    lines.push(
      `export async function ${fnName}(${indexField}: ${paramType}): Promise<${typeName} | null> {`
    );

    // Build query with variable
    const fieldsQuery = this.buildFieldsQuery(schema.fields);
    const query = `query Get${typeName}By${capitalizedIndex}($${indexField}: ${gqlType}!) { ${queryName}(${indexField}: $${indexField}) { ${fieldsQuery} } }`;

    // Function body
    lines.push(
      `${indent}const data = await graphqlFetch<{ ${queryName}: ${typeName} | null }>(`
    );
    lines.push(`${indent}${indent}\`${query}\`,`);
    lines.push(`${indent}${indent}{ ${indexField} }`);
    lines.push(`${indent});`);
    lines.push(`${indent}return data.${queryName};`);
    lines.push('}');

    return lines.join('\n');
  }

  /**
   * Build GraphQL query fields from field definitions.
   * @param fields - The field definitions
   * @param isTopLevel - Whether this is the top-level query (for adding internal fields)
   */
  private buildFieldsQuery(
    fields: FieldDefinition[],
    isTopLevel: boolean = true
  ): string {
    const { includeInternalFields } = this.options;
    const fieldNames = fields.map((f) => {
      if (f.type === 'object' && f.objectFields && f.objectFields.length > 0) {
        // Pass false to indicate nested objects shouldn't get internal fields
        return `${f.name} { ${this.buildFieldsQuery(f.objectFields, false)} }`;
      }
      return f.name;
    });

    // Add internal fields only at top level
    if (isTopLevel && includeInternalFields) {
      fieldNames.push('internal { id type owner }');
    }

    return fieldNames.join(' ');
  }

  /**
   * Get TypeScript parameter type for a field type.
   */
  private getParamType(fieldType: string): string {
    switch (fieldType) {
      case 'string':
        return 'string';
      case 'number':
        return 'number';
      case 'boolean':
        return 'boolean';
      default:
        return 'string';
    }
  }

  /**
   * Get GraphQL type for a field type.
   */
  private getGraphQLType(fieldType: string): string {
    switch (fieldType) {
      case 'string':
        return 'String';
      case 'number':
        return 'Float';
      case 'boolean':
        return 'Boolean';
      default:
        return 'String';
    }
  }

  /**
   * Simple pluralization (handles common cases).
   */
  private pluralize(word: string): string {
    if (word.endsWith('y')) {
      return word.slice(0, -1) + 'ies';
    }
    if (
      word.endsWith('s') ||
      word.endsWith('x') ||
      word.endsWith('ch') ||
      word.endsWith('sh')
    ) {
      return word + 'es';
    }
    return word + 's';
  }

  /**
   * Generate file header comment.
   */
  private generateHeader(): string {
    return `/**
 * Auto-generated fetch helpers
 * Generated by @udl/codegen
 * DO NOT EDIT MANUALLY
 */
`;
  }

  /**
   * Generate the endpoint constant.
   */
  private generateEndpointConstant(): string {
    return `const GRAPHQL_ENDPOINT = '${this.options.endpoint}';`;
  }

  /**
   * Generate the internal graphqlFetch helper function.
   */
  private generateFetchHelper(): string {
    const { indent, customFetchFn } = this.options;
    const fetchFn = customFetchFn || 'fetch';
    const lines: string[] = [];

    lines.push(`/**`);
    lines.push(` * Internal helper to execute GraphQL queries.`);
    lines.push(` */`);
    lines.push(`async function graphqlFetch<T>(`);
    lines.push(`${indent}query: string,`);
    lines.push(`${indent}variables?: Record<string, unknown>`);
    lines.push(`): Promise<T> {`);
    lines.push(
      `${indent}const response = await ${fetchFn}(GRAPHQL_ENDPOINT, {`
    );
    lines.push(`${indent}${indent}method: 'POST',`);
    lines.push(
      `${indent}${indent}headers: { 'Content-Type': 'application/json' },`
    );
    lines.push(`${indent}${indent}body: JSON.stringify({ query, variables }),`);
    lines.push(`${indent}});`);
    lines.push('');
    lines.push(`${indent}if (!response.ok) {`);
    lines.push(
      `${indent}${indent}throw new Error(\`GraphQL request failed: \${response.statusText}\`);`
    );
    lines.push(`${indent}}`);
    lines.push('');
    lines.push(
      `${indent}const result = await response.json() as { data?: T; errors?: Array<{ message: string }> };`
    );
    lines.push('');
    lines.push(`${indent}if (result.errors && result.errors.length > 0) {`);
    lines.push(
      `${indent}${indent}throw new Error(\`GraphQL error: \${result.errors[0]?.message}\`);`
    );
    lines.push(`${indent}}`);
    lines.push('');
    lines.push(`${indent}if (!result.data) {`);
    lines.push(
      `${indent}${indent}throw new Error('No data returned from GraphQL query');`
    );
    lines.push(`${indent}}`);
    lines.push('');
    lines.push(`${indent}return result.data;`);
    lines.push('}');

    return lines.join('\n');
  }
}

/**
 * Generate fetch helper code from content type definitions.
 *
 * Convenience function that creates a generator and calls generate().
 *
 * @param schemas - Array of content type definitions
 * @param options - Generator options
 * @returns Generated TypeScript code
 */
export function generateFetchHelpers(
  schemas: ContentTypeDefinition[],
  options: FetchHelperGeneratorOptions = {}
): string {
  const generator = new FetchHelperGenerator(options);
  return generator.generate(schemas);
}
