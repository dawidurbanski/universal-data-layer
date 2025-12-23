import { describe, it, expect, beforeEach } from 'vitest';
import {
  WebhookRegistry,
  WebhookRegistrationError,
  setDefaultWebhookRegistry,
  defaultWebhookRegistry,
  type WebhookRegistration,
  type WebhookHandlerContext,
} from '@/webhooks/index.js';
import type { IncomingMessage, ServerResponse } from 'node:http';

// Sample webhook handler for testing
const createTestWebhook = (description?: string): WebhookRegistration => {
  const webhook: WebhookRegistration = {
    handler: async (
      _req: IncomingMessage,
      res: ServerResponse,
      _context: WebhookHandlerContext
    ) => {
      res.writeHead(200);
      res.end('OK');
    },
  };
  if (description !== undefined) {
    webhook.description = description;
  }
  return webhook;
};

describe('WebhookRegistry', () => {
  let registry: WebhookRegistry;

  beforeEach(() => {
    registry = new WebhookRegistry();
  });

  describe('register', () => {
    it('should register a webhook handler', () => {
      const webhook = createTestWebhook('Handle entry updates');

      registry.register('test-plugin', webhook);

      const handler = registry.getHandler('test-plugin');
      expect(handler).toBeDefined();
      expect(handler?.pluginName).toBe('test-plugin');
      expect(handler?.description).toBe('Handle entry updates');
    });

    it('should preserve the handler function', () => {
      const webhook = createTestWebhook();

      registry.register('test-plugin', webhook);

      const handler = registry.getHandler('test-plugin');
      expect(handler?.handler).toBe(webhook.handler);
    });

    it('should allow registration for different plugins', () => {
      const webhook1 = createTestWebhook('Plugin A handler');
      const webhook2 = createTestWebhook('Plugin B handler');

      registry.register('plugin-a', webhook1);
      registry.register('plugin-b', webhook2);

      expect(registry.getHandler('plugin-a')).toBeDefined();
      expect(registry.getHandler('plugin-b')).toBeDefined();
      expect(registry.size()).toBe(2);
    });

    it('should throw error for duplicate registration for same plugin', () => {
      const webhook1 = createTestWebhook();
      const webhook2 = createTestWebhook();

      registry.register('test-plugin', webhook1);

      expect(() => registry.register('test-plugin', webhook2)).toThrow(
        WebhookRegistrationError
      );
      expect(() => registry.register('test-plugin', webhook2)).toThrow(
        "Webhook handler is already registered for plugin 'test-plugin'"
      );
    });
  });

  describe('getHandler', () => {
    it('should return handler for existing plugin', () => {
      registry.register('my-plugin', createTestWebhook());

      const handler = registry.getHandler('my-plugin');
      expect(handler).toBeDefined();
      expect(handler?.pluginName).toBe('my-plugin');
    });

    it('should return undefined for non-existent handler', () => {
      expect(registry.getHandler('non-existent')).toBeUndefined();
    });

    it('should return undefined for wrong plugin name', () => {
      registry.register('plugin-a', createTestWebhook());

      expect(registry.getHandler('plugin-b')).toBeUndefined();
    });
  });

  describe('has', () => {
    it('should return true for existing handler', () => {
      registry.register('plugin', createTestWebhook());

      expect(registry.has('plugin')).toBe(true);
    });

    it('should return false for non-existent handler', () => {
      expect(registry.has('plugin')).toBe(false);
    });
  });

  describe('getAllHandlers', () => {
    it('should return empty array when no handlers registered', () => {
      expect(registry.getAllHandlers()).toEqual([]);
    });

    it('should return all registered handlers', () => {
      registry.register('plugin-a', createTestWebhook());
      registry.register('plugin-b', createTestWebhook());
      registry.register('plugin-c', createTestWebhook());

      const handlers = registry.getAllHandlers();
      expect(handlers).toHaveLength(3);
    });

    it('should include pluginName in returned handlers', () => {
      registry.register('my-plugin', createTestWebhook());

      const handlers = registry.getAllHandlers();
      expect(handlers[0]?.pluginName).toBe('my-plugin');
    });
  });

  describe('unregister', () => {
    it('should remove a registered handler', () => {
      registry.register('plugin', createTestWebhook());

      const result = registry.unregister('plugin');

      expect(result).toBe(true);
      expect(registry.getHandler('plugin')).toBeUndefined();
    });

    it('should return false when handler does not exist', () => {
      const result = registry.unregister('non-existent');

      expect(result).toBe(false);
    });
  });

  describe('clear', () => {
    it('should remove all handlers', () => {
      registry.register('plugin-a', createTestWebhook());
      registry.register('plugin-b', createTestWebhook());

      registry.clear();

      expect(registry.getAllHandlers()).toEqual([]);
      expect(registry.size()).toBe(0);
    });
  });

  describe('size', () => {
    it('should return 0 for empty registry', () => {
      expect(registry.size()).toBe(0);
    });

    it('should return correct count after registrations', () => {
      registry.register('plugin-a', createTestWebhook());
      registry.register('plugin-b', createTestWebhook());

      expect(registry.size()).toBe(2);
    });

    it('should update after unregister', () => {
      registry.register('plugin', createTestWebhook());
      expect(registry.size()).toBe(1);

      registry.unregister('plugin');
      expect(registry.size()).toBe(0);
    });
  });
});

describe('defaultWebhookRegistry singleton', () => {
  beforeEach(() => {
    // Reset to a fresh registry before each test
    setDefaultWebhookRegistry(new WebhookRegistry());
  });

  it('should be a WebhookRegistry instance', () => {
    expect(defaultWebhookRegistry).toBeInstanceOf(WebhookRegistry);
  });

  it('should be replaceable via setDefaultWebhookRegistry', () => {
    const newRegistry = new WebhookRegistry();
    newRegistry.register('test', createTestWebhook());

    setDefaultWebhookRegistry(newRegistry);

    expect(defaultWebhookRegistry.has('test')).toBe(true);
  });
});
