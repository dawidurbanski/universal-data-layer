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
const createTestWebhook = (
  path: string,
  description?: string
): WebhookRegistration => {
  const webhook: WebhookRegistration = {
    path,
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

// Sample webhook with signature verification
const createWebhookWithSignature = (path: string): WebhookRegistration => ({
  path,
  handler: async (
    _req: IncomingMessage,
    res: ServerResponse,
    _context: WebhookHandlerContext
  ) => {
    res.writeHead(200);
    res.end('OK');
  },
  verifySignature: (_req: IncomingMessage, _body: Buffer) => {
    return true;
  },
});

describe('WebhookRegistry', () => {
  let registry: WebhookRegistry;

  beforeEach(() => {
    registry = new WebhookRegistry();
  });

  describe('register', () => {
    it('should register a webhook handler', () => {
      const webhook = createTestWebhook('entry-update', 'Handle entry updates');

      registry.register('test-plugin', webhook);

      const handler = registry.getHandler('test-plugin', 'entry-update');
      expect(handler).toBeDefined();
      expect(handler?.path).toBe('entry-update');
      expect(handler?.pluginName).toBe('test-plugin');
      expect(handler?.description).toBe('Handle entry updates');
    });

    it('should preserve the handler function', () => {
      const webhook = createTestWebhook('test-path');

      registry.register('test-plugin', webhook);

      const handler = registry.getHandler('test-plugin', 'test-path');
      expect(handler?.handler).toBe(webhook.handler);
    });

    it('should preserve optional verifySignature function', () => {
      const webhook = createWebhookWithSignature('signed-webhook');

      registry.register('test-plugin', webhook);

      const handler = registry.getHandler('test-plugin', 'signed-webhook');
      expect(handler?.verifySignature).toBe(webhook.verifySignature);
    });

    it('should allow same path for different plugins', () => {
      const webhook1 = createTestWebhook('update');
      const webhook2 = createTestWebhook('update');

      registry.register('plugin-a', webhook1);
      registry.register('plugin-b', webhook2);

      expect(registry.getHandler('plugin-a', 'update')).toBeDefined();
      expect(registry.getHandler('plugin-b', 'update')).toBeDefined();
      expect(registry.size()).toBe(2);
    });

    it('should throw error for duplicate path within same plugin', () => {
      const webhook1 = createTestWebhook('duplicate');
      const webhook2 = createTestWebhook('duplicate');

      registry.register('test-plugin', webhook1);

      expect(() => registry.register('test-plugin', webhook2)).toThrow(
        WebhookRegistrationError
      );
      expect(() => registry.register('test-plugin', webhook2)).toThrow(
        "Webhook path 'duplicate' is already registered for plugin 'test-plugin'"
      );
    });
  });

  describe('path validation', () => {
    it('should accept valid paths with alphanumeric characters', () => {
      expect(() =>
        registry.register('test', createTestWebhook('valid123'))
      ).not.toThrow();
    });

    it('should accept valid paths with hyphens', () => {
      expect(() =>
        registry.register('test', createTestWebhook('entry-update'))
      ).not.toThrow();
    });

    it('should accept valid paths with underscores', () => {
      expect(() =>
        registry.register('test', createTestWebhook('entry_update'))
      ).not.toThrow();
    });

    it('should accept valid paths with mixed characters', () => {
      expect(() =>
        registry.register('test', createTestWebhook('v1-entry_update'))
      ).not.toThrow();
    });

    it('should reject empty paths', () => {
      expect(() => registry.register('test', createTestWebhook(''))).toThrow(
        WebhookRegistrationError
      );
      expect(() => registry.register('test', createTestWebhook(''))).toThrow(
        'Webhook path cannot be empty'
      );
    });

    it('should reject paths starting with slash', () => {
      expect(() =>
        registry.register('test', createTestWebhook('/entry-update'))
      ).toThrow(WebhookRegistrationError);
      expect(() =>
        registry.register('test', createTestWebhook('/entry-update'))
      ).toThrow("Webhook path cannot start with '/'");
    });

    it('should reject paths with invalid characters', () => {
      expect(() =>
        registry.register('test', createTestWebhook('entry.update'))
      ).toThrow(WebhookRegistrationError);
      expect(() =>
        registry.register('test', createTestWebhook('entry@update'))
      ).toThrow(WebhookRegistrationError);
      expect(() =>
        registry.register('test', createTestWebhook('entry update'))
      ).toThrow(WebhookRegistrationError);
    });

    it('should reject paths starting with hyphen', () => {
      expect(() =>
        registry.register('test', createTestWebhook('-entry'))
      ).toThrow(WebhookRegistrationError);
    });

    it('should reject paths starting with underscore', () => {
      expect(() =>
        registry.register('test', createTestWebhook('_entry'))
      ).toThrow(WebhookRegistrationError);
    });
  });

  describe('getHandler', () => {
    it('should return handler for existing plugin+path', () => {
      registry.register('my-plugin', createTestWebhook('webhook-path'));

      const handler = registry.getHandler('my-plugin', 'webhook-path');
      expect(handler).toBeDefined();
      expect(handler?.pluginName).toBe('my-plugin');
    });

    it('should return undefined for non-existent handler', () => {
      expect(registry.getHandler('non-existent', 'path')).toBeUndefined();
    });

    it('should return undefined for wrong plugin name', () => {
      registry.register('plugin-a', createTestWebhook('path'));

      expect(registry.getHandler('plugin-b', 'path')).toBeUndefined();
    });

    it('should return undefined for wrong path', () => {
      registry.register('plugin', createTestWebhook('path-a'));

      expect(registry.getHandler('plugin', 'path-b')).toBeUndefined();
    });
  });

  describe('has', () => {
    it('should return true for existing handler', () => {
      registry.register('plugin', createTestWebhook('path'));

      expect(registry.has('plugin', 'path')).toBe(true);
    });

    it('should return false for non-existent handler', () => {
      expect(registry.has('plugin', 'path')).toBe(false);
    });
  });

  describe('getAllHandlers', () => {
    it('should return empty array when no handlers registered', () => {
      expect(registry.getAllHandlers()).toEqual([]);
    });

    it('should return all registered handlers', () => {
      registry.register('plugin-a', createTestWebhook('path-1'));
      registry.register('plugin-a', createTestWebhook('path-2'));
      registry.register('plugin-b', createTestWebhook('path-1'));

      const handlers = registry.getAllHandlers();
      expect(handlers).toHaveLength(3);
    });

    it('should include pluginName in returned handlers', () => {
      registry.register('my-plugin', createTestWebhook('my-path'));

      const handlers = registry.getAllHandlers();
      expect(handlers[0]?.pluginName).toBe('my-plugin');
      expect(handlers[0]?.path).toBe('my-path');
    });
  });

  describe('getHandlersByPlugin', () => {
    beforeEach(() => {
      registry.register('plugin-a', createTestWebhook('path-1'));
      registry.register('plugin-a', createTestWebhook('path-2'));
      registry.register('plugin-b', createTestWebhook('path-3'));
    });

    it('should return only handlers for specified plugin', () => {
      const handlers = registry.getHandlersByPlugin('plugin-a');

      expect(handlers).toHaveLength(2);
      expect(handlers.every((h) => h.pluginName === 'plugin-a')).toBe(true);
    });

    it('should return empty array for plugin with no handlers', () => {
      const handlers = registry.getHandlersByPlugin('non-existent');

      expect(handlers).toEqual([]);
    });
  });

  describe('unregister', () => {
    it('should remove a registered handler', () => {
      registry.register('plugin', createTestWebhook('path'));

      const result = registry.unregister('plugin', 'path');

      expect(result).toBe(true);
      expect(registry.getHandler('plugin', 'path')).toBeUndefined();
    });

    it('should return false when handler does not exist', () => {
      const result = registry.unregister('non-existent', 'path');

      expect(result).toBe(false);
    });
  });

  describe('clear', () => {
    it('should remove all handlers', () => {
      registry.register('plugin-a', createTestWebhook('path-1'));
      registry.register('plugin-b', createTestWebhook('path-2'));

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
      registry.register('plugin', createTestWebhook('path-1'));
      registry.register('plugin', createTestWebhook('path-2'));

      expect(registry.size()).toBe(2);
    });

    it('should update after unregister', () => {
      registry.register('plugin', createTestWebhook('path'));
      expect(registry.size()).toBe(1);

      registry.unregister('plugin', 'path');
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
    newRegistry.register('test', createTestWebhook('test-path'));

    setDefaultWebhookRegistry(newRegistry);

    expect(defaultWebhookRegistry.has('test', 'test-path')).toBe(true);
  });
});
