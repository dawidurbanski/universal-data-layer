import {
  GraphQLSchema,
  GraphQLObjectType,
  GraphQLString,
  GraphQLList,
  GraphQLInt,
  GraphQLFloat,
  GraphQLBoolean,
  GraphQLNonNull,
  type GraphQLFieldConfigMap,
  GraphQLScalarType,
} from 'graphql';
import { defaultStore } from '@/nodes/defaultStore.js';
import type { Node } from '@/nodes/types.js';

/**
 * Cache for GraphQL types to avoid recreating them
 */
const typeCache = new Map<string, GraphQLObjectType>();

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
 * Create GraphQL object type from node samples
 */
function createNodeType(typeName: string, nodes: Node[]): GraphQLObjectType {
  // Check cache first
  if (typeCache.has(typeName)) {
    return typeCache.get(typeName)!;
  }

  // Internal metadata type
  const InternalType = new GraphQLObjectType({
    name: `${typeName}Internal`,
    fields: {
      type: { type: new GraphQLNonNull(GraphQLString) },
      owner: { type: new GraphQLNonNull(GraphQLString) },
      contentDigest: { type: GraphQLString },
    },
  });

  // Collect all field names from all nodes of this type
  const fieldSet = new Set<string>();
  const fieldSamples = new Map<string, unknown>();

  for (const node of nodes) {
    // Add standard fields
    fieldSet.add('id');
    fieldSet.add('internal');

    // Add all custom fields
    for (const [key, value] of Object.entries(node)) {
      if (key !== 'id' && key !== 'internal') {
        fieldSet.add(key);
        // Keep a sample value for type inference
        if (!fieldSamples.has(key)) {
          fieldSamples.set(key, value);
        }
      }
    }
  }

  // Build GraphQL fields
  const fields: GraphQLFieldConfigMap<Record<string, unknown>, unknown> = {};

  for (const fieldName of fieldSet) {
    if (fieldName === 'id') {
      fields[fieldName] = {
        type: new GraphQLNonNull(GraphQLString),
        resolve: (source) => source['id'],
      };
    } else if (fieldName === 'internal') {
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
 * Build the GraphQL schema dynamically from the node store
 * This allows the schema to be rebuilt on demand for hot reloading
 */
export function buildSchema(): GraphQLSchema {
  // Clear type cache to allow for schema updates
  typeCache.clear();

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

    const nodeType = createNodeType(typeName, nodes);

    // Add allX field (e.g., allProduct)
    queryFields[`all${typeName}`] = {
      type: new GraphQLList(nodeType),
      resolve: () => defaultStore.getByType(typeName),
    };

    // Add single node query by ID (e.g., product)
    const singularName = typeName.charAt(0).toLowerCase() + typeName.slice(1);
    queryFields[singularName] = {
      type: nodeType,
      args: {
        id: { type: new GraphQLNonNull(GraphQLString) },
      },
      resolve: (_, { id }) => defaultStore.get(id),
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
