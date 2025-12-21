import type { IncomingMessage, ServerResponse } from 'node:http';
import { isReady, getReadinessChecks } from './readiness.js';

export interface HealthResponse {
  status: 'ok';
  timestamp: string;
}

export interface ReadinessResponse {
  status: 'ready' | 'initializing';
  timestamp: string;
  checks: {
    graphql: boolean;
    nodeStore: boolean;
  };
}

/**
 * Health check handler (liveness probe).
 * Returns 200 if the server process is running.
 */
export function healthHandler(req: IncomingMessage, res: ServerResponse): void {
  if (req.method !== 'GET') {
    res.writeHead(405, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Method not allowed' }));
    return;
  }

  const response: HealthResponse = {
    status: 'ok',
    timestamp: new Date().toISOString(),
  };

  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(response));
}

/**
 * Readiness check handler (readiness probe).
 * Returns 200 if server is ready to accept traffic.
 * Returns 503 if server is still initializing.
 */
export function readyHandler(req: IncomingMessage, res: ServerResponse): void {
  if (req.method !== 'GET') {
    res.writeHead(405, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Method not allowed' }));
    return;
  }

  const ready = isReady();
  const checks = getReadinessChecks();

  const response: ReadinessResponse = {
    status: ready ? 'ready' : 'initializing',
    timestamp: new Date().toISOString(),
    checks,
  };

  const statusCode = ready ? 200 : 503;
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(response));
}
