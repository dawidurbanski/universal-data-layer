import { describe, it, expect, vi } from 'vitest';
import type { Entry, EntrySkeletonType } from 'contentful';
import {
  transformEntry,
  getEntryNodeId,
  type EntryTransformContext,
} from '@/utils/entries.js';
import type { ResolvedContentfulPluginOptions } from '@/types/index.js';
import type { FieldLinkMap } from '@/utils/content-types.js';

// Helper to create mock context
function createMockContext(
  overrides: Partial<EntryTransformContext> = {}
): EntryTransformContext {
  const options: ResolvedContentfulPluginOptions = {
    spaceId: 'test-space',
    accessToken: 'test-token',
    environment: 'master',
    locale: 'en-US',
    nodePrefix: 'Contentful',
    useNameForId: true,
    host: 'cdn.contentful.com',
    downloadAssets: false,
    forceFullSync: false,
    ...overrides.options,
  };

  return {
    createNodeId: vi.fn((...args: string[]) => args.join('-')),
    createContentDigest: vi.fn(() => 'mock-digest'),
    options,
    contentTypeMap: new Map([['blogPost', 'ContentfulBlogPost']]),
    ...overrides,
  };
}

// Helper to create mock entry
function createMockEntry(
  overrides: Partial<Entry<EntrySkeletonType>> = {}
): Entry<EntrySkeletonType> {
  return {
    sys: {
      id: 'entry-123',
      type: 'Entry',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-02T00:00:00Z',
      revision: 1,
      contentType: {
        sys: {
          type: 'Link',
          linkType: 'ContentType',
          id: 'blogPost',
        },
      },
      space: {
        sys: {
          type: 'Link',
          linkType: 'Space',
          id: 'test-space',
        },
      },
      environment: {
        sys: {
          type: 'Link',
          linkType: 'Environment',
          id: 'master',
        },
      },
      ...overrides.sys,
    },
    fields: {
      title: 'Test Title',
      ...overrides.fields,
    },
    metadata: {
      tags: [],
    },
  } as Entry<EntrySkeletonType>;
}

