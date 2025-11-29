import { describe, it, expect } from 'vitest';
import {
  resolveOptions,
  DEFAULT_OPTIONS,
  type ContentfulPluginOptions,
} from '@/types/options.js';

describe('DEFAULT_OPTIONS', () => {
  it('has correct default values', () => {
    expect(DEFAULT_OPTIONS).toEqual({
      host: 'cdn.contentful.com',
      environment: 'master',
      nodePrefix: 'Contentful',
      downloadAssets: false,
      useNameForId: true,
      forceFullSync: false,
    });
  });
});

describe('resolveOptions', () => {
  it('merges user options with defaults', () => {
    const userOptions: ContentfulPluginOptions = {
      spaceId: 'my-space',
      accessToken: 'my-token',
    };

    const resolved = resolveOptions(userOptions);

    expect(resolved).toEqual({
      spaceId: 'my-space',
      accessToken: 'my-token',
      host: 'cdn.contentful.com',
      environment: 'master',
      nodePrefix: 'Contentful',
      downloadAssets: false,
      useNameForId: true,
      forceFullSync: false,
    });
  });

  it('allows overriding default values', () => {
    const userOptions: ContentfulPluginOptions = {
      spaceId: 'my-space',
      accessToken: 'my-token',
      host: 'preview.contentful.com',
      environment: 'staging',
      nodePrefix: 'CMS',
      downloadAssets: true,
      useNameForId: false,
      forceFullSync: true,
    };

    const resolved = resolveOptions(userOptions);

    expect(resolved.host).toBe('preview.contentful.com');
    expect(resolved.environment).toBe('staging');
    expect(resolved.nodePrefix).toBe('CMS');
    expect(resolved.downloadAssets).toBe(true);
    expect(resolved.useNameForId).toBe(false);
    expect(resolved.forceFullSync).toBe(true);
  });

  it('preserves optional properties when provided', () => {
    const contentTypeFilter = () => true;
    const syncTokenStorage = {
      getSyncToken: async () => null,
      setSyncToken: async () => {},
    };

    const userOptions: ContentfulPluginOptions = {
      spaceId: 'my-space',
      accessToken: 'my-token',
      locales: ['en-US', 'de-DE'],
      contentTypeFilter,
      syncTokenStorage,
    };

    const resolved = resolveOptions(userOptions);

    expect(resolved.locales).toEqual(['en-US', 'de-DE']);
    expect(resolved.contentTypeFilter).toBe(contentTypeFilter);
    expect(resolved.syncTokenStorage).toBe(syncTokenStorage);
  });

  it('does not include undefined optional properties', () => {
    const userOptions: ContentfulPluginOptions = {
      spaceId: 'my-space',
      accessToken: 'my-token',
    };

    const resolved = resolveOptions(userOptions);

    expect('locales' in resolved).toBe(false);
    expect('contentTypeFilter' in resolved).toBe(false);
    expect('syncTokenStorage' in resolved).toBe(false);
  });
});
