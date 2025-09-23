import { serveStatic } from 'ruru/static';
import config from '../config.js';
import type { IncomingMessage, ServerResponse } from 'node:http';

const staticHandler = serveStatic(config.staticPath);

export default function handler(req: IncomingMessage, res: ServerResponse) {
  return staticHandler(req, res);
}
