import { describe, it, expect } from 'vitest';
import type { ContentType } from 'contentful';
import { createFieldLinkMap } from '@/utils/content-types.js';
import { resolveOptions } from '@/utils/options.js';

// Helper to create a mock content type
function createMockContentType(
  id: string,
  name: string,
  fields: Array<{
    id: string;
    type: string;
    linkType?: 'Entry' | 'Asset';
    validations?: Array<{ linkContentType?: string[] }>;
    items?: {
      type: string;
      linkType?: 'Entry' | 'Asset';
      validations?: Array<{ linkContentType?: string[] }>;
    };
  }>
): ContentType {
  return {
    sys: {
      id,
      type: 'ContentType',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
      space: { sys: { id: 'test', type: 'Link', linkType: 'Space' } },
      environment: {
        sys: { id: 'master', type: 'Link', linkType: 'Environment' },
      },
      revision: 1,
    },
    name,
    description: '',
    displayField: 'title',
    fields: fields.map((f) => ({
      id: f.id,
      name: f.id,
      type: f.type,
      localized: false,
      required: false,
      validations: f.validations ?? [],
      disabled: false,
      omitted: false,
      linkType: f.linkType,
      items: f.items,
    })),
  } as unknown as ContentType;
}

describe('createFieldLinkMap', () => {
  const options = resolveOptions({
    spaceId: 'test',
    accessToken: 'test',
    nodePrefix: 'Contentful',
  });

  it('creates map with single link field to Asset', () => {
    const contentTypes = [
      createMockContentType('product', 'Product', [
        { id: 'title', type: 'Symbol' },
        { id: 'image', type: 'Link', linkType: 'Asset' },
      ]),
    ];

    const map = createFieldLinkMap(contentTypes, options);

    expect(map.get('product.image')).toEqual({
      linkType: 'Asset',
      possibleTypes: ['ContentfulAsset'],
    });
  });

  it('creates map with single link field to Entry with validations', () => {
    const contentTypes = [
      createMockContentType('product', 'Product', [
        {
          id: 'author',
          type: 'Link',
          linkType: 'Entry',
          validations: [{ linkContentType: ['author', 'editor'] }],
        },
      ]),
      createMockContentType('author', 'Author', []),
      createMockContentType('editor', 'Editor', []),
    ];

    const map = createFieldLinkMap(contentTypes, options);

    expect(map.get('product.author')).toEqual({
      linkType: 'Entry',
      possibleTypes: ['ContentfulAuthor', 'ContentfulEditor'],
    });
  });

  it('creates map with array of links to Assets', () => {
    const contentTypes = [
      createMockContentType('product', 'Product', [
        {
          id: 'gallery',
          type: 'Array',
          items: { type: 'Link', linkType: 'Asset', validations: [] },
        },
      ]),
    ];

    const map = createFieldLinkMap(contentTypes, options);

    expect(map.get('product.gallery')).toEqual({
      linkType: 'Asset',
      possibleTypes: ['ContentfulAsset'],
    });
  });

  it('creates map with array of links to Entries with validations', () => {
    const contentTypes = [
      createMockContentType('page', 'Page', [
        {
          id: 'sections',
          type: 'Array',
          items: {
            type: 'Link',
            linkType: 'Entry',
            validations: [
              { linkContentType: ['heroBlock', 'textBlock', 'imageBlock'] },
            ],
          },
        },
      ]),
      createMockContentType('heroBlock', 'Hero Block', []),
      createMockContentType('textBlock', 'Text Block', []),
      createMockContentType('imageBlock', 'Image Block', []),
    ];

    const map = createFieldLinkMap(contentTypes, options);

    expect(map.get('page.sections')).toEqual({
      linkType: 'Entry',
      possibleTypes: [
        'ContentfulHeroBlock',
        'ContentfulTextBlock',
        'ContentfulImageBlock',
      ],
    });
  });

  it('handles entry links without validation (any type)', () => {
    const contentTypes = [
      createMockContentType('product', 'Product', [
        { id: 'related', type: 'Link', linkType: 'Entry' },
      ]),
    ];

    const map = createFieldLinkMap(contentTypes, options);

    expect(map.get('product.related')).toEqual({
      linkType: 'Entry',
      possibleTypes: [], // Empty means any entry type
    });
  });

  it('ignores non-link fields', () => {
    const contentTypes = [
      createMockContentType('product', 'Product', [
        { id: 'title', type: 'Symbol' },
        { id: 'price', type: 'Number' },
        { id: 'tags', type: 'Array', items: { type: 'Symbol' } },
      ]),
    ];

    const map = createFieldLinkMap(contentTypes, options);

    expect(map.size).toBe(0);
  });

  it('uses custom node prefix', () => {
    const customOptions = resolveOptions({
      spaceId: 'test',
      accessToken: 'test',
      nodePrefix: 'CMS',
    });

    const contentTypes = [
      createMockContentType('product', 'Product', [
        { id: 'image', type: 'Link', linkType: 'Asset' },
      ]),
    ];

    const map = createFieldLinkMap(contentTypes, customOptions);

    expect(map.get('product.image')).toEqual({
      linkType: 'Asset',
      possibleTypes: ['CMSAsset'],
    });
  });

  it('handles multiple content types', () => {
    const contentTypes = [
      createMockContentType('product', 'Product', [
        { id: 'image', type: 'Link', linkType: 'Asset' },
      ]),
      createMockContentType('blogPost', 'Blog Post', [
        {
          id: 'author',
          type: 'Link',
          linkType: 'Entry',
          validations: [{ linkContentType: ['author'] }],
        },
        { id: 'coverImage', type: 'Link', linkType: 'Asset' },
      ]),
      createMockContentType('author', 'Author', []),
    ];

    const map = createFieldLinkMap(contentTypes, options);

    expect(map.size).toBe(3);
    expect(map.get('product.image')).toBeDefined();
    expect(map.get('blogPost.author')).toBeDefined();
    expect(map.get('blogPost.coverImage')).toBeDefined();
  });
});
