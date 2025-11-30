import {
  GraphQLSchema,
  GraphQLObjectType,
  GraphQLString,
  GraphQLList,
  GraphQLInt,
  GraphQLFloat,
  GraphQLBoolean,
  GraphQLNonNull,
  GraphQLInputObjectType,
  GraphQLUnionType,
  type GraphQLFieldConfigMap,
  type GraphQLInputFieldConfigMap,
  GraphQLScalarType,
  type GraphQLOutputType,
} from 'graphql';
import pluralize from 'pluralize';
import { defaultStore } from '@/nodes/defaultStore.js';
import type { Node } from '@/nodes/types.js';

/**
 * Interface for Contentful-style reference objects
 */
interface ContentfulReference {
  _contentfulRef: true;
  contentfulId: string;
  linkType: 'Entry' | 'Asset';
  possibleTypes?: string[];
}

/**
 * Check if a value is a Contentful reference
 */
function isContentfulReference(value: unknown): value is ContentfulReference {
  return (
    typeof value === 'object' &&
    value !== null &&
    '_contentfulRef' in value &&
    (value as ContentfulReference)._contentfulRef === true
  );
}

/**
 * Cache for union types to avoid recreating them
 */
const unionTypeCache = new Map<string, GraphQLUnionType>();

/**
 * Maximum depth for reference resolution to prevent infinite loops
 */
const MAX_REFERENCE_DEPTH = 5;

/**
 * Filter input types for scalar comparisons
 */
const StringFilterInput = new GraphQLInputObjectType({
  name: 'StringFilterInput',
  fields: {
    eq: { type: GraphQLString },
    ne: { type: GraphQLString },
    in: { type: new GraphQLList(GraphQLString) },
    contains: { type: GraphQLString },
    startsWith: { type: GraphQLString },
    endsWith: { type: GraphQLString },
  },
});

const IntFilterInput = new GraphQLInputObjectType({
  name: 'IntFilterInput',
  fields: {
    eq: { type: GraphQLInt },
    ne: { type: GraphQLInt },
    gt: { type: GraphQLInt },
    gte: { type: GraphQLInt },
    lt: { type: GraphQLInt },
    lte: { type: GraphQLInt },
    in: { type: new GraphQLList(GraphQLInt) },
  },
});

const FloatFilterInput = new GraphQLInputObjectType({
  name: 'FloatFilterInput',
  fields: {
    eq: { type: GraphQLFloat },
    ne: { type: GraphQLFloat },
    gt: { type: GraphQLFloat },
    gte: { type: GraphQLFloat },
    lt: { type: GraphQLFloat },
    lte: { type: GraphQLFloat },
    in: { type: new GraphQLList(GraphQLFloat) },
  },
});

const BooleanFilterInput = new GraphQLInputObjectType({
  name: 'BooleanFilterInput',
  fields: {
    eq: { type: GraphQLBoolean },
    ne: { type: GraphQLBoolean },
  },
});

/**
 * Get the appropriate filter input type for a GraphQL scalar type
 */
function getFilterInputType(
  graphqlType: GraphQLScalarType
): GraphQLInputObjectType | null {
  if (graphqlType === GraphQLString) return StringFilterInput;
  if (graphqlType === GraphQLInt) return IntFilterInput;
  if (graphqlType === GraphQLFloat) return FloatFilterInput;
  if (graphqlType === GraphQLBoolean) return BooleanFilterInput;
  return null;
}

/**
 * Apply a filter to a single node field value
 */
function matchesFilter(
  value: unknown,
  filter: Record<string, unknown>
): boolean {
  for (const [operator, filterValue] of Object.entries(filter)) {
    if (filterValue === undefined || filterValue === null) continue;

    switch (operator) {
      case 'eq':
        if (value !== filterValue) return false;
        break;
      case 'ne':
        if (value === filterValue) return false;
        break;
      case 'gt':
        if (typeof value !== 'number' || value <= (filterValue as number))
          return false;
        break;
      case 'gte':
        if (typeof value !== 'number' || value < (filterValue as number))
          return false;
        break;
      case 'lt':
        if (typeof value !== 'number' || value >= (filterValue as number))
          return false;
        break;
      case 'lte':
        if (typeof value !== 'number' || value > (filterValue as number))
          return false;
        break;
      case 'in':
        if (!Array.isArray(filterValue) || !filterValue.includes(value))
          return false;
        break;
      case 'contains':
        if (typeof value !== 'string' || !value.includes(filterValue as string))
          return false;
        break;
      case 'startsWith':
        if (
          typeof value !== 'string' ||
          !value.startsWith(filterValue as string)
        )
          return false;
        break;
      case 'endsWith':
        if (typeof value !== 'string' || !value.endsWith(filterValue as string))
          return false;
        break;
    }
  }
  return true;
}

