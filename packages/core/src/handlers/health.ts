import type { IncomingMessage, ServerResponse } from 'node:http';
import { isReady, getReadinessChecks } from './readiness.js';
import { isShuttingDown } from '@/shutdown.js';

export interface HealthResponse {
  status: 'ok';
  timestamp: string;
}

export interface ReadinessResponse {
  status: 'ready' | 'initializing' | 'shutting_down';
  timestamp: string;
  checks: {
    graphql: boolean;
    nodeStore: boolean;
  };
  shuttingDown?: boolean;
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
 * Returns 503 if server is still initializing or shutting down.
 */
export function readyHandler(req: IncomingMessage, res: ServerResponse): void {
  if (req.method !== 'GET') {
    res.writeHead(405, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Method not allowed' }));
    return;
  }

  const shuttingDown = isShuttingDown();
  const ready = isReady();
  const checks = getReadinessChecks();

  let status: ReadinessResponse['status'];
  if (shuttingDown) {
    status = 'shutting_down';
  } else if (ready) {
    status = 'ready';
  } else {
    status = 'initializing';
  }

  const response: ReadinessResponse = {
    status,
    timestamp: new Date().toISOString(),
    checks,
    ...(shuttingDown && { shuttingDown: true }),
  };

  const statusCode = ready ? 200 : 503;
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(response));
}
