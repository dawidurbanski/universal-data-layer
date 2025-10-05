import { createServer } from 'node:http';
import staticHandler from './handlers/static.js';
import graphqlHandler from './handlers/graphql.js';
import graphiqlHandler from './handlers/graphiql.js';

const server = createServer((req, res) => {
  // Add CORS headers for all requests
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.url === '/graphql') {
    return graphqlHandler(req, res);
  } else if (req.url === '/graphiql') {
    return graphiqlHandler(res);
  }

  return staticHandler(req, res);
});

export default server;