/**
 * Filter nodes based on a filter object
 */
function filterNodes(
  nodes: Node[],
  filter: Record<string, Record<string, unknown>> | undefined | null
): Node[] {
  if (!filter) return nodes;

  return nodes.filter((node) => {
    for (const [fieldName, fieldFilter] of Object.entries(filter)) {
      if (!fieldFilter) continue;
      const value = node[fieldName as keyof Node];
      if (!matchesFilter(value, fieldFilter)) {
        return false;
      }
    }
    return true;
  });
}

/**
 * Cache for GraphQL types to avoid recreating them
 */
const typeCache = new Map<string, GraphQLObjectType>();
const filterInputCache = new Map<string, GraphQLInputObjectType>();
const nestedTypeCache = new Map<string, GraphQLObjectType>();

/**
 * Resolve a reference to its actual node.
 * Used by reference field resolvers.
 */
function resolveReference(
  ref: ContentfulReference,
  context: { resolutionDepth?: number }
): Node | null {
  const depth = context.resolutionDepth ?? 0;
  if (depth >= MAX_REFERENCE_DEPTH) {
    return null;
  }

  // Try each possible type to find the node
  if (ref.possibleTypes && ref.possibleTypes.length > 0) {
    for (const typeName of ref.possibleTypes) {
      const node = defaultStore.getByField(
        typeName,
        'contentfulId',
        ref.contentfulId
      );
      if (node) {
        return node;
      }
    }
  }

  // Fallback: search all types if no possibleTypes specified
  // This is less efficient but ensures backward compatibility
  const allTypes = defaultStore.getTypes();
  for (const typeName of allTypes) {
    const node = defaultStore.getByField(
      typeName,
      'contentfulId',
      ref.contentfulId
    );
    if (node) {
      return node;
    }
  }

  return null;
}

/**
 * Create or get a union type for reference fields.
 * The union includes all possible types the reference can resolve to.
 */
function getOrCreateUnionType(
  unionName: string,
  possibleTypeNames: string[],
  getNodeType: (typeName: string) => GraphQLObjectType | null
): GraphQLUnionType | null {
  if (unionTypeCache.has(unionName)) {
    return unionTypeCache.get(unionName)!;
  }

  // Get the actual GraphQL types for each possible type name
  const types: GraphQLObjectType[] = [];
  for (const typeName of possibleTypeNames) {
    const nodeType = getNodeType(typeName);
    if (nodeType) {
      types.push(nodeType);
    }
  }

  // Need at least one type for a valid union
  if (types.length === 0) {
    return null;
  }

  // If only one type, we could return it directly, but union is cleaner for consistency
  const unionType = new GraphQLUnionType({
    name: unionName,
    types,
    resolveType: (obj: Node) => {
      // Return the type name from the node's internal.type
      return obj.internal.type;
    },
  });

  unionTypeCache.set(unionName, unionType);
  return unionType;
}

/**
 * Generate a unique type name for a nested object based on its structure
 */
function generateNestedTypeName(
  parentTypeName: string,
  fieldName: string
): string {
  // Convert to PascalCase and create a unique name
  const pascalFieldName =
    fieldName.charAt(0).toUpperCase() + fieldName.slice(1);
  return `${parentTypeName}${pascalFieldName}`;
}

/**
 * Create a GraphQL object type for a nested object value
 * Returns null if the object is empty (GraphQL requires at least one field)
 */
