import { execute, parse, validate, type GraphQLSchema } from 'graphql';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { normalizeGraphQLResult } from '@/normalization/index.js';

let currentSchema: GraphQLSchema;

/**
 * Whether to normalize responses (deduplicate entities)
 * This can be made configurable in the future
 */
let normalizeResponses = true;

/**
 * Build and cache the GraphQL schema
 */
async function initSchema() {
  const { buildSchema } = await import('@/schema.js');
  currentSchema = buildSchema();
}

// Initialize on module load
await initSchema();

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
    currentSchema = buildSchema();

    console.log('✅ GraphQL schema rebuilt successfully');
  } catch (error) {
    console.error('❌ Failed to rebuild schema:', error);
    throw error;
  }
}

/**
 * Set whether to normalize responses
 */
export function setNormalizeResponses(value: boolean): void {
  normalizeResponses = value;
}

/**
 * Parse request body from IncomingMessage
 */
async function parseRequestBody(req: IncomingMessage): Promise<{
  query?: string;
  variables?: Record<string, unknown>;
  operationName?: string;
}> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error('Invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
}

/**
 * GraphQL HTTP handler with optional response normalization
 */
export default async function handler(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Only accept POST for GraphQL
  if (req.method !== 'POST') {
    res.writeHead(405, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ errors: [{ message: 'Method not allowed' }] }));
    return;
  }

  try {
    const { query, variables, operationName } = await parseRequestBody(req);

    if (!query) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ errors: [{ message: 'Missing query' }] }));
      return;
    }

    // Parse and validate the query
    let document;
    try {
      document = parse(query);
    } catch (syntaxError) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ errors: [syntaxError] }));
      return;
    }

    const validationErrors = validate(currentSchema, document);
    if (validationErrors.length > 0) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ errors: validationErrors }));
      return;
    }

    // Execute the query
    const result = await execute({
      schema: currentSchema,
      document,
      variableValues: variables,
      operationName,
    });

    // Normalize the response if enabled
    let responseBody;
    if (normalizeResponses && result.data) {
      responseBody = normalizeGraphQLResult(result);
    } else {
      responseBody = result;
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(responseBody));
  } catch (error) {
    console.error('GraphQL execution error:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        errors: [
          {
            message:
              error instanceof Error ? error.message : 'Internal server error',
          },
        ],
      })
    );
  }
}
