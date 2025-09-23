import type { ServerResponse } from 'node:http';
import { ruruHTML } from 'ruru/server';
import config from '../config.js';

export default function handler(res: ServerResponse) {
  const html = ruruHTML(config);
  res.writeHead(200, {
    'content-type': 'text/html',
    'content-length': html.length,
  });
  res.end(html);
}
