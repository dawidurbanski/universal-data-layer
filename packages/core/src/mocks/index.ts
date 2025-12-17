import { setupServer, SetupServerApi } from 'msw/node';
import type { RequestHandler } from 'msw';
import { jsonplaceholderHandlers } from './jsonplaceholder.js';

// Dynamic import to avoid bundling issues when plugin not installed
// Using string concatenation to prevent TypeScript from trying to resolve at compile time
async function loadContentfulHandlers(): Promise<RequestHandler[]> {
  try {
    const moduleName =
      '@universal-data-layer/plugin-source-contentful' + '/mocks';
    const mod = await import(/* webpackIgnore: true */ moduleName);
    return mod.contentfulHandlers || [];
  } catch {
    // Plugin not installed or mocks not available
    return [];
  }
}

let mockServer: SetupServerApi | null = null;

export async function startMockServer() {
  if (process.env['USE_REAL_API'] === 'true') {
    console.log('🔵 Using real APIs (USE_REAL_API=true)');
    return;
  }

  const contentfulHandlers = await loadContentfulHandlers();

  mockServer = setupServer(...contentfulHandlers, ...jsonplaceholderHandlers);

  mockServer.listen({ onUnhandledRequest: 'bypass' });
  console.log(
    '🔶 MSW Mock Server started - external API calls will be intercepted'
  );
}

export function stopMockServer() {
  mockServer?.close();
}
