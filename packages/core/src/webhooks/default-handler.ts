/**
 * Default Webhook Handler
 *
 * Provides a standardized webhook handler for CRUD operations on nodes.
 * Auto-registered for plugins when `defaultWebhook` config is enabled.
 */

import type { IncomingMessage, ServerResponse } from 'node:http';
import type { WebhookHandlerContext, DefaultWebhookPayload } from './types.js';
import type { Node } from '@/nodes/types.js';
import { createNodeId } from '@/nodes/utils/index.js';

/**
 * Default path for webhook endpoints when not specified.
 */
export const DEFAULT_WEBHOOK_PATH = 'sync';

/**
 * Options for creating a default webhook handler.
 */
export interface DefaultWebhookHandlerOptions {
  /**
   * The plugin's unique identifier field for nodes.
   * When specified, the `nodeId` in webhook payloads is matched against this field
   * instead of the internal node ID.
   *
   * This should match the plugin's `idField` config.
   *
   * @example 'externalId' - Match nodeId against the externalId field
   */
  idField?: string;
}

/**
 * Validate the webhook payload structure.
 */
function validatePayload(body: unknown): body is DefaultWebhookPayload {
  if (!body || typeof body !== 'object') return false;
  const payload = body as Record<string, unknown>;

  const operation = payload['operation'];
  if (!['create', 'update', 'delete', 'upsert'].includes(operation as string)) {
    return false;
  }

  const nodeId = payload['nodeId'];
  if (typeof nodeId !== 'string' || !nodeId) {
    return false;
  }

  const nodeType = payload['nodeType'];
  if (typeof nodeType !== 'string' || !nodeType) {
    return false;
  }

  // data is required for create/update/upsert, optional for delete
  if (operation !== 'delete') {
    const data = payload['data'];
    if (!data || typeof data !== 'object') {
      return false;
    }
  }

  return true;
}

/**
 * Create the default webhook handler for a plugin.
 *
 * The handler accepts standardized payloads with CRUD operations:
 * - `create`: Create a new node (returns 409 if exists)
 * - `update`: Update an existing node (returns 404 if doesn't exist)
 * - `delete`: Delete a node (returns 404 if doesn't exist)
 * - `upsert`: Create or update a node (always succeeds)
 *
 * @param pluginName - The name of the plugin (used as node owner)
 * @param options - Handler configuration options
 * @returns The webhook handler function
 *
 * @example
 * ```typescript
 * // Payload format:
 * {
 *   "operation": "upsert",
 *   "nodeId": "product-123",
 *   "nodeType": "Product",
 *   "data": { "title": "New Product", "price": 99.99 }
 * }
 *
 * // With idField: 'externalId', nodeId matches against externalId field:
 * {
 *   "operation": "update",
 *   "nodeId": "123",  // Matches nodes where externalId = 123
 *   "nodeType": "Product",
 *   "data": { "title": "Updated Product" }
 * }
 * ```
 */
