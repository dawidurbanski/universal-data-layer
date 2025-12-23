/**
 * Webhook system types for plugin webhook registration.
 *
 * These interfaces allow plugins to register webhook handlers that will
 * receive and process incoming webhook payloads from external data sources.
 */

import type { IncomingMessage, ServerResponse } from 'node:http';
import type { NodeStore } from '@/nodes/store.js';
import type { NodeActions } from '@/nodes/actions/index.js';

/**
 * Context passed to webhook handlers when processing incoming requests.
 *
 * @example
 * ```typescript
 * handler: async (req, res, context) => {
 *   const { body, actions } = context;
 *   if (body.type === 'entry.publish') {
 *     await actions.createNode(transformEntry(body.entry), { ... });
 *   }
 *   res.writeHead(200);
 *   res.end();
 * }
 * ```
 */
export interface WebhookHandlerContext {
  /** Access to the node store for querying existing nodes */
  store: NodeStore;
  /** Bound node actions for creating, updating, or deleting nodes */
  actions: NodeActions;
  /** Raw body buffer for signature verification */
  rawBody: Buffer;
  /** Parsed JSON body (if content-type is application/json), otherwise undefined */
  body: unknown;
}

/**
 * Function signature for webhook handlers.
 *
 * Handlers receive the raw HTTP request and response objects along with
 * a context containing node store access and parsed body data.
 */
export type WebhookHandlerFn = (
  req: IncomingMessage,
  res: ServerResponse,
  context: WebhookHandlerContext
) => Promise<void>;

/**
 * Signature verification function type.
 * Returns true if the signature is valid, false otherwise.
 */
export type SignatureVerifier = (
  req: IncomingMessage,
  rawBody: Buffer
) => boolean | Promise<boolean>;

/**
 * Configuration for registering a webhook handler.
 *
 * Simplified registration that only requires the handler function.
 * All webhooks are registered at the convention-based path:
 * `/_webhooks/{pluginName}/sync`
 *
 * @example
 * ```typescript
 * // Internal registration
 * registry.register('my-plugin', {
 *   handler: async (req, res, context) => {
 *     await actions.createNode(transformEntry(body), { ... });
 *     res.writeHead(200);
 *     res.end();
 *   },
 *   description: 'Default UDL sync handler',
 * });
 * ```
 */
export interface WebhookRegistration {
  /**
   * Handler function to process incoming webhook payloads.
   * Receives raw request/response objects and a context with node store access.
   */
  handler: WebhookHandlerFn;

  /**
   * Optional description for logging and debugging purposes.
   * @example 'Default UDL sync handler for my-plugin'
   */
  description?: string;

  /**
   * Optional signature verification function.
   * If provided, webhooks will be rejected with 401 if verification fails.
   * Called before the webhook is queued for processing.
   *
   * @example
   * ```typescript
   * verifySignature: (req, rawBody) => {
   *   const signature = req.headers['x-webhook-signature'];
   *   return verifyHmac(rawBody, signature, secret);
   * }
   * ```
   */
  verifySignature?: SignatureVerifier;
}

/**
 * Internal representation of a registered webhook handler.
 * Includes the plugin name that registered it for routing purposes.
 */
export interface WebhookHandler extends WebhookRegistration {
  /** Name of the plugin that registered this webhook */
  pluginName: string;
}

/**
 * Context passed to plugin's `registerWebhookHandler` export.
 *
 * This is a flattened context that combines request, response, and node operations
 * into a single object for convenience.
 *
 * @example
 * ```typescript
 * // In plugin's udl.config.ts
 * export async function registerWebhookHandler({ req, res, actions, body }) {
 *   const eventType = req.headers['x-webhook-type'];
 *
 *   if (eventType === 'entry.publish') {
 *     await actions.createNode(transformEntry(body), { ... });
 *   } else if (eventType === 'entry.delete') {
 *     await actions.deleteNode(body.sys.id);
 *   }
 *
 *   res.writeHead(200);
 *   res.end();
 * }
 * ```
 */
export interface PluginWebhookHandlerContext {
  /** The incoming HTTP request */
  req: IncomingMessage;
  /** The server response */
  res: ServerResponse;
  /** Bound node actions for creating, updating, or deleting nodes */
  actions: NodeActions;
  /** Access to the node store for querying existing nodes */
  store: NodeStore;
  /** Parsed JSON body (if content-type is application/json), otherwise undefined */
  body: unknown;
  /** Raw body buffer for signature verification */
  rawBody: Buffer;
}

/**
 * Function signature for plugin's `registerWebhookHandler` export.
 *
 * Plugins can export this function to handle webhooks with custom logic.
 * When exported, it replaces the default CRUD handler for the plugin's
 * `/_webhooks/{plugin-name}/sync` endpoint.
 *
 * @example
 * ```typescript
 * // Plugin's udl.config.ts
 * export async function registerWebhookHandler({ req, res, actions, body }) {
 *   // Verify signature using your CMS's method
 *   if (!verifySignature(req, body)) {
 *     res.writeHead(401);
 *     res.end('Invalid signature');
 *     return;
 *   }
 *
 *   // Handle different event types
 *   const eventType = req.headers['x-webhook-type'];
 *   if (eventType === 'entry.publish') {
 *     await actions.createNode(transformEntry(body), { ... });
 *   }
 *
 *   res.writeHead(200);
 *   res.end();
 * }
 * ```
 */
export type PluginWebhookHandler = (
  context: PluginWebhookHandlerContext
) => Promise<void>;

/**
 * Standardized webhook payload for default handlers.
 * This payload format is used by the auto-registered default webhook handlers.
 */
export interface DefaultWebhookPayload {
  /**
   * The operation to perform on the node.
   * - 'create': Create a new node (fails if exists)
   * - 'update': Update an existing node (fails if doesn't exist)
   * - 'delete': Delete a node
   * - 'upsert': Create or update a node (always succeeds)
   */
  operation: 'create' | 'update' | 'delete' | 'upsert';

  /**
   * The unique identifier for the node.
   */
  nodeId: string;

  /**
   * The type of node (e.g., 'Product', 'Article').
   */
  nodeType: string;

  /**
   * The node data for create/update/upsert operations.
   * Not required for delete operations.
   */
  data?: Record<string, unknown>;
}
