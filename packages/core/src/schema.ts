import { GraphQLSchema, GraphQLObjectType, GraphQLString } from 'graphql';

/**
 * Build the GraphQL schema dynamically
 * This allows the schema to be rebuilt on demand for hot reloading
 */
export function buildSchema(): GraphQLSchema {
  return new GraphQLSchema({
    query: new GraphQLObjectType({
      name: 'Query',
      fields: {
        version: {
          type: GraphQLString,
          resolve: () => '0.0.9',
        },
      },
    }),
  });
}

// Export default schema instance for backward compatibility
const schema = buildSchema();
export default schema;
