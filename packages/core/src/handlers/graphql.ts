import { createHandler } from 'graphql-http/lib/use/http';
import type { IncomingMessage, ServerResponse } from 'node:http';

let currentHandler: ReturnType<typeof createHandler>;

/**
 * Build and cache the GraphQL handler
 */
async function initHandler() {
  const { buildSchema } = await import('@/schema.js');
  currentHandler = createHandler({ schema: buildSchema() });
}

// Initialize on module load
await initHandler();

/**
 * Rebuild the GraphQL handler with a fresh schema
 * Called when file changes are detected in dev mode
 */
export async function rebuildHandler(): Promise<void> {
  console.log('🔄 Rebuilding GraphQL schema...');

  try {
    // Force reimport by adding timestamp to bypass ESM cache
    const timestamp = Date.now();
    const schemaPath = new URL('../schema.js', import.meta.url);
    const schemaUrl = `${schemaPath.href}?t=${timestamp}`;

    const { buildSchema } = await import(schemaUrl);
    currentHandler = createHandler({ schema: buildSchema() });

    console.log('✅ GraphQL schema rebuilt successfully');
  } catch (error) {
    console.error('❌ Failed to rebuild schema:', error);
    throw error;
  }
}

export default function handler(req: IncomingMessage, res: ServerResponse) {
  return currentHandler(req, res);
}
