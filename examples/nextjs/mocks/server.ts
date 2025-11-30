import { setupServer } from 'msw/node';
import { handlers } from './handlers.js';

export const server = setupServer(...handlers);

/**
 * Start the mock server.
 * Call this before any Contentful API requests are made.
 */
export function startMockServer() {
  server.listen({
    onUnhandledRequest: 'bypass', // Don't fail on non-Contentful requests
  });
  console.log('🔶 MSW Mock Server started - intercepting Contentful API calls');
}

/**
 * Stop the mock server and clean up handlers.
 */
export function stopMockServer() {
  server.close();
}
