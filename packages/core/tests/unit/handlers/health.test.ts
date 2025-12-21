import { describe, it, expect, beforeEach } from 'vitest';
import { healthHandler, readyHandler } from '@/handlers/health.js';
import { setReady, resetReadiness } from '@/handlers/readiness.js';
import { setShuttingDown, resetShutdownState } from '@/shutdown.js';
import type { IncomingMessage, ServerResponse } from 'node:http';

function createMockRequest(method: string = 'GET'): IncomingMessage {
  return {
    method,
  } as IncomingMessage;
}

function createMockResponse(): ServerResponse & {
  _statusCode: number;
  _headers: Record<string, string>;
  _body: string;
} {
  const res = {
    _statusCode: 0,
    _headers: {} as Record<string, string>,
    _body: '',
    writeHead(statusCode: number, headers?: Record<string, string>) {
      this._statusCode = statusCode;
      if (headers) {
        Object.assign(this._headers, headers);
      }
      return this;
    },
    end(body?: string) {
      if (body) {
        this._body = body;
      }
    },
  };
  return res as unknown as ServerResponse & {
    _statusCode: number;
    _headers: Record<string, string>;
    _body: string;
  };
}

describe('healthHandler', () => {
  it('should return 200 with status ok for GET request', () => {
    const req = createMockRequest('GET');
    const res = createMockResponse();

    healthHandler(req, res);

    expect(res._statusCode).toBe(200);
    expect(res._headers['Content-Type']).toBe('application/json');

    const body = JSON.parse(res._body);
    expect(body.status).toBe('ok');
    expect(body.timestamp).toBeDefined();
  });

  it('should return valid ISO 8601 timestamp', () => {
    const req = createMockRequest('GET');
    const res = createMockResponse();

    healthHandler(req, res);

    const body = JSON.parse(res._body);
    const timestamp = new Date(body.timestamp);
    expect(timestamp.toISOString()).toBe(body.timestamp);
  });

  it('should return 405 for POST request', () => {
    const req = createMockRequest('POST');
    const res = createMockResponse();

    healthHandler(req, res);

    expect(res._statusCode).toBe(405);
    const body = JSON.parse(res._body);
    expect(body.error).toBe('Method not allowed');
  });

  it('should return 405 for PUT request', () => {
    const req = createMockRequest('PUT');
    const res = createMockResponse();

    healthHandler(req, res);

    expect(res._statusCode).toBe(405);
  });

  it('should return 405 for DELETE request', () => {
    const req = createMockRequest('DELETE');
    const res = createMockResponse();

    healthHandler(req, res);

    expect(res._statusCode).toBe(405);
  });
});

describe('readyHandler', () => {
  beforeEach(() => {
    resetReadiness();
    resetShutdownState();
  });

  it('should return 503 when no components are ready', () => {
    const req = createMockRequest('GET');
    const res = createMockResponse();

    readyHandler(req, res);

    expect(res._statusCode).toBe(503);
    expect(res._headers['Content-Type']).toBe('application/json');

    const body = JSON.parse(res._body);
    expect(body.status).toBe('initializing');
    expect(body.checks.graphql).toBe(false);
    expect(body.checks.nodeStore).toBe(false);
  });

  it('should return 503 when only graphql is ready', () => {
    setReady('graphql', true);

    const req = createMockRequest('GET');
    const res = createMockResponse();

    readyHandler(req, res);

    expect(res._statusCode).toBe(503);
    const body = JSON.parse(res._body);
    expect(body.status).toBe('initializing');
    expect(body.checks.graphql).toBe(true);
    expect(body.checks.nodeStore).toBe(false);
  });

  it('should return 503 when only nodeStore is ready', () => {
    setReady('nodeStore', true);

    const req = createMockRequest('GET');
    const res = createMockResponse();

    readyHandler(req, res);

    expect(res._statusCode).toBe(503);
    const body = JSON.parse(res._body);
    expect(body.status).toBe('initializing');
    expect(body.checks.graphql).toBe(false);
    expect(body.checks.nodeStore).toBe(true);
  });

  it('should return 200 when all components are ready', () => {
    setReady('graphql', true);
    setReady('nodeStore', true);

    const req = createMockRequest('GET');
    const res = createMockResponse();

    readyHandler(req, res);

    expect(res._statusCode).toBe(200);
    expect(res._headers['Content-Type']).toBe('application/json');

    const body = JSON.parse(res._body);
    expect(body.status).toBe('ready');
    expect(body.checks.graphql).toBe(true);
    expect(body.checks.nodeStore).toBe(true);
  });

  it('should return valid ISO 8601 timestamp', () => {
    const req = createMockRequest('GET');
    const res = createMockResponse();

    readyHandler(req, res);

    const body = JSON.parse(res._body);
    const timestamp = new Date(body.timestamp);
    expect(timestamp.toISOString()).toBe(body.timestamp);
  });

  it('should return 405 for POST request', () => {
    const req = createMockRequest('POST');
    const res = createMockResponse();

    readyHandler(req, res);

    expect(res._statusCode).toBe(405);
    const body = JSON.parse(res._body);
    expect(body.error).toBe('Method not allowed');
  });

  it('should return 405 for PUT request', () => {
    const req = createMockRequest('PUT');
    const res = createMockResponse();

    readyHandler(req, res);

    expect(res._statusCode).toBe(405);
  });

  it('should return 405 for DELETE request', () => {
    const req = createMockRequest('DELETE');
    const res = createMockResponse();

    readyHandler(req, res);

    expect(res._statusCode).toBe(405);
  });

  describe('shutdown state', () => {
    it('should return 503 when shutting down', () => {
      setReady('graphql', true);
      setReady('nodeStore', true);

      const req = createMockRequest('GET');
      const res = createMockResponse();

      // First verify it's ready
      readyHandler(req, res);
      expect(res._statusCode).toBe(200);

      // Now trigger shutdown
      setShuttingDown(true);
      const res2 = createMockResponse();
      readyHandler(req, res2);

      expect(res2._statusCode).toBe(503);
    });

    it('should include shuttingDown: true in response when shutting down', () => {
      setReady('graphql', true);
      setReady('nodeStore', true);
      setShuttingDown(true);

      const req = createMockRequest('GET');
      const res = createMockResponse();

      readyHandler(req, res);

      const body = JSON.parse(res._body);
      expect(body.shuttingDown).toBe(true);
    });

    it('should return status shutting_down when shutting down', () => {
      setReady('graphql', true);
      setReady('nodeStore', true);
      setShuttingDown(true);

      const req = createMockRequest('GET');
      const res = createMockResponse();

      readyHandler(req, res);

      const body = JSON.parse(res._body);
      expect(body.status).toBe('shutting_down');
    });

    it('should not include shuttingDown field when not shutting down', () => {
      setReady('graphql', true);
      setReady('nodeStore', true);

      const req = createMockRequest('GET');
      const res = createMockResponse();

      readyHandler(req, res);

      const body = JSON.parse(res._body);
      expect(body.shuttingDown).toBeUndefined();
    });

    it('should still include checks during shutdown', () => {
      setReady('graphql', true);
      setReady('nodeStore', true);
      setShuttingDown(true);

      const req = createMockRequest('GET');
      const res = createMockResponse();

      readyHandler(req, res);

      const body = JSON.parse(res._body);
      expect(body.checks.graphql).toBe(true);
      expect(body.checks.nodeStore).toBe(true);
    });
  });
});
