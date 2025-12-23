import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { WebhookRegistry } from '@/webhooks/registry.js';
import {
  registerDefaultWebhook,
  registerPluginWebhookHandler,
} from '@/webhooks/register-default.js';
import { DEFAULT_WEBHOOK_PATH } from '@/webhooks/default-handler.js';
import type {
  PluginWebhookHandler,
  PluginWebhookHandlerContext,
  WebhookHandlerContext,
} from '@/webhooks/types.js';
import type { NodeStore } from '@/nodes/store.js';
import type { NodeActions } from '@/nodes/actions/index.js';

describe('registerDefaultWebhook', () => {
  let registry: WebhookRegistry;
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    registry = new WebhookRegistry();
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  it('should register with default path "sync"', () => {
    const result = registerDefaultWebhook(registry, 'test-plugin');

    expect(result).toBe(true);
    expect(registry.has('test-plugin')).toBe(true);
    expect(consoleSpy).toHaveBeenCalledWith(
      `📬 Default webhook registered: /_webhooks/test-plugin/${DEFAULT_WEBHOOK_PATH}`
    );
  });

  it('should not overwrite existing handler', () => {
    // Register a custom handler first
    registry.register('test-plugin', {
      handler: async () => {},
      description: 'Custom handler',
    });

    const result = registerDefaultWebhook(registry, 'test-plugin');

    expect(result).toBe(false);
    // Verify original handler is preserved
    const handler = registry.getHandler('test-plugin');
    expect(handler?.description).toBe('Custom handler');
    expect(consoleSpy).toHaveBeenCalledWith(
      `📌 Plugin test-plugin already has handler, skipping default registration`
    );
  });

  it('should register handler with correct description', () => {
    registerDefaultWebhook(registry, 'my-plugin');

    const handler = registry.getHandler('my-plugin');
    expect(handler?.description).toBe('Default UDL sync handler for my-plugin');
  });

  it('should include idField in description when provided', () => {
    registerDefaultWebhook(registry, 'my-plugin', 'externalId');

    const handler = registry.getHandler('my-plugin');
    expect(handler?.description).toBe(
      'Default UDL sync handler for my-plugin (idField: externalId)'
    );
    expect(consoleSpy).toHaveBeenCalledWith(
      `📬 Default webhook registered: /_webhooks/my-plugin/${DEFAULT_WEBHOOK_PATH} (idField: externalId)`
    );
  });

  it('should register for multiple plugins independently', () => {
    registerDefaultWebhook(registry, 'plugin-a');
    registerDefaultWebhook(registry, 'plugin-b');
    registerDefaultWebhook(registry, 'plugin-c');

    expect(registry.has('plugin-a')).toBe(true);
    expect(registry.has('plugin-b')).toBe(true);
    expect(registry.has('plugin-c')).toBe(true);
    expect(registry.size()).toBe(3);
  });
});

describe('registerPluginWebhookHandler', () => {
  let registry: WebhookRegistry;
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    registry = new WebhookRegistry();
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  it('should register a custom plugin handler', () => {
    const customHandler: PluginWebhookHandler = async () => {};

    const result = registerPluginWebhookHandler(
      registry,
      'my-plugin',
      customHandler
    );

    expect(result).toBe(true);
    expect(registry.has('my-plugin')).toBe(true);
    expect(consoleSpy).toHaveBeenCalledWith(
      `📬 Custom webhook registered: /_webhooks/my-plugin/${DEFAULT_WEBHOOK_PATH}`
    );
  });

  it('should register handler with correct description', () => {
    const customHandler: PluginWebhookHandler = async () => {};

    registerPluginWebhookHandler(registry, 'my-plugin', customHandler);

    const handler = registry.getHandler('my-plugin');
    expect(handler?.description).toBe('Custom webhook handler for my-plugin');
  });

  it('should wrap the plugin handler to match WebhookHandlerFn signature', async () => {
    const mockReq = {} as IncomingMessage;
    const mockRes = {} as ServerResponse;
    const mockContext: WebhookHandlerContext = {
      store: {} as NodeStore,
      actions: { createNode: vi.fn() } as unknown as NodeActions,
      body: { test: true },
      rawBody: Buffer.from('test'),
    };

    let receivedContext: PluginWebhookHandlerContext | null = null;
    const customHandler: PluginWebhookHandler = async (ctx) => {
      receivedContext = ctx;
    };

    registerPluginWebhookHandler(registry, 'my-plugin', customHandler);

    const handler = registry.getHandler('my-plugin');
    await handler!.handler(mockReq, mockRes, mockContext);

    expect(receivedContext).toEqual({
      req: mockReq,
      res: mockRes,
      actions: mockContext.actions,
      store: mockContext.store,
      body: mockContext.body,
      rawBody: mockContext.rawBody,
    });
  });

  it('should allow plugin handler to access node actions', async () => {
    const mockReq = {} as IncomingMessage;
    const mockRes = {
      writeHead: vi.fn(),
      end: vi.fn(),
    } as unknown as ServerResponse;
    const createNodeFn = vi.fn();
    const mockContext: WebhookHandlerContext = {
      store: {} as NodeStore,
      actions: { createNode: createNodeFn } as unknown as NodeActions,
      body: { nodeType: 'Test', data: { name: 'test' } },
      rawBody: Buffer.from('test'),
    };

    const customHandler: PluginWebhookHandler = async ({ actions }) => {
      await actions.createNode({
        internal: { id: '1', type: 'Test', owner: 'my-plugin' },
        name: 'test',
      });
    };

    registerPluginWebhookHandler(registry, 'my-plugin', customHandler);

    const handler = registry.getHandler('my-plugin');
    await handler!.handler(mockReq, mockRes, mockContext);

    expect(createNodeFn).toHaveBeenCalledWith({
      internal: { id: '1', type: 'Test', owner: 'my-plugin' },
      name: 'test',
    });
  });
});