export function createDefaultWebhookHandler(
  pluginName: string,
  options: DefaultWebhookHandlerOptions = {}
) {
  const { idField } = options;

  /**
   * Find an existing node by nodeId.
   * If idField is set, searches by that field; otherwise by internal ID.
   * Tries both string and numeric lookups since JSON always sends strings but
   * the stored value might be a number.
   */
  function findExistingNode(
    context: WebhookHandlerContext,
    nodeType: string,
    nodeId: string
  ): Node | undefined {
    const { store, actions } = context;

    if (idField) {
      // Ensure the index is registered for this field
      store.registerIndex(nodeType, idField);

      // Try index lookup first (O(1) if indexed)
      // Try string lookup
      let node = store.getByField(nodeType, idField, nodeId) as
        | Node
        | undefined;
      if (node) return node;

      // Try numeric lookup if nodeId looks like a number
      const numericId = Number(nodeId);
      if (!isNaN(numericId)) {
        node = store.getByField(nodeType, idField, numericId) as
          | Node
          | undefined;
        if (node) return node;
      }

      // Fallback: linear scan for nodes created before index was registered
      // This handles the case where nodes exist but weren't indexed
      const allNodes = store.getByType(nodeType);
      for (const n of allNodes) {
        const fieldValue = (n as unknown as Record<string, unknown>)[idField];
        // Compare with both string and numeric versions
        if (fieldValue === nodeId || fieldValue === numericId) {
          return n;
        }
      }

      return undefined;
    }

    // Default: look up by internal ID
    return actions.getNode(nodeId);
  }

  /**
   * Get the internal node ID to use for create/update operations.
   * If an existing node is found, uses its ID; otherwise generates a new one.
   */
  function getInternalNodeId(
    existing: Node | undefined,
    nodeType: string,
    nodeId: string
  ): string {
    if (existing) {
      return existing.internal.id;
    }

    // Generate a consistent internal ID using the same pattern as plugins
    if (idField) {
      return createNodeId(nodeType, String(nodeId));
    }

    // When not using idField, nodeId is already the internal ID
    return nodeId;
  }

  return async function defaultWebhookHandler(
    _req: IncomingMessage,
    res: ServerResponse,
    context: WebhookHandlerContext
  ): Promise<void> {
    const { body, actions } = context;

    // Validate payload
    if (!validatePayload(body)) {
      console.warn(
        `⚠️ Default webhook handler [${pluginName}]: Invalid payload received`,
        JSON.stringify(body, null, 2)
      );
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          error: 'Invalid payload',
          expected: {
            operation: 'create | update | delete | upsert',
            nodeId: 'string',
            nodeType: 'string',
            data: 'object (required for create/update/upsert)',
          },
        })
      );
      return;
    }

    const { operation, nodeId, nodeType, data } = body;
    const lookupInfo = idField ? ` (idField: ${idField}=${nodeId})` : '';

    const nodeData = data;

    try {
      switch (operation) {
        case 'create': {
          // Check if node already exists
          const existing = findExistingNode(context, nodeType, nodeId);
          if (existing) {
            console.log(
              `⚠️ Default webhook [${pluginName}]: Node already exists: ${nodeId}${lookupInfo}`
            );
            res.writeHead(409, { 'Content-Type': 'application/json' });
            res.end(
              JSON.stringify({
                error: 'Node already exists',
                nodeId,
              })
            );
            return;
          }

          const internalId = getInternalNodeId(existing, nodeType, nodeId);
          await actions.createNode({
            internal: {
              id: internalId,
              type: nodeType,
              owner: pluginName,
            },
            ...nodeData,
          });

          console.log(
            `✅ Default webhook [${pluginName}]: Created node ${nodeType}:${internalId}${lookupInfo}`
          );
          res.writeHead(201, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ created: true, nodeId, internalId }));
          break;
        }

        case 'update': {
          // Check if node exists
          const existing = findExistingNode(context, nodeType, nodeId);
          if (!existing) {
            console.log(
              `⚠️ Default webhook [${pluginName}]: Node not found for update: ${nodeId}${lookupInfo}`
            );
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(
              JSON.stringify({
                error: 'Node not found',
                nodeId,
                idField: idField || 'internal.id',
              })
            );
            return;
          }

          const internalId = existing.internal.id;
          // Use createNode which handles updates via contentDigest
          await actions.createNode({
            internal: {
              id: internalId,
              type: nodeType,
              owner: pluginName,
            },
            ...nodeData,
          });

          console.log(
            `✅ Default webhook [${pluginName}]: Updated node ${nodeType}:${internalId}${lookupInfo}`
          );
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ updated: true, nodeId, internalId }));
          break;
        }

        case 'upsert': {
          // Find existing node to get/generate the internal ID
          const existing = findExistingNode(context, nodeType, nodeId);
          const internalId = getInternalNodeId(existing, nodeType, nodeId);
          const wasUpdate = !!existing;

          await actions.createNode({
            internal: {
              id: internalId,
              type: nodeType,
              owner: pluginName,
            },
            ...nodeData,
          });

          console.log(
            `✅ Default webhook [${pluginName}]: ${wasUpdate ? 'Updated' : 'Created'} node ${nodeType}:${internalId}${lookupInfo}`
          );
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({ upserted: true, nodeId, internalId, wasUpdate })
          );
          break;
        }

        case 'delete': {
          // Find the node to get its internal ID
          const existing = findExistingNode(context, nodeType, nodeId);
          if (!existing) {
            console.log(
              `⚠️ Default webhook [${pluginName}]: Node not found for delete: ${nodeId}${lookupInfo}`
            );
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(
              JSON.stringify({
                error: 'Node not found',
                nodeId,
                idField: idField || 'internal.id',
              })
            );
            return;
          }

          const internalId = existing.internal.id;
          const deleted = await actions.deleteNode(internalId);

          if (deleted) {
            console.log(
              `✅ Default webhook [${pluginName}]: Deleted node ${nodeType}:${internalId}${lookupInfo}`
            );
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ deleted: true, nodeId, internalId }));
          } else {
            // This shouldn't happen if findExistingNode returned a node
            console.log(
              `⚠️ Default webhook [${pluginName}]: Delete failed for node: ${internalId}`
            );
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(
              JSON.stringify({
                error: 'Delete failed',
                nodeId,
                internalId,
              })
            );
          }
          break;
        }
      }
    } catch (error) {
      console.error(`Default webhook handler error for ${pluginName}:`, error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          error: 'Internal server error',
          message: error instanceof Error ? error.message : 'Unknown error',
        })
      );
    }
  };
}
