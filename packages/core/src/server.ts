import { createServer } from 'node:http';
import staticHandler from './handlers/static.js';
import graphqlHandler from './handlers/graphql.js';
import graphiqlHandler from './handlers/graphiql.js';

const server = createServer((req, res) => {
  if (req.url === '/graphql') {
    return graphqlHandler(req, res);
  } else if (req.url === '/graphiql') {
    return graphiqlHandler(res);
  }

  return staticHandler(req, res);
});

export default server;
