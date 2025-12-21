/**
 * Query Document Generator
 *
 * Generates TypedDocumentNode exports from .graphql query files.
 * Provides precise result and variable types based on the actual query shape.
 */

import {
  type DocumentNode,
  type GraphQLSchema,
  type GraphQLObjectType,
  type GraphQLOutputType,
  type GraphQLField,
  type OperationDefinitionNode,
  type SelectionSetNode,
  type VariableDefinitionNode,
  type TypeNode,
  Kind,
  parse,
  isObjectType,
  isListType,
  isNonNullType,
  isScalarType,
  isEnumType,
  isUnionType,
  isInterfaceType,
} from 'graphql';
import { readFile, readdir, stat } from 'node:fs/promises';
import { join, basename } from 'node:path';

/**
 * A discovered query from a .graphql file
 */
export interface DiscoveredQuery {
  /** Operation name (e.g., GetProduct) */
  name: string;
  /** Operation type */
  operation: 'query' | 'mutation' | 'subscription';
  /** Parsed document AST */
  document: DocumentNode;
  /** Source file path */
  sourcePath: string;
}

/**
 * Options for the QueryDocumentGenerator
 */
export interface QueryDocumentGeneratorOptions {
  /** Whether to include JSDoc comments */
  includeJsDoc?: boolean;
  /** Indentation string */
  indent?: string;
}

const DEFAULT_OPTIONS: Required<QueryDocumentGeneratorOptions> = {
  includeJsDoc: true,
  indent: '  ',
};

/**
 * Generator for TypedDocumentNode exports from .graphql files.
 *
 * Scans directories for .graphql files, parses the queries, and generates
 * TypeScript code with precise result and variable types.
 *
 * @example
 * ```ts
 * const generator = new QueryDocumentGenerator(schema);
 * const queries = await generator.discoverQueries(['src/queries']);
 * const code = generator.generate(queries);
 * ```
 */
export class QueryDocumentGenerator {
  private schema: GraphQLSchema;
  private options: Required<QueryDocumentGeneratorOptions>;

