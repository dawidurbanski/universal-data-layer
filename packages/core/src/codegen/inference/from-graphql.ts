/**
 * Schema inference from GraphQL introspection
 *
 * Introspects a GraphQL endpoint to extract type definitions
 * and converts them to ContentTypeDefinition format.
 */

import type {
  ContentTypeDefinition,
  FieldDefinition,
  FieldType,
} from '@/codegen/types/schema.js';

/**
 * Standard GraphQL introspection query
 */
const INTROSPECTION_QUERY = `
  query IntrospectionQuery {
    __schema {
      types {
        kind
        name
        description
        fields(includeDeprecated: false) {
          name
          description
          type {
            kind
            name
            ofType {
              kind
              name
              ofType {
                kind
                name
                ofType {
                  kind
                  name
                  ofType {
                    kind
                    name
                  }
                }
              }
            }
          }
        }
      }
    }
  }
`;

/**
 * GraphQL type kinds from introspection
 */
type GraphQLTypeKind =
  | 'SCALAR'
  | 'OBJECT'
  | 'INTERFACE'
  | 'UNION'
  | 'ENUM'
  | 'INPUT_OBJECT'
  | 'LIST'
  | 'NON_NULL';

/**
 * GraphQL type reference from introspection
 */
interface GraphQLTypeRef {
  kind: GraphQLTypeKind;
  name: string | null;
  ofType: GraphQLTypeRef | null;
}

/**
 * GraphQL field from introspection
 */
interface GraphQLField {
  name: string;
  description: string | null;
  type: GraphQLTypeRef;
}

/**
 * GraphQL type from introspection
 */
interface GraphQLType {
  kind: GraphQLTypeKind;
  name: string;
  description: string | null;
  fields: GraphQLField[] | null;
}

/**
 * GraphQL introspection result
 */
interface IntrospectionResult {
  data: {
    __schema: {
      types: GraphQLType[];
    };
  };
}

/**
 * Built-in GraphQL types to exclude from generated schemas
 */
const BUILT_IN_TYPES = new Set([
  // Introspection types
  '__Schema',
  '__Type',
  '__TypeKind',
  '__Field',
  '__InputValue',
  '__EnumValue',
  '__Directive',
  '__DirectiveLocation',
  // Root types (typically)
  'Query',
  'Mutation',
  'Subscription',
  // Built-in scalars
  'String',
  'Int',
  'Float',
  'Boolean',
  'ID',
]);

/**
 * Default scalar type mappings from GraphQL to TypeScript
 */
const DEFAULT_SCALAR_MAP: Record<string, FieldType> = {
  String: 'string',
  Int: 'number',
  Float: 'number',
  Boolean: 'boolean',
  ID: 'string',
};

/**
 * Cache for introspection results
 */
const introspectionCache = new Map<
  string,
  {
    result: ContentTypeDefinition[];
    timestamp: number;
  }
>();

/**
 * Default cache TTL in milliseconds (5 minutes)
 */
const DEFAULT_CACHE_TTL = 5 * 60 * 1000;

/**
 * Options for GraphQL introspection
 */
export interface IntrospectOptions {
  /**
   * HTTP headers to include in the introspection request.
   * Useful for authentication.
   */
  headers?: Record<string, string>;

  /**
   * Custom scalar type mappings.
   * Maps GraphQL scalar names to FieldType values.
   * @example { DateTime: 'string', JSON: 'unknown' }
   */
  customScalars?: Record<string, FieldType>;

  /**
   * Additional type names to exclude from the schema.
   * Built-in types are always excluded.
   */
  excludeTypes?: string[];

  /**
   * Whether to use cached results if available.
   * @default true
   */
  useCache?: boolean;

  /**
   * Cache TTL in milliseconds.
   * @default 300000 (5 minutes)
   */
  cacheTtl?: number;

  /**
   * Request timeout in milliseconds.
   * @default 30000 (30 seconds)
   */
  timeout?: number;
}

/**
 * Unwrap a GraphQL type reference to get the base type and modifiers
 */
function unwrapType(typeRef: GraphQLTypeRef): {
  baseName: string | null;
  isNonNull: boolean;
  isList: boolean;
  listItemNonNull: boolean;
} {
  let current = typeRef;
  let isNonNull = false;
  let isList = false;
  let listItemNonNull = false;

  // Unwrap NON_NULL and LIST modifiers
  while (current.ofType) {
    if (current.kind === 'NON_NULL') {
      if (!isList) {
        isNonNull = true;
      } else {
        listItemNonNull = true;
      }
    } else if (current.kind === 'LIST') {
      isList = true;
    }
    current = current.ofType;
  }

  return {
    baseName: current.name,
    isNonNull,
    isList,
    listItemNonNull,
  };
}

/**
 * Convert a GraphQL type reference to a FieldDefinition
 */