describe('transformEntry', () => {
  describe('basic transformation', () => {
    it('transforms a simple entry with basic fields', () => {
      const context = createMockContext();
      const entry = createMockEntry({
        fields: {
          title: 'Hello World',
          count: 42,
          isActive: true,
        },
      });

      const result = transformEntry(entry, context);

      expect(result.internal).toEqual({
        id: 'ContentfulBlogPost-entry-123',
        type: 'ContentfulBlogPost',
        owner: '@universal-data-layer/plugin-source-contentful',
        contentDigest: 'mock-digest',
      });
      expect(result.contentfulId).toBe('entry-123');
      expect(result.sys.id).toBe('entry-123');
      expect(result.sys.type).toBe('Entry');
      expect(result.sys.contentType.sys.id).toBe('blogPost');
      expect(result['title']).toBe('Hello World');
      expect(result['count']).toBe(42);
      expect(result['isActive']).toBe(true);
    });

    it('uses fallback type name when content type not in map', () => {
      const context = createMockContext({
        contentTypeMap: new Map(), // Empty map
      });
      const entry = createMockEntry();

      const result = transformEntry(entry, context);

      expect(result.internal.type).toBe('ContentfulEntry');
    });

    it('includes locale in sys when present on entry', () => {
      const context = createMockContext();
      const entry = createMockEntry();
      // Add locale to sys
      (entry.sys as unknown as Record<string, unknown>)['locale'] = 'en-US';

      const result = transformEntry(entry, context);

      expect(result.sys.locale).toBe('en-US');
    });

    it('excludes locale from sys when not present on entry', () => {
      const context = createMockContext();
      const entry = createMockEntry();

      const result = transformEntry(entry, context);

      expect(result.sys.locale).toBeUndefined();
    });
  });

  describe('locale-keyed values', () => {
    it('extracts value from locale-keyed object', () => {
      const context = createMockContext();
      const entry = createMockEntry({
        fields: {
          title: { 'en-US': 'English Title' },
        },
      });

      const result = transformEntry(entry, context);

      expect(result['title']).toBe('English Title');
    });

    it('treats object without matching locale as regular object', () => {
      const context = createMockContext();
      const entry = createMockEntry({
        fields: {
          title: { 'de-DE': 'German Title' },
        },
      });

      const result = transformEntry(entry, context);

      // Object without en-US key is treated as regular object, not locale-keyed
      expect(result['title']).toEqual({ 'de-DE': 'German Title' });
    });

    it('returns null when locale key exists but value is undefined', () => {
      const context = createMockContext();
      const entry = createMockEntry({
        fields: {
          title: { 'en-US': undefined },
        },
      });

      const result = transformEntry(entry, context);

      expect(result['title']).toBeNull();
    });

    it('handles nested locale-keyed values', () => {
      const context = createMockContext();
      const entry = createMockEntry({
        fields: {
          meta: {
            'en-US': {
              author: 'John',
              views: 100,
            },
          },
        },
      });

      const result = transformEntry(entry, context);

      expect(result['meta']).toEqual({
        author: 'John',
        views: 100,
      });
    });
  });

  describe('null and undefined values', () => {
    it('preserves null values', () => {
      const context = createMockContext();
      const entry = createMockEntry({
        fields: {
          title: null,
        },
      });

      const result = transformEntry(entry, context);

      expect(result['title']).toBeNull();
    });

    it('preserves undefined values', () => {
      const context = createMockContext();
      const entry = createMockEntry({
        fields: {
          title: undefined,
        },
      });

      const result = transformEntry(entry, context);

      expect(result['title']).toBeUndefined();
    });
  });

  describe('unresolved links', () => {
    it('transforms unresolved Entry link to reference', () => {
      const context = createMockContext();
      const entry = createMockEntry({
        fields: {
          author: {
            sys: {
              type: 'Link',
              linkType: 'Entry',
              id: 'author-456',
            },
          },
        },
      });

      const result = transformEntry(entry, context);

      expect(result['author']).toEqual({
        _contentfulRef: true,
        contentfulId: 'author-456',
        linkType: 'Entry',
      });
    });

    it('transforms unresolved Asset link to reference', () => {
      const context = createMockContext();
      const entry = createMockEntry({
        fields: {
          image: {
            sys: {
              type: 'Link',
              linkType: 'Asset',
              id: 'asset-789',
            },
          },
        },
      });

      const result = transformEntry(entry, context);

      expect(result['image']).toEqual({
        _contentfulRef: true,
        contentfulId: 'asset-789',
        linkType: 'Asset',
      });
    });

    it('includes possibleTypes from fieldLinkMap for Entry links', () => {
      const fieldLinkMap: FieldLinkMap = new Map([
        [
          'blogPost.author',
          {
            linkType: 'Entry',
            possibleTypes: ['ContentfulAuthor', 'ContentfulEditor'],
          },
        ],
      ]);
      const context = createMockContext({ fieldLinkMap });
      const entry = createMockEntry({
        fields: {
          author: {
            sys: {
              type: 'Link',
              linkType: 'Entry',
              id: 'author-456',
            },
          },
        },
      });

      const result = transformEntry(entry, context);

      expect(result['author']).toEqual({
        _contentfulRef: true,
        contentfulId: 'author-456',
        linkType: 'Entry',
        possibleTypes: ['ContentfulAuthor', 'ContentfulEditor'],
      });
    });

    it('includes possibleTypes from fieldLinkMap for Asset links', () => {
      const fieldLinkMap: FieldLinkMap = new Map([
        [
          'blogPost.image',
          {
            linkType: 'Asset',
            possibleTypes: ['ContentfulAsset'],
          },
        ],
      ]);
      const context = createMockContext({ fieldLinkMap });
      const entry = createMockEntry({
        fields: {
          image: {
            sys: {
              type: 'Link',
              linkType: 'Asset',
              id: 'asset-789',
            },
          },
        },
      });

      const result = transformEntry(entry, context);

      expect(result['image']).toEqual({
        _contentfulRef: true,
        contentfulId: 'asset-789',
        linkType: 'Asset',
        possibleTypes: ['ContentfulAsset'],
      });
    });

    it('does not include possibleTypes when fieldLinkMap is not provided', () => {
      const context = createMockContext(); // no fieldLinkMap in default context
      const entry = createMockEntry({
        fields: {
          author: {
            sys: {
              type: 'Link',
              linkType: 'Entry',
              id: 'author-456',
            },
          },
        },
      });

      const result = transformEntry(entry, context);

      expect(result['author']).toEqual({
        _contentfulRef: true,
        contentfulId: 'author-456',
        linkType: 'Entry',
      });
    });

    it('does not include possibleTypes when field not in fieldLinkMap', () => {
      const fieldLinkMap: FieldLinkMap = new Map([
        [
          'blogPost.otherField',
          {
            linkType: 'Entry',
            possibleTypes: ['SomeType'],
          },
        ],
      ]);
      const context = createMockContext({ fieldLinkMap });
      const entry = createMockEntry({
        fields: {
          author: {
            sys: {
              type: 'Link',
              linkType: 'Entry',
              id: 'author-456',
            },
          },
        },
      });

      const result = transformEntry(entry, context);

      expect(result['author']).toEqual({
        _contentfulRef: true,
        contentfulId: 'author-456',
        linkType: 'Entry',
      });
    });

    it('does not include possibleTypes when linkType does not match', () => {
      const fieldLinkMap: FieldLinkMap = new Map([
        [
          'blogPost.author',
          {
            linkType: 'Asset', // Mismatched - field is Entry link
            possibleTypes: ['ContentfulAsset'],
          },
        ],
      ]);
      const context = createMockContext({ fieldLinkMap });
      const entry = createMockEntry({
        fields: {
          author: {
            sys: {
              type: 'Link',
              linkType: 'Entry',
              id: 'author-456',
            },
          },
        },
      });

      const result = transformEntry(entry, context);

      expect(result['author']).toEqual({
        _contentfulRef: true,
        contentfulId: 'author-456',
        linkType: 'Entry',
      });
    });

    it('does not include possibleTypes when possibleTypes array is empty', () => {
      const fieldLinkMap: FieldLinkMap = new Map([
        [
          'blogPost.author',
          {
            linkType: 'Entry',
            possibleTypes: [],
          },
        ],
      ]);
      const context = createMockContext({ fieldLinkMap });
      const entry = createMockEntry({
        fields: {
          author: {
            sys: {
              type: 'Link',
              linkType: 'Entry',
              id: 'author-456',
            },
          },
        },
      });

      const result = transformEntry(entry, context);

      expect(result['author']).toEqual({
        _contentfulRef: true,
        contentfulId: 'author-456',
        linkType: 'Entry',
      });
    });
  });

  describe('resolved entries', () => {
    it('transforms resolved entry to reference', () => {
      const context = createMockContext();
      const entry = createMockEntry({
        fields: {
          author: {
            sys: {
              id: 'author-456',
              type: 'Entry',
              createdAt: '2024-01-01T00:00:00Z',
              updatedAt: '2024-01-01T00:00:00Z',
              revision: 1,
              contentType: {
                sys: {
                  type: 'Link',
                  linkType: 'ContentType',
                  id: 'author',
                },
              },
              space: {
                sys: { type: 'Link', linkType: 'Space', id: 'space' },
              },
              environment: {
                sys: { type: 'Link', linkType: 'Environment', id: 'master' },
              },
            },
            fields: {
              name: 'John Doe',
            },
          },
        },
      });

      const result = transformEntry(entry, context);

      expect(result['author']).toEqual({
        _contentfulRef: true,
        contentfulId: 'author-456',
        linkType: 'Entry',
      });
    });

    it('includes possibleTypes for resolved Entry from fieldLinkMap', () => {
      const fieldLinkMap: FieldLinkMap = new Map([
        [
          'blogPost.author',
          {
            linkType: 'Entry',
            possibleTypes: ['ContentfulAuthor'],
          },
        ],
      ]);
      const context = createMockContext({ fieldLinkMap });
      const entry = createMockEntry({
        fields: {
          author: {
            sys: {
              id: 'author-456',
              type: 'Entry',
              createdAt: '2024-01-01T00:00:00Z',
              updatedAt: '2024-01-01T00:00:00Z',
              revision: 1,
              contentType: {
                sys: {
                  type: 'Link',
                  linkType: 'ContentType',
                  id: 'author',
                },
              },
              space: {
                sys: { type: 'Link', linkType: 'Space', id: 'space' },
              },
              environment: {
                sys: { type: 'Link', linkType: 'Environment', id: 'master' },
              },
            },
            fields: {
              name: 'John Doe',
            },
          },
        },
      });

      const result = transformEntry(entry, context);

      expect(result['author']).toEqual({
        _contentfulRef: true,
        contentfulId: 'author-456',
        linkType: 'Entry',
        possibleTypes: ['ContentfulAuthor'],
      });
    });
  });

  describe('resolved assets', () => {
    it('transforms resolved asset to reference', () => {
      const context = createMockContext();
      const entry = createMockEntry({
        fields: {
          image: {
            sys: {
              id: 'asset-789',
              type: 'Asset',
              createdAt: '2024-01-01T00:00:00Z',
              updatedAt: '2024-01-01T00:00:00Z',
              revision: 1,
              space: {
                sys: { type: 'Link', linkType: 'Space', id: 'space' },
              },
              environment: {
                sys: { type: 'Link', linkType: 'Environment', id: 'master' },
              },
            },
            fields: {
              title: 'My Image',
              file: { url: '//example.com/image.jpg' },
            },
          },
        },
      });

      const result = transformEntry(entry, context);

      expect(result['image']).toEqual({
        _contentfulRef: true,
        contentfulId: 'asset-789',
        linkType: 'Asset',
      });
    });

    it('includes possibleTypes for resolved Asset from fieldLinkMap', () => {
      const fieldLinkMap: FieldLinkMap = new Map([
        [
          'blogPost.image',
          {
            linkType: 'Asset',
            possibleTypes: ['ContentfulAsset'],
          },
        ],
      ]);
      const context = createMockContext({ fieldLinkMap });
      const entry = createMockEntry({
        fields: {
          image: {
            sys: {
              id: 'asset-789',
              type: 'Asset',
              createdAt: '2024-01-01T00:00:00Z',
              updatedAt: '2024-01-01T00:00:00Z',
              revision: 1,
              space: {
                sys: { type: 'Link', linkType: 'Space', id: 'space' },
              },
              environment: {
                sys: { type: 'Link', linkType: 'Environment', id: 'master' },
              },
            },
            fields: {
              title: 'My Image',
              file: { url: '//example.com/image.jpg' },
            },
          },
        },
      });

      const result = transformEntry(entry, context);

      expect(result['image']).toEqual({
        _contentfulRef: true,
        contentfulId: 'asset-789',
        linkType: 'Asset',
        possibleTypes: ['ContentfulAsset'],
      });
    });
  });

  describe('arrays', () => {
    it('transforms arrays of primitives', () => {
      const context = createMockContext();
      const entry = createMockEntry({
        fields: {
          tags: ['tag1', 'tag2', 'tag3'],
        },
      });

      const result = transformEntry(entry, context);

      expect(result['tags']).toEqual(['tag1', 'tag2', 'tag3']);
    });

    it('transforms arrays of links', () => {
      const context = createMockContext();
      const entry = createMockEntry({
        fields: {
          authors: [
            { sys: { type: 'Link', linkType: 'Entry', id: 'author-1' } },
            { sys: { type: 'Link', linkType: 'Entry', id: 'author-2' } },
          ],
        },
      });

      const result = transformEntry(entry, context);

      expect(result['authors']).toEqual([
        { _contentfulRef: true, contentfulId: 'author-1', linkType: 'Entry' },
        { _contentfulRef: true, contentfulId: 'author-2', linkType: 'Entry' },
      ]);
    });

    it('transforms arrays with locale-keyed elements', () => {
      const context = createMockContext();
      const entry = createMockEntry({
        fields: {
          items: [{ 'en-US': 'Item 1' }, { 'en-US': 'Item 2' }],
        },
      });

      const result = transformEntry(entry, context);

      expect(result['items']).toEqual(['Item 1', 'Item 2']);
    });
  });

  describe('location fields', () => {
    it('preserves location field values', () => {
      const context = createMockContext();
      const entry = createMockEntry({
        fields: {
          location: { lat: 40.7128, lon: -74.006 },
        },
      });

      const result = transformEntry(entry, context);

      expect(result['location']).toEqual({ lat: 40.7128, lon: -74.006 });
    });
  });

  describe('nested objects', () => {
    it('recursively transforms nested objects', () => {
      const context = createMockContext();
      const entry = createMockEntry({
        fields: {
          metadata: {
            seo: {
              title: 'SEO Title',
              description: 'SEO Description',
            },
            social: {
              twitter: '@handle',
            },
          },
        },
      });

      const result = transformEntry(entry, context);

      expect(result['metadata']).toEqual({
        seo: {
          title: 'SEO Title',
          description: 'SEO Description',
        },
        social: {
          twitter: '@handle',
        },
      });
    });

    it('transforms links within nested objects', () => {
      const context = createMockContext();
      const entry = createMockEntry({
        fields: {
          metadata: {
            featuredImage: {
              sys: { type: 'Link', linkType: 'Asset', id: 'asset-123' },
            },
          },
        },
      });

      const result = transformEntry(entry, context);

      expect(result['metadata']).toEqual({
        featuredImage: {
          _contentfulRef: true,
          contentfulId: 'asset-123',
          linkType: 'Asset',
        },
      });
    });
  });

  describe('rich text', () => {
    it('transforms rich text document without embedded content', () => {
      const context = createMockContext();
      const entry = createMockEntry({
        fields: {
          body: {
            nodeType: 'document',
            data: {},
            content: [
              {
                nodeType: 'paragraph',
                content: [
                  {
                    nodeType: 'text',
                    value: 'Hello world',
                    marks: [],
                    data: {},
                  },
                ],
                data: {},
              },
            ],
          },
        },
      });

      const result = transformEntry(entry, context);

      expect(result['body']).toEqual({
        raw: {
          nodeType: 'document',
          data: {},
          content: [
            {
              nodeType: 'paragraph',
              content: [
                { nodeType: 'text', value: 'Hello world', marks: [], data: {} },
              ],
              data: {},
            },
          ],
        },
        references: [],
      });
    });

    it('extracts embedded-entry-block references from rich text', () => {
      const context = createMockContext();
      const entry = createMockEntry({
        fields: {
          body: {
            nodeType: 'document',
            data: {},
            content: [
              {
                nodeType: 'embedded-entry-block',
                data: {
                  target: {
                    sys: { type: 'Link', linkType: 'Entry', id: 'embed-123' },
                  },
                },
                content: [],
              },
            ],
          },
        },
      });

      const result = transformEntry(entry, context);
      const body = result['body'] as { references: unknown[] };

      expect(body.references).toEqual([
        { _contentfulRef: true, contentfulId: 'embed-123', linkType: 'Entry' },
      ]);
    });

    it('extracts embedded-entry-inline references from rich text', () => {
      const context = createMockContext();
      const entry = createMockEntry({
        fields: {
          body: {
            nodeType: 'document',
            data: {},
            content: [
              {
                nodeType: 'paragraph',
                content: [
                  {
                    nodeType: 'embedded-entry-inline',
                    data: {
                      target: {
                        sys: {
                          type: 'Link',
                          linkType: 'Entry',
                          id: 'inline-456',
                        },
                      },
                    },
                    content: [],
                  },
                ],
                data: {},
              },
            ],
          },
        },
      });

      const result = transformEntry(entry, context);
      const body = result['body'] as { references: unknown[] };

      expect(body.references).toEqual([
        { _contentfulRef: true, contentfulId: 'inline-456', linkType: 'Entry' },
      ]);
    });

    it('extracts entry-hyperlink references from rich text', () => {
      const context = createMockContext();
      const entry = createMockEntry({
        fields: {
          body: {
            nodeType: 'document',
            data: {},
            content: [
              {
                nodeType: 'paragraph',
                content: [
                  {
                    nodeType: 'entry-hyperlink',
                    data: {
                      target: {
                        sys: {
                          type: 'Link',
                          linkType: 'Entry',
                          id: 'link-789',
                        },
                      },
                    },
                    content: [],
                  },
                ],
                data: {},
              },
            ],
          },
        },
      });

      const result = transformEntry(entry, context);
      const body = result['body'] as { references: unknown[] };

      expect(body.references).toEqual([
        { _contentfulRef: true, contentfulId: 'link-789', linkType: 'Entry' },
      ]);
    });

    it('extracts embedded-asset-block references from rich text', () => {
      const context = createMockContext();
      const entry = createMockEntry({
        fields: {
          body: {
            nodeType: 'document',
            data: {},
            content: [
              {
                nodeType: 'embedded-asset-block',
                data: {
                  target: {
                    sys: { type: 'Link', linkType: 'Asset', id: 'asset-111' },
                  },
                },
                content: [],
              },
            ],
          },
        },
      });

      const result = transformEntry(entry, context);
      const body = result['body'] as { references: unknown[] };

      expect(body.references).toEqual([
        { _contentfulRef: true, contentfulId: 'asset-111', linkType: 'Asset' },
      ]);
    });

    it('extracts asset-hyperlink references from rich text', () => {
      const context = createMockContext();
      const entry = createMockEntry({
        fields: {
          body: {
            nodeType: 'document',
            data: {},
            content: [
              {
                nodeType: 'paragraph',
                content: [
                  {
                    nodeType: 'asset-hyperlink',
                    data: {
                      target: {
                        sys: {
                          type: 'Link',
                          linkType: 'Asset',
                          id: 'asset-222',
                        },
                      },
                    },
                    content: [],
                  },
                ],
                data: {},
              },
            ],
          },
        },
      });

      const result = transformEntry(entry, context);
      const body = result['body'] as { references: unknown[] };

      expect(body.references).toEqual([
        { _contentfulRef: true, contentfulId: 'asset-222', linkType: 'Asset' },
      ]);
    });

    it('handles rich text nodes without target data', () => {
      const context = createMockContext();
      const entry = createMockEntry({
        fields: {
          body: {
            nodeType: 'document',
            data: {},
            content: [
              {
                nodeType: 'embedded-entry-block',
                data: {}, // No target
                content: [],
              },
            ],
          },
        },
      });

      const result = transformEntry(entry, context);
      const body = result['body'] as { references: unknown[] };

      expect(body.references).toEqual([]);
    });

    it('handles resolved entries in rich text', () => {
      const context = createMockContext();
      const entry = createMockEntry({
        fields: {
          body: {
            nodeType: 'document',
            data: {},
            content: [
              {
                nodeType: 'embedded-entry-block',
                data: {
                  target: {
                    sys: {
                      id: 'resolved-entry',
                      type: 'Entry',
                      createdAt: '2024-01-01T00:00:00Z',
                      updatedAt: '2024-01-01T00:00:00Z',
                      revision: 1,
                      contentType: {
                        sys: {
                          type: 'Link',
                          linkType: 'ContentType',
                          id: 'block',
                        },
                      },
                      space: {
                        sys: { type: 'Link', linkType: 'Space', id: 'space' },
                      },
                      environment: {
                        sys: {
                          type: 'Link',
                          linkType: 'Environment',
                          id: 'master',
                        },
                      },
                    },
                    fields: { title: 'Embedded' },
                  },
                },
                content: [],
              },
            ],
          },
        },
      });

      const result = transformEntry(entry, context);
      const body = result['body'] as { references: unknown[] };

      expect(body.references).toEqual([
        {
          _contentfulRef: true,
          contentfulId: 'resolved-entry',
          linkType: 'Entry',
        },
      ]);
    });

    it('handles resolved assets in rich text', () => {
      const context = createMockContext();
      const entry = createMockEntry({
        fields: {
          body: {
            nodeType: 'document',
            data: {},
            content: [
              {
                nodeType: 'embedded-asset-block',
                data: {
                  target: {
                    sys: {
                      id: 'resolved-asset',
                      type: 'Asset',
                      createdAt: '2024-01-01T00:00:00Z',
                      updatedAt: '2024-01-01T00:00:00Z',
                      revision: 1,
                      space: {
                        sys: { type: 'Link', linkType: 'Space', id: 'space' },
                      },
                      environment: {
                        sys: {
                          type: 'Link',
                          linkType: 'Environment',
                          id: 'master',
                        },
                      },
                    },
                    fields: {
                      title: 'Image',
                      file: { url: '//example.com/img.jpg' },
                    },
                  },
                },
                content: [],
              },
            ],
          },
        },
      });

      const result = transformEntry(entry, context);
      const body = result['body'] as { references: unknown[] };

      expect(body.references).toEqual([
        {
          _contentfulRef: true,
          contentfulId: 'resolved-asset',
          linkType: 'Asset',
        },
      ]);
    });

    it('extracts multiple references from deeply nested rich text', () => {
      const context = createMockContext();
      const entry = createMockEntry({
        fields: {
          body: {
            nodeType: 'document',
            data: {},
            content: [
              {
                nodeType: 'paragraph',
                content: [
                  {
                    nodeType: 'embedded-entry-inline',
                    data: {
                      target: {
                        sys: {
                          type: 'Link',
                          linkType: 'Entry',
                          id: 'entry-1',
                        },
                      },
                    },
                    content: [],
                  },
                ],
                data: {},
              },
              {
                nodeType: 'embedded-asset-block',
                data: {
                  target: {
                    sys: { type: 'Link', linkType: 'Asset', id: 'asset-1' },
                  },
                },
                content: [],
              },
            ],
          },
        },
      });

      const result = transformEntry(entry, context);
      const body = result['body'] as { references: unknown[] };

      expect(body.references).toHaveLength(2);
      expect(body.references).toContainEqual({
        _contentfulRef: true,
        contentfulId: 'entry-1',
        linkType: 'Entry',
      });
      expect(body.references).toContainEqual({
        _contentfulRef: true,
        contentfulId: 'asset-1',
        linkType: 'Asset',
      });
    });

    it('handles rich text nodes without content array', () => {
      const context = createMockContext();
      const entry = createMockEntry({
        fields: {
          body: {
            nodeType: 'document',
            data: {},
            content: [
              {
                nodeType: 'hr', // horizontal rule has no content
                data: {},
              },
            ],
          },
        },
      });

      const result = transformEntry(entry, context);
      const body = result['body'] as { references: unknown[] };

      expect(body.references).toEqual([]);
    });
  });

  describe('edge cases', () => {
    it('handles object that looks like link but is not', () => {
      const context = createMockContext();
      const entry = createMockEntry({
        fields: {
          notALink: {
            sys: {
              type: 'NotLink', // Not 'Link' or 'Entry' or 'Asset'
              id: 'some-id',
            },
          },
        },
      });

      const result = transformEntry(entry, context);

      // Should be treated as a regular object
      expect(result['notALink']).toEqual({
        sys: {
          type: 'NotLink',
          id: 'some-id',
        },
      });
    });

    it('handles object with sys but no type', () => {
      const context = createMockContext();
      const entry = createMockEntry({
        fields: {
          weirdObject: {
            sys: {
              id: 'some-id',
            },
          },
        },
      });

      const result = transformEntry(entry, context);

      // Should be treated as a regular object
      expect(result['weirdObject']).toEqual({
        sys: {
          id: 'some-id',
        },
      });
    });

    it('handles object with sys as null', () => {
      const context = createMockContext();
      const entry = createMockEntry({
        fields: {
          weirdObject: {
            sys: null,
          },
        },
      });

      const result = transformEntry(entry, context);

      expect(result['weirdObject']).toEqual({
        sys: null,
      });
    });

    it('handles non-object sys property', () => {
      const context = createMockContext();
      const entry = createMockEntry({
        fields: {
          weirdObject: {
            sys: 'not-an-object',
          },
        },
      });

      const result = transformEntry(entry, context);

      expect(result['weirdObject']).toEqual({
        sys: 'not-an-object',
      });
    });

    it('handles object with fields but no sys type', () => {
      const context = createMockContext();
      const entry = createMockEntry({
        fields: {
          weirdObject: {
            fields: { name: 'test' },
          },
        },
      });

      const result = transformEntry(entry, context);

      expect(result['weirdObject']).toEqual({
        fields: { name: 'test' },
      });
    });

    it('handles arrays', () => {
      const context = createMockContext();
      // isLocaleKeyedObject returns false for arrays
      const entry = createMockEntry({
        fields: {
          items: ['a', 'b', 'c'],
        },
      });

      const result = transformEntry(entry, context);

      expect(result['items']).toEqual(['a', 'b', 'c']);
    });

    it('handles empty object', () => {
      const context = createMockContext();
      const entry = createMockEntry({
        fields: {
          emptyObj: {},
        },
      });

      const result = transformEntry(entry, context);

      expect(result['emptyObj']).toEqual({});
    });
  });
});

