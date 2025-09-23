import { GraphQLSchema, GraphQLObjectType, GraphQLString } from "graphql";

const schema = new GraphQLSchema({
  query: new GraphQLObjectType({
    name: "Query",
    fields: {
      version: {
        type: GraphQLString,
        resolve: () => "0.0.1",
      },
    },
  }),
});

export default schema;