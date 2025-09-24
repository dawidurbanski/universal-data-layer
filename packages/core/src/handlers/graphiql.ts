import type { ServerResponse } from 'node:http';
import { ruruHTML } from 'ruru/server';
import { getConfig } from '../config.js';

export default function handler(res: ServerResponse) {
  const config = getConfig();
  const html = ruruHTML({ endpoint: config.endpoint });
  res.writeHead(200, {
    'content-type': 'text/html',
    'content-length': html.length,
  });
  res.end(html);
}