function createNestedObjectType(
  typeName: string,
  sampleValue: Record<string, unknown>
): GraphQLObjectType | null {
  // Check cache first
  if (nestedTypeCache.has(typeName)) {
    return nestedTypeCache.get(typeName)!;
  }

  // Build fields from the sample object
  const fields: GraphQLFieldConfigMap<Record<string, unknown>, unknown> = {};

  for (const [key, value] of Object.entries(sampleValue)) {
    // Skip fields starting with __ (reserved by GraphQL)
    if (key.startsWith('__')) {
      continue;
    }
    const fieldType = inferGraphQLType(value, typeName, key);
    // Skip fields that couldn't be typed (e.g., empty nested objects)
    if (fieldType === null) {
      continue;
    }
    fields[key] = {
      type: fieldType,
      resolve: (source) => source[key],
    };
  }

  // GraphQL requires at least one field - return null if empty
  if (Object.keys(fields).length === 0) {
    return null;
  }

  const objectType = new GraphQLObjectType({
    name: typeName,
    fields,
  });

  nestedTypeCache.set(typeName, objectType);
  return objectType;
}

/**
 * Check if a value is an array of references
 */
function isReferenceArray(value: unknown): value is ContentfulReference[] {
  return (
    Array.isArray(value) && value.length > 0 && isContentfulReference(value[0])
  );
}

/**
 * Information about a reference field for deferred type resolution
 */
interface ReferenceFieldInfo {
  fieldName: string;
  isArray: boolean;
  possibleTypes: string[];
  sampleRef: ContentfulReference;
}

/**
 * Infer GraphQL type from a JavaScript value
 * Now supports nested objects by creating proper GraphQL object types
 * Returns null if the type cannot be represented in GraphQL (e.g., empty objects)
 * Note: References are handled separately by createNodeType for deferred type resolution
 */
function inferGraphQLType(
  value: unknown,
  parentTypeName?: string,
  fieldName?: string
): GraphQLOutputType | null {
  if (value === null || value === undefined) {
    return GraphQLString;
  }

  if (typeof value === 'string') {
    return GraphQLString;
  }

  if (typeof value === 'number') {
    return Number.isInteger(value) ? GraphQLInt : GraphQLFloat;
  }

  if (typeof value === 'boolean') {
    return GraphQLBoolean;
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return new GraphQLList(GraphQLString);
    }
    // Skip reference arrays - they're handled separately
    if (isContentfulReference(value[0])) {
      return null;
    }
    const itemType = inferGraphQLType(
      value[0],
      parentTypeName,
      fieldName ? `${fieldName}Item` : undefined
    );
    // If array items can't be typed, fall back to string
    if (itemType === null) {
      return new GraphQLList(GraphQLString);
    }
    return new GraphQLList(itemType);
  }

  // For objects, check if it's a reference first
  if (typeof value === 'object') {
    // Skip references - they're handled separately
    if (isContentfulReference(value)) {
      return null;
    }

    const nestedTypeName =
      parentTypeName && fieldName
        ? generateNestedTypeName(parentTypeName, fieldName)
        : `NestedObject${nestedTypeCache.size}`;

    // createNestedObjectType returns null for empty objects
    return createNestedObjectType(
      nestedTypeName,
      value as Record<string, unknown>
    );
  }

  // Fallback for unknown types
  return GraphQLString;
}

/**
 * Collect field samples from nodes for type inference
 */
function collectFieldSamples(nodes: Node[]): Map<string, unknown> {
  const fieldSamples = new Map<string, unknown>();

  for (const node of nodes) {
    for (const [key, value] of Object.entries(node)) {
      if (key !== 'internal' && !fieldSamples.has(key)) {
        fieldSamples.set(key, value);
      }
    }
  }

  return fieldSamples;
}

/**
 * Collect reference field information from field samples
 */
function collectReferenceFields(
  fieldSamples: Map<string, unknown>
): ReferenceFieldInfo[] {
  const refs: ReferenceFieldInfo[] = [];

  for (const [fieldName, value] of fieldSamples) {
    if (isContentfulReference(value)) {
      refs.push({
        fieldName,
        isArray: false,
        possibleTypes: value.possibleTypes ?? [],
        sampleRef: value,
      });
    } else if (isReferenceArray(value)) {
      const firstRef = value[0];
      if (firstRef) {
        refs.push({
          fieldName,
          isArray: true,
          possibleTypes: firstRef.possibleTypes ?? [],
          sampleRef: firstRef,
        });
      }
    }
  }

  return refs;
}

/**
 * Create GraphQL object type from node samples.
 * Uses thunks for fields to support circular references between types.
 */
