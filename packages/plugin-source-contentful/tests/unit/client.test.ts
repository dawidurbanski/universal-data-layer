import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { createContentfulClient } from '@/client.js';
import { ContentfulConfigError } from '@/utils/errors.js';
import { createClient } from 'contentful';

vi.mock('contentful', () => ({
  createClient: vi.fn(() => ({ mockClient: true })),
}));

describe('createContentfulClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('validation', () => {
    it('throws ContentfulConfigError when spaceId is missing', () => {
      expect(() =>
        createContentfulClient({
          spaceId: '',
          accessToken: 'test-token',
        })
      ).toThrow(ContentfulConfigError);

      expect(() =>
        createContentfulClient({
          spaceId: '',
          accessToken: 'test-token',
        })
      ).toThrow('Missing required option: spaceId');
    });

    it('throws ContentfulConfigError when accessToken is missing', () => {
      expect(() =>
        createContentfulClient({
          spaceId: 'test-space',
          accessToken: '',
        })
      ).toThrow(ContentfulConfigError);

      expect(() =>
        createContentfulClient({
          spaceId: 'test-space',
          accessToken: '',
        })
      ).toThrow('Missing required option: accessToken');
    });
  });

  describe('client creation', () => {
    it('creates client with required options and defaults', () => {
      const result = createContentfulClient({
        spaceId: 'test-space',
        accessToken: 'test-token',
      });

      expect(createClient).toHaveBeenCalledWith({
        space: 'test-space',
        accessToken: 'test-token',
        host: 'cdn.contentful.com',
        environment: 'master',
      });
      expect(result).toEqual({ mockClient: true });
    });

    it('creates client with custom host', () => {
      createContentfulClient({
        spaceId: 'test-space',
        accessToken: 'test-token',
        host: 'preview.contentful.com',
      });

      expect(createClient).toHaveBeenCalledWith({
        space: 'test-space',
        accessToken: 'test-token',
        host: 'preview.contentful.com',
        environment: 'master',
      });
    });

    it('creates client with custom environment', () => {
      createContentfulClient({
        spaceId: 'test-space',
        accessToken: 'test-token',
        environment: 'staging',
      });

      expect(createClient).toHaveBeenCalledWith({
        space: 'test-space',
        accessToken: 'test-token',
        host: 'cdn.contentful.com',
        environment: 'staging',
      });
    });

    it('creates client with all custom options', () => {
      createContentfulClient({
        spaceId: 'my-space',
        accessToken: 'my-token',
        host: 'preview.contentful.com',
        environment: 'development',
      });

      expect(createClient).toHaveBeenCalledWith({
        space: 'my-space',
        accessToken: 'my-token',
        host: 'preview.contentful.com',
        environment: 'development',
      });
    });

    it('returns the created client', () => {
      const mockClientInstance = { entries: vi.fn() };
      (createClient as Mock).mockReturnValue(mockClientInstance);

      const result = createContentfulClient({
        spaceId: 'test-space',
        accessToken: 'test-token',
      });

      expect(result).toBe(mockClientInstance);
    });
  });
});
