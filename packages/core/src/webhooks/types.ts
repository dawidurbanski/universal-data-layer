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
 * Configuration for registering a webhook handler.
 *
 * Plugins provide this configuration when calling `registerWebhook()` in
 * their `sourceNodes` hook. The path is combined with the plugin name to
 * create the full webhook URL.
 *
 * @example
 * ```typescript
 * // In plugin's sourceNodes hook
 * registerWebhook({
 *   path: 'entry-update',
 *   description: 'Handles Contentful entry publish/unpublish events',
 *   handler: async (req, res, context) => {
 *     const { body, actions } = context;
 *     // Process webhook payload and update nodes
 *     await actions.createNode(transformEntry(body), { ... });
 *     res.writeHead(200, { 'Content-Type': 'application/json' });
 *     res.end(JSON.stringify({ received: true }));
 *   },
 *   verifySignature: (req, body) => {
 *     const signature = req.headers['x-contentful-signature'];
 *     return verifyHmac(body, signature, secret);
 *   },
 * });
 * ```
 */
export interface WebhookRegistration {
  /**
   * Path suffix for the webhook endpoint.
   * Combined with plugin name to form full path: `/_webhooks/{pluginName}/{path}`
   *
   * Must not start with `/` and can only contain alphanumeric characters,
   * hyphens, and underscores.
   *
   * @example 'entry-update'
   * @example 'product_sync'
   */
  path: string;

  /**
   * Handler function to process incoming webhook payloads.
   * Receives raw request/response objects and a context with node store access.
   */
  handler: WebhookHandlerFn;

  /**
   * Optional function to verify webhook signatures.
   * Called before the handler to validate the request authenticity.
   * Return `true` if signature is valid, `false` to reject the request.
   *
   * @param req - The incoming HTTP request with headers
   * @param body - Raw body buffer for computing signatures
   * @returns Whether the signature is valid
   */
  verifySignature?: (
    req: IncomingMessage,
    body: Buffer
  ) => boolean | Promise<boolean>;

  /**
   * Optional description for logging and debugging purposes.
   * @example 'Handles Contentful entry publish/unpublish events'
   */
  description?: string;
}

/**
 * Internal representation of a registered webhook handler.
 * Includes the plugin name that registered it for routing purposes.
 */
export interface WebhookHandler extends WebhookRegistration {
  /** Name of the plugin that registered this webhook */
  pluginName: string;
}
