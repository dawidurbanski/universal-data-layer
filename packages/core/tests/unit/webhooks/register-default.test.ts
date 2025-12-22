import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WebhookRegistry } from '@/webhooks/registry.js';
import {
  registerDefaultWebhook,
  registerDefaultWebhooks,
} from '@/webhooks/register-default.js';
import type { DefaultWebhookHandlerConfig } from '@/webhooks/types.js';

describe('registerDefaultWebhook', () => {
  let registry: WebhookRegistry;
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    registry = new WebhookRegistry();
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  it('should not register if config is undefined', () => {
    const result = registerDefaultWebhook(registry, 'test-plugin', undefined);

    expect(result).toBeNull();
    expect(registry.size()).toBe(0);
  });

  it('should not register if enabled is false', () => {
    const config: DefaultWebhookHandlerConfig = { enabled: false };
    const result = registerDefaultWebhook(registry, 'test-plugin', config);

    expect(result).toBeNull();
    expect(registry.size()).toBe(0);
  });

  it('should register with default path "sync" when enabled', () => {
    const config: DefaultWebhookHandlerConfig = { enabled: true };
    const result = registerDefaultWebhook(registry, 'test-plugin', config);

    expect(result).toBe('sync');
    expect(registry.has('test-plugin', 'sync')).toBe(true);
    expect(consoleSpy).toHaveBeenCalledWith(
      '📬 Default webhook registered: /_webhooks/test-plugin/sync'
    );
  });

  it('should register when config is empty object (enabled by default)', () => {
    const config: DefaultWebhookHandlerConfig = {};
    const result = registerDefaultWebhook(registry, 'test-plugin', config);

    expect(result).toBe('sync');
    expect(registry.has('test-plugin', 'sync')).toBe(true);
  });

  it('should use custom global path', () => {
    const config: DefaultWebhookHandlerConfig = {
      enabled: true,
      path: 'custom-sync',
    };
    const result = registerDefaultWebhook(registry, 'test-plugin', config);

    expect(result).toBe('custom-sync');
    expect(registry.has('test-plugin', 'custom-sync')).toBe(true);
  });

  it('should use per-plugin path override', () => {
    const config: DefaultWebhookHandlerConfig = {
      enabled: true,
      path: 'global-sync',
      plugins: {
        'test-plugin': { path: 'plugin-specific' },
      },
    };
    const result = registerDefaultWebhook(registry, 'test-plugin', config);

    expect(result).toBe('plugin-specific');
    expect(registry.has('test-plugin', 'plugin-specific')).toBe(true);
    expect(registry.has('test-plugin', 'global-sync')).toBe(false);
  });

  it('should use global path for plugins without override', () => {
    const config: DefaultWebhookHandlerConfig = {
      enabled: true,
      path: 'global-sync',
      plugins: {
        'other-plugin': { path: 'other-path' },
      },
    };
    const result = registerDefaultWebhook(registry, 'test-plugin', config);

    expect(result).toBe('global-sync');
    expect(registry.has('test-plugin', 'global-sync')).toBe(true);
  });

  it('should not register if plugin is explicitly disabled', () => {
    const config: DefaultWebhookHandlerConfig = {
      enabled: true,
      plugins: {
        'disabled-plugin': false,
      },
    };
    const result = registerDefaultWebhook(registry, 'disabled-plugin', config);

    expect(result).toBeNull();
    expect(registry.size()).toBe(0);
    expect(consoleSpy).toHaveBeenCalledWith(
      '📭 Default webhook disabled for plugin: disabled-plugin'
    );
  });

  it('should not overwrite existing handler', () => {
    // Register a custom handler first
    registry.register('test-plugin', {
      path: 'sync',
      handler: async () => {},
      description: 'Custom handler',
    });

    const config: DefaultWebhookHandlerConfig = { enabled: true };
    const result = registerDefaultWebhook(registry, 'test-plugin', config);

    expect(result).toBeNull();
    // Verify original handler is preserved
    const handler = registry.getHandler('test-plugin', 'sync');
    expect(handler?.description).toBe('Custom handler');
    expect(consoleSpy).toHaveBeenCalledWith(
      "📌 Plugin test-plugin already has handler for 'sync', skipping default registration"
    );
  });

  it('should register handler with correct description', () => {
    const config: DefaultWebhookHandlerConfig = { enabled: true };
    registerDefaultWebhook(registry, 'my-plugin', config);

    const handler = registry.getHandler('my-plugin', 'sync');
    expect(handler?.description).toBe('Default UDL sync handler for my-plugin');
  });
});

describe('registerDefaultWebhooks', () => {
  let registry: WebhookRegistry;

  beforeEach(() => {
    registry = new WebhookRegistry();
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  it('should register for multiple plugins', () => {
    const config: DefaultWebhookHandlerConfig = { enabled: true };
    const plugins = ['plugin-a', 'plugin-b', 'plugin-c'];

    const results = registerDefaultWebhooks(registry, plugins, config);

    expect(results.size).toBe(3);
    expect(results.get('plugin-a')).toBe('sync');
    expect(results.get('plugin-b')).toBe('sync');
    expect(results.get('plugin-c')).toBe('sync');
    expect(registry.size()).toBe(3);
  });

  it('should handle mixed enable/disable per plugin', () => {
    const config: DefaultWebhookHandlerConfig = {
      enabled: true,
      plugins: {
        'plugin-b': false,
      },
    };
    const plugins = ['plugin-a', 'plugin-b', 'plugin-c'];

    const results = registerDefaultWebhooks(registry, plugins, config);

    expect(results.get('plugin-a')).toBe('sync');
    expect(results.get('plugin-b')).toBeNull();
    expect(results.get('plugin-c')).toBe('sync');
    expect(registry.size()).toBe(2);
  });

  it('should handle custom paths per plugin', () => {
    const config: DefaultWebhookHandlerConfig = {
      enabled: true,
      path: 'default-path',
      plugins: {
        'plugin-a': { path: 'path-a' },
        'plugin-c': { path: 'path-c' },
      },
    };
    const plugins = ['plugin-a', 'plugin-b', 'plugin-c'];

    const results = registerDefaultWebhooks(registry, plugins, config);

    expect(results.get('plugin-a')).toBe('path-a');
    expect(results.get('plugin-b')).toBe('default-path');
    expect(results.get('plugin-c')).toBe('path-c');
  });

  it('should return empty results when config is undefined', () => {
    const plugins = ['plugin-a', 'plugin-b'];

    const results = registerDefaultWebhooks(registry, plugins, undefined);

    expect(results.size).toBe(2);
    expect(results.get('plugin-a')).toBeNull();
    expect(results.get('plugin-b')).toBeNull();
    expect(registry.size()).toBe(0);
  });

  it('should handle empty plugin list', () => {
    const config: DefaultWebhookHandlerConfig = { enabled: true };

    const results = registerDefaultWebhooks(registry, [], config);

    expect(results.size).toBe(0);
    expect(registry.size()).toBe(0);
  });
});
