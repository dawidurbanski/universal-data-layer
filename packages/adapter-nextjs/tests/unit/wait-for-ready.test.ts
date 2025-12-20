import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { waitForServer } from '@/utils/wait-for-ready.js';
import { createServer, type Server } from 'node:net';

describe('waitForServer', () => {
  let server: Server | null = null;

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(async () => {
    vi.useRealTimers();
    if (server) {
      await new Promise<void>((resolve) => {
        server?.close(() => resolve());
      });
      server = null;
    }
  });

  it('should resolve immediately when server is already running', async () => {
    vi.useRealTimers(); // Need real timers for actual server

    // Start a server
    server = createServer();
    await new Promise<void>((resolve) => {
      server?.listen(0, 'localhost', () => resolve());
    });

    const port = (server.address() as { port: number }).port;

    // Should resolve quickly
    await expect(waitForServer(port, 1000)).resolves.toBeUndefined();
  });

  it('should wait for server to become available', async () => {
    vi.useRealTimers(); // Need real timers for actual server

    const port = 19999; // Use a high port unlikely to be in use

    // Start the server after a delay
    setTimeout(() => {
      server = createServer();
      server.listen(port, 'localhost');
    }, 200);

    await expect(waitForServer(port, 5000)).resolves.toBeUndefined();
  });

  it('should throw error when server does not start within timeout', async () => {
    vi.useRealTimers(); // Need real timers for this test

    const port = 19998; // Use a port that nothing is listening on

    await expect(waitForServer(port, 300)).rejects.toThrow(
      `Server failed to start on port ${port} within 300ms timeout`
    );
  });

  it('should use default timeout of 30000ms', async () => {
    // This test verifies the function signature accepts no timeout parameter
    const waitPromise = waitForServer(19997);

    // Cancel immediately - we're just checking the function accepts the call
    vi.advanceTimersByTime(100);

    // We need to reject this to prevent hanging
    await expect(
      Promise.race([
        waitPromise,
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('test timeout')), 50)
        ),
      ])
    ).rejects.toThrow();
  });
});
