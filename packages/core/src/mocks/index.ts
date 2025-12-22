import type { SetupServerApi } from 'msw/node';
import type { RequestHandler } from 'msw';

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

// Load remote-todo handlers for the manual test feature
// Uses string concatenation to prevent TypeScript from resolving at compile time
async function loadRemoteTodoHandlers(): Promise<RequestHandler[]> {
  try {
    // Only load in development mode for manual testing
    if (process.env['NODE_ENV'] !== 'development') return [];

    const modulePath =
      '../../tests/manual/features/remote-udl-webhooks/mocks/' +
      'remote-todos.js';
    const mod = await import(/* webpackIgnore: true */ modulePath);
    return mod.remoteTodoHandlers || [];
  } catch {
    // Feature not available or handlers not found
    return [];
  }
}

/**
 * Check if real Contentful credentials are provided
 */
function hasContentfulCredentials(): boolean {
  const spaceId = process.env['CONTENTFUL_SPACE_ID'];
  const accessToken = process.env['CONTENTFUL_ACCESS_TOKEN'];
  return Boolean(spaceId && accessToken);
}

/**
 * Determine if mocks should be used based on priority:
 * 1. Real credentials provided → NO mocks
 * 2. UDL_USE_MOCKS=true → use mocks
 * 3. UDL_USE_MOCKS=false → no mocks
 * 4. NODE_ENV=development → use mocks
 * 5. Otherwise → no mocks
 */
function shouldUseMocks(): { useMocks: boolean; reason: string } {
  // Priority 1: Real credentials = no mocks
  if (hasContentfulCredentials()) {
    return { useMocks: false, reason: 'Contentful credentials provided' };
  }

  // Priority 2-3: Explicit UDL_USE_MOCKS setting
  if (process.env['UDL_USE_MOCKS'] === 'true') {
    return { useMocks: true, reason: 'UDL_USE_MOCKS=true' };
  }
  if (process.env['UDL_USE_MOCKS'] === 'false') {
    return { useMocks: false, reason: 'UDL_USE_MOCKS=false' };
  }

  // Priority 4: NODE_ENV=development
  if (process.env['NODE_ENV'] === 'development') {
    return { useMocks: true, reason: 'NODE_ENV=development' };
  }

  // Priority 5: Default to no mocks
  return { useMocks: false, reason: 'production mode (default)' };
}

let mockServer: SetupServerApi | null = null;

/**
 * Dynamically load msw and jsonplaceholder handlers only when needed.
 * This prevents the "Cannot find package 'msw'" error when msw is not installed
 * (it's a devDependency, so it won't be installed in consuming projects).
 */
async function loadMswDependencies() {
  const [mswNode, jsonplaceholderModule] = await Promise.all([
    import('msw/node'),
    import('./jsonplaceholder.js'),
  ]);
  return {
    setupServer: mswNode.setupServer,
    jsonplaceholderHandlers: jsonplaceholderModule.jsonplaceholderHandlers,
  };
}

export async function startMockServer() {
  const { useMocks, reason } = shouldUseMocks();

  if (!useMocks) {
    console.log(`🔵 Using real APIs (${reason})`);
    return;
  }

  // Only try to load msw when we actually need mocks
  let setupServer: typeof import('msw/node').setupServer;
  let jsonplaceholderHandlers: RequestHandler[];

  try {
    const deps = await loadMswDependencies();
    setupServer = deps.setupServer;
    jsonplaceholderHandlers = deps.jsonplaceholderHandlers;
  } catch (error) {
    console.log(
      `🔵 MSW not available (${error instanceof Error ? error.message : 'unknown error'}). Using real APIs.`
    );
    console.log(
      '   To use mocks, install msw as a dev dependency: npm install -D msw'
    );
    return;
  }

  const contentfulHandlers = await loadContentfulHandlers();
  const remoteTodoHandlers = await loadRemoteTodoHandlers();

  mockServer = setupServer(
    ...contentfulHandlers,
    ...jsonplaceholderHandlers,
    ...remoteTodoHandlers
  );

  mockServer.listen({ onUnhandledRequest: 'bypass' });
  console.log(`🔶 MSW Mock Server started (${reason})`);
  console.log('   External API calls will be intercepted with mock responses');
}

export function stopMockServer() {
  mockServer?.close();
}