describe('getEntryNodeId', () => {
  it('returns correct node ID using content type from map', () => {
    const context = createMockContext({
      contentTypeMap: new Map([['blogPost', 'ContentfulBlogPost']]),
    });

    const nodeId = getEntryNodeId('entry-123', 'blogPost', context);

    expect(nodeId).toBe('ContentfulBlogPost-entry-123');
    expect(context.createNodeId).toHaveBeenCalledWith(
      'ContentfulBlogPost',
      'entry-123'
    );
  });

  it('uses fallback type name when content type not in map', () => {
    const context = createMockContext({
      contentTypeMap: new Map(), // Empty map
    });

    const nodeId = getEntryNodeId('entry-123', 'unknownType', context);

    expect(nodeId).toBe('ContentfulEntry-entry-123');
    expect(context.createNodeId).toHaveBeenCalledWith(
      'ContentfulEntry',
      'entry-123'
    );
  });

  it('uses custom node prefix in fallback type name', () => {
    const context = createMockContext({
      contentTypeMap: new Map(),
      options: {
        spaceId: 'test-space',
        accessToken: 'test-token',
        environment: 'master',
        locale: 'en-US',
        nodePrefix: 'CMS',
        useNameForId: true,
        host: 'cdn.contentful.com',
        downloadAssets: false,
        forceFullSync: false,
      },
    });

    const nodeId = getEntryNodeId('entry-123', 'unknownType', context);

    expect(nodeId).toBe('CMSEntry-entry-123');
  });
});
