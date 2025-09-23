import { createHandler } from 'graphql-http/lib/use/http';
import schema from '../schema.js';
import type { IncomingMessage, ServerResponse } from 'node:http';

const graphqlHandler = createHandler({ schema });

export default function handler(req: IncomingMessage, res: ServerResponse) {
  return graphqlHandler(req, res);
}