function createNodeType(
  typeName: string,
  fieldSamples: Map<string, unknown>,
  getNodeType: (typeName: string) => GraphQLObjectType | null
): GraphQLObjectType {
  // Check cache first
  if (typeCache.has(typeName)) {
    return typeCache.get(typeName)!;
  }

  // Internal metadata type
  const InternalType = new GraphQLObjectType({
    name: `${typeName}Internal`,
    fields: {
      id: { type: new GraphQLNonNull(GraphQLString) },
      type: { type: new GraphQLNonNull(GraphQLString) },
      owner: { type: new GraphQLNonNull(GraphQLString) },
      contentDigest: { type: GraphQLString },
    },
  });

  // Collect reference fields for deferred processing
  const referenceFields = collectReferenceFields(fieldSamples);

  // Use a thunk to allow circular type references
  const nodeType = new GraphQLObjectType({
    name: typeName,
    fields: () => {
      const fields: GraphQLFieldConfigMap<
        Record<string, unknown>,
        unknown
      > = {};

      // Add internal field
      fields['internal'] = {
        type: new GraphQLNonNull(InternalType),
        resolve: (source) => source['internal'],
      };

      // Add regular fields
      for (const [fieldName, sampleValue] of fieldSamples) {
        // Skip reference fields - handled separately below
        if (
          isContentfulReference(sampleValue) ||
          isReferenceArray(sampleValue)
        ) {
          continue;
        }

        const fieldType = inferGraphQLType(sampleValue, typeName, fieldName);

        // Skip fields that can't be typed (e.g., empty objects)
        if (fieldType === null) {
          continue;
        }

        fields[fieldName] = {
          type: fieldType,
          resolve: (source) => source[fieldName],
        };
      }

      // Add reference fields with union types and resolvers
      for (const refInfo of referenceFields) {
        const { fieldName, isArray, possibleTypes } = refInfo;

        // Create union type for this reference field
        const unionName = `${typeName}${fieldName.charAt(0).toUpperCase() + fieldName.slice(1)}Union`;
        const unionType = getOrCreateUnionType(
          unionName,
          possibleTypes,
          getNodeType
        );

        if (!unionType) {
          // If no union type could be created (no valid types), skip this field
          continue;
        }

        if (isArray) {
          // Array of references
          fields[fieldName] = {
            type: new GraphQLList(unionType),
            resolve: (
              source: Record<string, unknown>,
              _args: unknown,
              context: unknown
            ) => {
              const refs = source[fieldName];
              if (!Array.isArray(refs)) return null;

              // Extract resolution depth from context if available
              const ctx = (context ?? {}) as { resolutionDepth?: number };
              const childContext = {
                resolutionDepth: (ctx.resolutionDepth ?? 0) + 1,
              };

              return refs
                .filter(isContentfulReference)
                .map((ref) => resolveReference(ref, childContext))
                .filter((node): node is Node => node !== null);
            },
          };
        } else {
          // Single reference
          fields[fieldName] = {
            type: unionType,
            resolve: (
              source: Record<string, unknown>,
              _args: unknown,
              context: unknown
            ) => {
              const ref = source[fieldName];
              if (!isContentfulReference(ref)) return null;

              // Extract resolution depth from context if available
              const ctx = (context ?? {}) as { resolutionDepth?: number };
              const childContext = {
                resolutionDepth: (ctx.resolutionDepth ?? 0) + 1,
              };

              return resolveReference(ref, childContext);
            },
          };
        }
      }

      return fields;
    },
  });

  typeCache.set(typeName, nodeType);
  return nodeType;
}

/**
 * Create a filter input type for a node type based on its fields
 */
function createFilterInputType(
  typeName: string,
  fieldSamples: Map<string, unknown>
): GraphQLInputObjectType | null {
  // Check cache first
  const cacheKey = `${typeName}FilterInput`;
  if (filterInputCache.has(cacheKey)) {
    return filterInputCache.get(cacheKey)!;
  }

  const filterFields: GraphQLInputFieldConfigMap = {};

  for (const [fieldName, sampleValue] of fieldSamples) {
    // Skip internal field - we don't filter on it directly
    if (fieldName === 'internal') continue;

    // Only add scalar types that have filter inputs (not arrays or complex objects)
    if (
      typeof sampleValue === 'string' ||
      typeof sampleValue === 'number' ||
      typeof sampleValue === 'boolean'
    ) {
      const graphqlType = inferGraphQLType(sampleValue);
      if (graphqlType instanceof GraphQLScalarType) {
        const filterInputType = getFilterInputType(graphqlType);
        if (filterInputType) {
          filterFields[fieldName] = { type: filterInputType };
        }
      }
    }
  }

  // If no filterable fields, return null
  if (Object.keys(filterFields).length === 0) {
    return null;
  }

  const filterInputType = new GraphQLInputObjectType({
    name: cacheKey,
    fields: filterFields,
  });

  filterInputCache.set(cacheKey, filterInputType);
  return filterInputType;
}

