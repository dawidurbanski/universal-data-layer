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
  type GraphQLFieldConfigMap,
  type GraphQLInputFieldConfigMap,
  GraphQLScalarType,
} from 'graphql';
import { defaultStore } from '@/nodes/defaultStore.js';
import type { Node } from '@/nodes/types.js';

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

type InferredGraphQLType = GraphQLScalarType | GraphQLList<InferredGraphQLType>;

/**
 * Infer GraphQL type from a JavaScript value
 */
function inferGraphQLType(value: unknown): InferredGraphQLType {
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
    const itemType = inferGraphQLType(value[0]);
    return new GraphQLList(itemType);
  }

  // For objects, return String as fallback (will be JSON stringified)
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
 * Create GraphQL object type from node samples
 */
function createNodeType(
  typeName: string,
  fieldSamples: Map<string, unknown>
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

  // Collect all field names from all nodes of this type
  const fieldSet = new Set<string>();
  fieldSet.add('internal');
  for (const key of fieldSamples.keys()) {
    fieldSet.add(key);
  }

  // Build GraphQL fields
  const fields: GraphQLFieldConfigMap<Record<string, unknown>, unknown> = {};

  for (const fieldName of fieldSet) {
    if (fieldName === 'internal') {
      fields[fieldName] = {
        type: new GraphQLNonNull(InternalType),
        resolve: (source) => source['internal'],
      };
    } else {
      const sampleValue = fieldSamples.get(fieldName);
      const fieldType = inferGraphQLType(sampleValue);

      fields[fieldName] = {
        type: fieldType,
        resolve: (source) => {
          const value = source[fieldName];
          // Handle objects by stringifying them
          if (
            value !== null &&
            typeof value === 'object' &&
            !Array.isArray(value)
          ) {
            return JSON.stringify(value);
          }
          return value;
        },
      };
    }
  }

  const nodeType = new GraphQLObjectType({
    name: typeName,
    fields,
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

    const graphqlType = inferGraphQLType(sampleValue);

    // Only add scalar types that have filter inputs (not arrays or complex objects)
    if (graphqlType instanceof GraphQLScalarType) {
      const filterInputType = getFilterInputType(graphqlType);
      if (filterInputType) {
        filterFields[fieldName] = { type: filterInputType };
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

  // Get all node types from the store
  const nodeTypes = defaultStore.getTypes();

  // Build query fields
  const queryFields: GraphQLFieldConfigMap<unknown, unknown> = {
    version: {
      type: GraphQLString,
      resolve: () => '0.0.9',
    },
  };

  // Add a query field for each node type
  for (const typeName of nodeTypes) {
    const nodes = defaultStore.getByType(typeName);
    if (nodes.length === 0) continue;

    // Collect field samples for type inference and filter creation
    const fieldSamples = collectFieldSamples(nodes);
    const nodeType = createNodeType(typeName, fieldSamples);

    // Create filter input type for this node type
    const filterInputType = createFilterInputType(typeName, fieldSamples);

    // Add allX field (e.g., allProduct) with optional filter argument
    queryFields[`all${typeName}`] = {
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
