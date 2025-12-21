import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import http, { createServer, type Server } from 'node:http';
import { healthHandler, readyHandler } from '@/handlers/health.js';
import { setReady, resetReadiness } from '@/handlers/readiness.js';

function makeRequest(
  server: Server,
  path: string,
  method: string = 'GET'
): Promise<{
  statusCode: number;
  headers: Record<string, string>;
  body: string;
}> {
  return new Promise((resolve, reject) => {
    const address = server.address();
    if (!address || typeof address === 'string') {
      reject(new Error('Server address not available'));
      return;
    }

    const req = http.request(
      {
        hostname: 'localhost',
        port: address.port,
        path,
        method,
      },
      (res: {
        statusCode: number;
        headers: Record<string, string>;
        on: (event: string, callback: (data?: Buffer) => void) => void;
      }) => {
        let body = '';
        res.on('data', (chunk: Buffer) => {
          body += chunk.toString();
        });
        res.on('end', () => {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers as Record<string, string>,
            body,
          });
        });
      }
    );
    req.on('error', reject);
    req.end();
  });
}

describe('health endpoints integration', () => {
  let server: Server;

  beforeAll(() => {
    server = createServer((req, res) => {
      // Add CORS headers
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

      if (req.url === '/health') {
        return healthHandler(req, res);
      } else if (req.url === '/ready') {
        return readyHandler(req, res);
      }

      res.writeHead(404);
      res.end('Not found');
    });

    return new Promise<void>((resolve) => {
      server.listen(0, () => resolve());
    });
  });

  afterAll(() => {
    return new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  });

  beforeEach(() => {
    resetReadiness();
  });

  describe('/health endpoint', () => {
    it('should return 200 with JSON response', async () => {
      const response = await makeRequest(server, '/health');

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toBe('application/json');

      const body = JSON.parse(response.body);
      expect(body.status).toBe('ok');
      expect(body.timestamp).toBeDefined();
    });

    it('should return valid ISO 8601 timestamp', async () => {
      const response = await makeRequest(server, '/health');
      const body = JSON.parse(response.body);

      const timestamp = new Date(body.timestamp);
      expect(timestamp.toISOString()).toBe(body.timestamp);
    });

    it('should include CORS headers', async () => {
      const response = await makeRequest(server, '/health');

      expect(response.headers['access-control-allow-origin']).toBe('*');
      expect(response.headers['access-control-allow-methods']).toBe(
        'GET, POST, OPTIONS'
      );
    });

    it('should return 405 for POST request', async () => {
      const response = await makeRequest(server, '/health', 'POST');

      expect(response.statusCode).toBe(405);
    });
  });

  describe('/ready endpoint', () => {
    it('should return 503 when not ready', async () => {
      const response = await makeRequest(server, '/ready');

      expect(response.statusCode).toBe(503);
      expect(response.headers['content-type']).toBe('application/json');

      const body = JSON.parse(response.body);
      expect(body.status).toBe('initializing');
      expect(body.checks.graphql).toBe(false);
      expect(body.checks.nodeStore).toBe(false);
    });

    it('should return 200 when all components are ready', async () => {
      setReady('graphql', true);
      setReady('nodeStore', true);

      const response = await makeRequest(server, '/ready');

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toBe('application/json');

      const body = JSON.parse(response.body);
      expect(body.status).toBe('ready');
      expect(body.checks.graphql).toBe(true);
      expect(body.checks.nodeStore).toBe(true);
    });

    it('should return 503 when only graphql is ready', async () => {
      setReady('graphql', true);

      const response = await makeRequest(server, '/ready');

      expect(response.statusCode).toBe(503);
      const body = JSON.parse(response.body);
      expect(body.status).toBe('initializing');
      expect(body.checks.graphql).toBe(true);
      expect(body.checks.nodeStore).toBe(false);
    });

    it('should return 503 when only nodeStore is ready', async () => {
      setReady('nodeStore', true);

      const response = await makeRequest(server, '/ready');

      expect(response.statusCode).toBe(503);
      const body = JSON.parse(response.body);
      expect(body.status).toBe('initializing');
      expect(body.checks.graphql).toBe(false);
      expect(body.checks.nodeStore).toBe(true);
    });

    it('should include CORS headers', async () => {
      const response = await makeRequest(server, '/ready');

      expect(response.headers['access-control-allow-origin']).toBe('*');
    });

    it('should return 405 for POST request', async () => {
      const response = await makeRequest(server, '/ready', 'POST');

      expect(response.statusCode).toBe(405);
    });

    it('should return valid ISO 8601 timestamp', async () => {
      const response = await makeRequest(server, '/ready');
      const body = JSON.parse(response.body);

      const timestamp = new Date(body.timestamp);
      expect(timestamp.toISOString()).toBe(body.timestamp);
    });
  });
});