function typeRefToFieldDefinition(
  name: string,
  typeRef: GraphQLTypeRef,
  description: string | null,
  scalarMap: Record<string, FieldType>,
  allTypeNames: Set<string>
): FieldDefinition {
  const { baseName, isNonNull, isList } = unwrapType(typeRef);

  const field: FieldDefinition = {
    name,
    type: 'unknown',
    required: isNonNull,
    ...(description && { description }),
  };

  if (!baseName) {
    return field;
  }

  // Handle list types
  if (isList) {
    field.type = 'array';
    field.arrayItemType = {
      name: 'item',
      type: resolveBaseType(baseName, scalarMap, allTypeNames),
      required: true, // Simplified - could check listItemNonNull
    };

    // If the item is an object type, mark it as a reference
    if (field.arrayItemType.type === 'reference') {
      field.arrayItemType.referenceType = baseName;
    }

    return field;
  }

  // Handle scalar and object types
  field.type = resolveBaseType(baseName, scalarMap, allTypeNames);

  // If it's a reference to another type, record the type name
  if (field.type === 'reference') {
    field.referenceType = baseName;
  }

  return field;
}

/**
 * Resolve a base type name to a FieldType
 */
function resolveBaseType(
  typeName: string,
  scalarMap: Record<string, FieldType>,
  allTypeNames: Set<string>
): FieldType {
  // Check if it's a known scalar
  if (scalarMap[typeName]) {
    return scalarMap[typeName];
  }

  // Check if it's a reference to another object type
  if (allTypeNames.has(typeName)) {
    return 'reference';
  }

  // Unknown type - treat as unknown
  return 'unknown';
}

/**
 * Convert a GraphQL type to a ContentTypeDefinition
 */
function graphqlTypeToContentType(
  graphqlType: GraphQLType,
  scalarMap: Record<string, FieldType>,
  allTypeNames: Set<string>
): ContentTypeDefinition {
  const fields: FieldDefinition[] = [];

  if (graphqlType.fields) {
    for (const field of graphqlType.fields) {
      fields.push(
        typeRefToFieldDefinition(
          field.name,
          field.type,
          field.description,
          scalarMap,
          allTypeNames
        )
      );
    }
  }

  return {
    name: graphqlType.name,
    fields,
    ...(graphqlType.description && { description: graphqlType.description }),
  };
}

/**
 * Parse introspection result into ContentTypeDefinition array
 */
export function parseIntrospectionResult(
  result: IntrospectionResult,
  options: Pick<IntrospectOptions, 'customScalars' | 'excludeTypes'> = {}
): ContentTypeDefinition[] {
  const { customScalars = {}, excludeTypes = [] } = options;

  const scalarMap = { ...DEFAULT_SCALAR_MAP, ...customScalars };
  const excludeSet = new Set([...BUILT_IN_TYPES, ...excludeTypes]);

  const types = result.data.__schema.types;

  // Filter to only OBJECT types that aren't built-in
  const objectTypes = types.filter(
    (t) => t.kind === 'OBJECT' && !excludeSet.has(t.name)
  );

  // Collect all type names for reference detection
  const allTypeNames = new Set(objectTypes.map((t) => t.name));

  // Convert each type
  return objectTypes.map((type) =>
    graphqlTypeToContentType(type, scalarMap, allTypeNames)
  );
}

/**
 * Introspect a GraphQL endpoint and return content type definitions.
 *
 * @param endpoint - The GraphQL endpoint URL
 * @param options - Introspection options
 * @returns Array of ContentTypeDefinition for all object types
 *
 * @example
 * ```ts
 * // Basic usage
 * const schemas = await introspectGraphQLSchema('http://localhost:4000/graphql');
 *
 * // With authentication
 * const schemas = await introspectGraphQLSchema('https://api.example.com/graphql', {
 *   headers: { Authorization: 'Bearer token123' },
 * });
 *
 * // With custom scalar mappings
 * const schemas = await introspectGraphQLSchema(endpoint, {
 *   customScalars: { DateTime: 'string', JSON: 'unknown' },
 * });
 * ```
 */
export async function introspectGraphQLSchema(
  endpoint: string,
  options: IntrospectOptions = {}
): Promise<ContentTypeDefinition[]> {
  const {
    headers = {},
    customScalars = {},
    excludeTypes = [],
    useCache = true,
    cacheTtl = DEFAULT_CACHE_TTL,
    timeout = 30000,
  } = options;

  // Check cache
  if (useCache) {
    const cached = introspectionCache.get(endpoint);
    if (cached && Date.now() - cached.timestamp < cacheTtl) {
      return cached.result;
    }
  }

  // Create abort controller for timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      body: JSON.stringify({ query: INTROSPECTION_QUERY }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(
        `GraphQL introspection failed: ${response.status} ${response.statusText}`
      );
    }

    const result = (await response.json()) as IntrospectionResult;

    if (!result.data?.__schema?.types) {
      throw new Error('Invalid introspection response: missing __schema.types');
    }

    const contentTypes = parseIntrospectionResult(result, {
      customScalars,
      excludeTypes,
    });

    // Cache the result
    if (useCache) {
      introspectionCache.set(endpoint, {
        result: contentTypes,
        timestamp: Date.now(),
      });
    }

    return contentTypes;
  } catch (error) {
    clearTimeout(timeoutId);

    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`GraphQL introspection timed out after ${timeout}ms`);
    }

    throw error;
  }
}

/**
 * Clear the introspection cache for a specific endpoint or all endpoints
 */
export function clearIntrospectionCache(endpoint?: string): void {
  if (endpoint) {
    introspectionCache.delete(endpoint);
  } else {
    introspectionCache.clear();
  }
}