  constructor(
    schema: GraphQLSchema,
    options: QueryDocumentGeneratorOptions = {}
  ) {
    this.schema = schema;
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Discover query definitions from .graphql files in the given directories
   */
  async discoverQueries(directories: string[]): Promise<DiscoveredQuery[]> {
    const queries: DiscoveredQuery[] = [];

    for (const dir of directories) {
      const graphqlFiles = await this.findGraphQLFiles(dir);

      for (const filePath of graphqlFiles) {
        try {
          const content = await readFile(filePath, 'utf-8');
          const document = parse(content);

          // Extract operation definitions from the document
          for (const definition of document.definitions) {
            if (definition.kind === 'OperationDefinition') {
              const opDef = definition as OperationDefinitionNode;
              const name = opDef.name?.value;

              if (!name) {
                console.warn(`Skipping anonymous operation in ${filePath}`);
                continue;
              }

              // Create a new document containing only this operation
              // This ensures each TypedDocumentNode contains only its own operation
              const singleOperationDocument: DocumentNode = {
                kind: Kind.DOCUMENT,
                definitions: [opDef],
              };

              queries.push({
                name,
                operation: opDef.operation,
                document: singleOperationDocument,
                sourcePath: filePath,
              });
            }
          }
        } catch (error) {
          console.warn(`Failed to parse ${filePath}:`, error);
        }
      }
    }

    return queries;
  }

  /**
   * Recursively find all .graphql files in a directory
   */
  private async findGraphQLFiles(dir: string): Promise<string[]> {
    const files: string[] = [];

    try {
      const entries = await readdir(dir);

      for (const entry of entries) {
        const fullPath = join(dir, entry);
        const stats = await stat(fullPath);

        if (stats.isDirectory()) {
          // Skip node_modules and hidden directories
          if (!entry.startsWith('.') && entry !== 'node_modules') {
            const subFiles = await this.findGraphQLFiles(fullPath);
            files.push(...subFiles);
          }
        } else if (entry.endsWith('.graphql') || entry.endsWith('.gql')) {
          files.push(fullPath);
        }
      }
    } catch {
      // Directory doesn't exist or can't be read
    }

    return files;
  }

  /**
   * Generate TypeScript code for all discovered queries
   */
  generate(queries: DiscoveredQuery[]): string {
    if (queries.length === 0) {
      return this.generateEmptyFile();
    }

    const lines: string[] = [];

    // File header
    lines.push(this.generateHeader());

    // Imports - use codegen package to avoid pnpm phantom dependency issues
    lines.push(
      "import type { TypedDocumentNode } from '@universal-data-layer/codegen-typed-queries';"
    );
    lines.push('');

    // Generate each query
    for (const query of queries) {
      lines.push(this.generateQueryExports(query));
      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * Generate exports for a single query
   */
  private generateQueryExports(query: DiscoveredQuery): string {
    const { includeJsDoc } = this.options;
    const lines: string[] = [];

    // Find the operation definition
    const opDef = query.document.definitions.find(
      (def): def is OperationDefinitionNode =>
        def.kind === 'OperationDefinition' && def.name?.value === query.name
    );

    if (!opDef) {
      console.warn(`Could not find operation ${query.name}`);
      return '';
    }

    // Generate Variables interface if needed
    const hasVariables =
      opDef.variableDefinitions && opDef.variableDefinitions.length > 0;
    if (hasVariables) {
      lines.push(
        this.generateVariablesInterface(query.name, opDef.variableDefinitions!)
      );
      lines.push('');
    }

    // Generate Result interface
    lines.push(this.generateResultInterface(query.name, opDef));
    lines.push('');

    // Generate the TypedDocumentNode constant
    if (includeJsDoc) {
      lines.push(
        `/** ${query.operation} ${query.name} from ${basename(query.sourcePath)} */`
      );
    }

    const variablesType = hasVariables
      ? `${query.name}Variables`
      : 'Record<string, never>';
    lines.push(
      `export const ${query.name}: TypedDocumentNode<${query.name}Result, ${variablesType}> = ${this.serializeDocument(query.document)} as TypedDocumentNode<${query.name}Result, ${variablesType}>;`
    );

    return lines.join('\n');
  }

  /**
   * Generate a Variables interface from variable definitions
   */
  private generateVariablesInterface(
    queryName: string,
    variables: readonly VariableDefinitionNode[]
  ): string {
    const { indent } = this.options;
    const lines: string[] = [];

    lines.push(`export interface ${queryName}Variables {`);

    for (const varDef of variables) {
      const varName = varDef.variable.name.value;
      const isRequired = varDef.type.kind === 'NonNullType';
      const tsType = this.typeNodeToTypeScript(varDef.type);

      const optional = isRequired ? '' : '?';
      lines.push(`${indent}${varName}${optional}: ${tsType};`);
    }

    lines.push('}');

    return lines.join('\n');
  }

  /**
   * Generate a Result interface from the operation's selection set
   */
  private generateResultInterface(
    queryName: string,
    opDef: OperationDefinitionNode
  ): string {
    const { indent } = this.options;
    const lines: string[] = [];

    // Get the root type for this operation
    const rootType = this.getRootType(opDef.operation);
    if (!rootType) {
      lines.push(`export type ${queryName}Result = unknown;`);
      return lines.join('\n');
    }

    // Build the result type from the selection set
    const resultType = this.buildSelectionSetType(
      opDef.selectionSet,
      rootType,
      indent
    );

    lines.push(`export interface ${queryName}Result ${resultType}`);

    return lines.join('\n');
  }

  /**
   * Get the root type for an operation type
   */
  private getRootType(
    operation: 'query' | 'mutation' | 'subscription'
  ): GraphQLObjectType | null {
    switch (operation) {
      case 'query':
        return this.schema.getQueryType() ?? null;
      case 'mutation':
        return this.schema.getMutationType() ?? null;
      case 'subscription':
        return this.schema.getSubscriptionType() ?? null;
    }
  }

  /**
   * Build TypeScript type string from a selection set
   */
  private buildSelectionSetType(
    selectionSet: SelectionSetNode,
    parentType: GraphQLObjectType,
    baseIndent: string
  ): string {
    const { indent } = this.options;
    const fields: string[] = [];

    for (const selection of selectionSet.selections) {
      if (selection.kind === 'Field') {
        const fieldName = selection.name.value;
        const alias = selection.alias?.value;
        const outputName = alias || fieldName;

        // Skip __typename - it's added automatically
        if (fieldName === '__typename') continue;

        // Get field definition from parent type
        const fieldDef = parentType.getFields()[fieldName];
        if (!fieldDef) {
          console.warn(
            `Field ${fieldName} not found on type ${parentType.name}`
          );
          fields.push(`${baseIndent}${indent}${outputName}: unknown;`);
          continue;
        }

        // Build the field type
        const fieldType = this.buildFieldType(
          selection,
          fieldDef,
          baseIndent + indent
        );
        fields.push(`${baseIndent}${indent}${outputName}: ${fieldType};`);
      } else if (selection.kind === 'InlineFragment') {
        // Handle inline fragments for unions/interfaces
        const typeName = selection.typeCondition?.name.value;
        if (typeName && selection.selectionSet) {
          const fragmentType = this.schema.getType(typeName);
          if (fragmentType && isObjectType(fragmentType)) {
            // For inline fragments, we merge the fields into the parent
            const fragmentFields = this.buildSelectionSetType(
              selection.selectionSet,
              fragmentType,
              baseIndent
            );
            // Extract fields from the inline fragment's type
            const extractedFields = fragmentFields
              .replace(/^\{/, '')
              .replace(/\}$/, '')
              .trim();
            if (extractedFields) {
              fields.push(extractedFields);
            }
          }
        }
      }
    }

    if (fields.length === 0) {
      return '{}';
    }

    return `{\n${fields.join('\n')}\n${baseIndent}}`;
  }

  /**
   * Build TypeScript type for a single field
   */
  private buildFieldType(
    selection: { selectionSet?: SelectionSetNode },
    fieldDef: GraphQLField<unknown, unknown>,
    baseIndent: string
  ): string {
    const fieldType = fieldDef.type;
    return this.graphqlTypeToTypeScript(
      fieldType,
      selection.selectionSet,
      baseIndent
    );
  }

  /**
   * Convert a GraphQL output type to TypeScript type string
   */
  private graphqlTypeToTypeScript(
    type: GraphQLOutputType,
    selectionSet: SelectionSetNode | undefined,
    baseIndent: string
  ): string {
    // Handle NonNull wrapper
    if (isNonNullType(type)) {
      return this.graphqlTypeToTypeScript(
        type.ofType,
        selectionSet,
        baseIndent
      );
    }

    // Handle List wrapper
    if (isListType(type)) {
      const innerType = this.graphqlTypeToTypeScript(
        type.ofType,
        selectionSet,
        baseIndent
      );
      // Use Array<T> for complex types, T[] for simple
      if (innerType.includes('{') || innerType.includes('|')) {
        return `Array<${innerType}>`;
      }
      return `${innerType}[]`;
    }

    // Handle scalar types
    if (isScalarType(type)) {
      return this.scalarToTypeScript(type.name);
    }

    // Handle enum types
    if (isEnumType(type)) {
      const values = type
        .getValues()
        .map((v) => `'${v.name}'`)
        .join(' | ');
      return values || 'string';
    }

    // Handle object types
    if (isObjectType(type)) {
      if (selectionSet) {
        return this.buildSelectionSetType(selectionSet, type, baseIndent);
      }
      return 'unknown';
    }

    // Handle union types
    if (isUnionType(type)) {
      if (!selectionSet) {
        return 'unknown';
      }

      // For unions, we need to combine inline fragments
      // The selection set should contain inline fragments for each possible type
      const unionTypes: string[] = [];

      for (const selection of selectionSet.selections) {
        if (selection.kind === 'InlineFragment' && selection.typeCondition) {
          const typeName = selection.typeCondition.name.value;
          const fragmentType = this.schema.getType(typeName);

          if (
            fragmentType &&
            isObjectType(fragmentType) &&
            selection.selectionSet
          ) {
            const typeShape = this.buildSelectionSetType(
              selection.selectionSet,
              fragmentType,
              baseIndent
            );
            unionTypes.push(`(${typeShape} & { __typename: '${typeName}' })`);
          }
        }
      }

      if (unionTypes.length === 0) {
        return 'unknown';
      }

      return unionTypes.join(' | ');
    }

    // Handle interface types similarly to unions
    if (isInterfaceType(type)) {
      if (!selectionSet) {
        return 'unknown';
      }

      const interfaceTypes: string[] = [];

      for (const selection of selectionSet.selections) {
        if (selection.kind === 'InlineFragment' && selection.typeCondition) {
          const typeName = selection.typeCondition.name.value;
          const fragmentType = this.schema.getType(typeName);

          if (
            fragmentType &&
            isObjectType(fragmentType) &&
            selection.selectionSet
          ) {
            const typeShape = this.buildSelectionSetType(
              selection.selectionSet,
              fragmentType,
              baseIndent
            );
            interfaceTypes.push(
              `(${typeShape} & { __typename: '${typeName}' })`
            );
          }
        }
      }

      if (interfaceTypes.length === 0) {
        return 'unknown';
      }

      return interfaceTypes.join(' | ');
    }

    return 'unknown';
  }

  /**
   * Convert a GraphQL type AST node to TypeScript type string (for variables)
   */
  private typeNodeToTypeScript(typeNode: TypeNode): string {
    switch (typeNode.kind) {
      case 'NonNullType':
        return this.typeNodeToTypeScript(typeNode.type);
      case 'ListType':
        return `${this.typeNodeToTypeScript(typeNode.type)}[]`;
      case 'NamedType':
        return this.namedTypeToTypeScript(typeNode.name.value);
      default:
        return 'unknown';
    }
  }

  /**
   * Convert a named type to TypeScript
   */
  private namedTypeToTypeScript(typeName: string): string {
    // Check if it's a scalar
    const type = this.schema.getType(typeName);
    if (type && isScalarType(type)) {
      return this.scalarToTypeScript(typeName);
    }

    // For input object types and enums
    if (type && isEnumType(type)) {
      const values = type
        .getValues()
        .map((v) => `'${v.name}'`)
        .join(' | ');
      return values || 'string';
    }

    // For input object types, just use the name (they should be defined elsewhere)
    return typeName;
  }

  /**
   * Convert GraphQL scalar to TypeScript type
   */
  private scalarToTypeScript(scalarName: string): string {
    switch (scalarName) {
      case 'String':
      case 'ID':
        return 'string';
      case 'Int':
      case 'Float':
        return 'number';
      case 'Boolean':
        return 'boolean';
      default:
        // Custom scalars default to unknown
        return 'unknown';
    }
  }

  /**
   * Serialize a DocumentNode to a JavaScript expression
   *
   * Removes `loc` properties to avoid TypeScript errors since the JSON
   * serialized `loc` doesn't match the graphql-js Location class.
   */
  private serializeDocument(document: DocumentNode): string {
    // Remove loc properties - they cause TypeScript issues and aren't needed at runtime
    const withoutLoc = JSON.stringify(document, (key, value) => {
      if (key === 'loc') {
        return undefined;
      }
      return value;
    });
    return withoutLoc;
  }

  /**
   * Generate header comment
   */
  private generateHeader(): string {
    return `/**
 * Auto-generated TypedDocumentNode queries
 * Generated by @universal-data-layer/codegen-typed-queries
 * DO NOT EDIT MANUALLY
 */

`;
  }

  /**
   * Generate empty file content
   */
  private generateEmptyFile(): string {
    return `${this.generateHeader()}// No .graphql files found
export {};
`;
  }
}

/**
 * Generate TypedDocumentNode code from .graphql files
 *
 * Convenience function that creates a generator and runs the full pipeline.
 */
export async function generateQueryDocuments(
  schema: GraphQLSchema,
  directories: string[],
  options: QueryDocumentGeneratorOptions = {}
): Promise<string> {
  const generator = new QueryDocumentGenerator(schema, options);
  const queries = await generator.discoverQueries(directories);
  return generator.generate(queries);
}
