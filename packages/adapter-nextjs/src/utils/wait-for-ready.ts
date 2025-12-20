import { createConnection } from 'node:net';

const DEFAULT_TIMEOUT = 30000;
const POLL_INTERVAL = 100;

/**
 * Waits for a server to be ready by checking if the port is accessible.
 * @param port - The port to check
 * @param timeout - Timeout in milliseconds (default: 30000)
 * @throws Error if the server doesn't become ready within the timeout
 */
export async function waitForServer(
  port: number,
  timeout: number = DEFAULT_TIMEOUT
): Promise<void> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    const isReady = await checkPort(port);
    if (isReady) {
      return;
    }
    await sleep(POLL_INTERVAL);
  }

  throw new Error(
    `Server failed to start on port ${port} within ${timeout}ms timeout`
  );
}

/**
 * Checks if a port is accessible by attempting to connect.
 */
function checkPort(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = createConnection({ port, host: 'localhost' });

    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });

    socket.once('error', () => {
      socket.destroy();
      resolve(false);
    });
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