/**
 * Build the GraphQL schema dynamically from the node store
 * This allows the schema to be rebuilt on demand for hot reloading
 */
export function buildSchema(): GraphQLSchema {
  // Clear type caches to allow for schema updates
  typeCache.clear();
  filterInputCache.clear();
  nestedTypeCache.clear();
  unionTypeCache.clear();

  // Get all node types from the store
  const nodeTypes = defaultStore.getTypes();

  // Pre-collect field samples for all types to enable getNodeType lookup
  const allFieldSamples = new Map<string, Map<string, unknown>>();
  for (const typeName of nodeTypes) {
    const nodes = defaultStore.getByType(typeName);
    if (nodes.length > 0) {
      allFieldSamples.set(typeName, collectFieldSamples(nodes));
    }
  }

  // Helper function to get or create a node type by name
  // This is used by reference fields to resolve their target types
  const getNodeType = (typeName: string): GraphQLObjectType | null => {
    // Check cache first
    if (typeCache.has(typeName)) {
      return typeCache.get(typeName)!;
    }

    // Try to create the type if we have field samples for it
    const fieldSamples = allFieldSamples.get(typeName);
    if (fieldSamples) {
      return createNodeType(typeName, fieldSamples, getNodeType);
    }

    return null;
  };

  // Build query fields
  const queryFields: GraphQLFieldConfigMap<unknown, unknown> = {
    version: {
      type: GraphQLString,
      resolve: () => '0.0.9',
    },
  };

  // Add a query field for each node type
  for (const typeName of nodeTypes) {
    const fieldSamples = allFieldSamples.get(typeName);
    if (!fieldSamples) continue;

    // Create the node type using the getNodeType helper
    const nodeType = createNodeType(typeName, fieldSamples, getNodeType);

    // Create filter input type for this node type
    const filterInputType = createFilterInputType(typeName, fieldSamples);

    // Add allX field (e.g., allProducts) with optional filter argument
    // Pluralize the type name for collection queries
    const pluralizedTypeName = pluralize(typeName);
    queryFields[`all${pluralizedTypeName}`] = {
      type: new GraphQLList(nodeType),
      args: filterInputType ? { filter: { type: filterInputType } } : {},
      resolve: (
        _: unknown,
        args: { filter?: Record<string, Record<string, unknown>> }
      ) => {
        const allNodes = defaultStore.getByType(typeName);
        return filterNodes(allNodes, args.filter);
      },
    };

    // Add single node query by ID and any registered indexed fields (e.g., product)
    const singularName = typeName.charAt(0).toLowerCase() + typeName.slice(1);

    // Get registered indexes for this node type
    const registeredIndexes = defaultStore.getRegisteredIndexes(typeName);

    // Build args dynamically based on registered indexes
    const queryArgs: Record<string, { type: GraphQLScalarType }> = {};

    // Always include internal.id as an arg (using 'id' for convenience)
    queryArgs['id'] = { type: GraphQLString };

    // Add each registered index as an optional arg
    for (const fieldName of registeredIndexes) {
      queryArgs[fieldName] = { type: GraphQLString };
    }

    queryFields[singularName] = {
      type: nodeType,
      args: queryArgs,
      resolve: (_, args: Record<string, unknown>) => {
        // Prioritize id lookup (O(1) via primary index)
        if (args['id'] && typeof args['id'] === 'string') {
          return defaultStore.get(args['id']);
        }

        // Try each indexed field (O(1) via field indexes)
        for (const fieldName of registeredIndexes) {
          const fieldValue = args[fieldName];
          if (fieldValue !== undefined && fieldValue !== null) {
            const node = defaultStore.getByField(
              typeName,
              fieldName,
              fieldValue
            );
            if (node) return node;
          }
        }

        return null;
      },
    };
  }

  return new GraphQLSchema({
    query: new GraphQLObjectType({
      name: 'Query',
      fields: queryFields,
    }),
  });
}

// Export default schema instance for backward compatibility
const schema = buildSchema();
export default schema;
