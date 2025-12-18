import { describe, it, expect, vi } from 'vitest';
import {
  contentTypeToNodeTypeName,
  getAssetNodeTypeName,
  parseContentTypeFields,
  toPascalCase,
  parseField,
  fetchContentTypes,
  createContentTypeMap,
  createFieldLinkMap,
} from '@/utils/content-types.js';
import type { ContentType, ContentTypeField } from 'contentful';
import type { ResolvedContentfulPluginOptions } from '@/types/index.js';
import type { ContentfulClient } from '@/client.js';

// Mock options factory
function createMockOptions(
  overrides: Partial<ResolvedContentfulPluginOptions> = {}
): ResolvedContentfulPluginOptions {
  return {
    spaceId: 'test-space',
    accessToken: 'test-token',
    locale: 'en-US',
    host: 'cdn.contentful.com',
    environment: 'master',
    nodePrefix: 'Contentful',
    downloadAssets: false,
    useNameForId: true,
    forceFullSync: false,
    ...overrides,
  };
}

// Mock content type factory
function createMockContentType(
  overrides: Partial<{
    id: string;
    name: string;
    fields: ContentTypeField[];
  }> = {}
): ContentType {
  return {
    sys: {
      id: overrides.id ?? 'blogPost',
      type: 'ContentType',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
      environment: {
        sys: { id: 'master', type: 'Link', linkType: 'Environment' },
      },
      space: { sys: { id: 'test-space', type: 'Link', linkType: 'Space' } },
      revision: 1,
    },
    name: overrides.name ?? 'Blog Post',
    description: 'A blog post',
    displayField: 'title',
    fields: overrides.fields ?? [
      {
        id: 'title',
        name: 'Title',
        type: 'Symbol',
        localized: false,
        required: true,
        disabled: false,
        omitted: false,
        validations: [],
      } as ContentTypeField,
    ],
  } as ContentType;
}

describe('contentTypeToNodeTypeName', () => {
  it('converts content type name to PascalCase with prefix', () => {
    const contentType = createMockContentType({ name: 'Blog Post' });
    const options = createMockOptions();

    const result = contentTypeToNodeTypeName(contentType, options);

    expect(result).toBe('ContentfulBlogPost');
  });

  it('handles single word names', () => {
    const contentType = createMockContentType({ name: 'Author' });
    const options = createMockOptions();

    const result = contentTypeToNodeTypeName(contentType, options);

    expect(result).toBe('ContentfulAuthor');
  });

  it('handles names with multiple spaces', () => {
    const contentType = createMockContentType({ name: 'Featured Blog Post' });
    const options = createMockOptions();

    const result = contentTypeToNodeTypeName(contentType, options);

    expect(result).toBe('ContentfulFeaturedBlogPost');
  });

  it('uses content type ID when useNameForId is false', () => {
    const contentType = createMockContentType({
      id: 'blogPost',
      name: 'Blog Post',
    });
    const options = createMockOptions({ useNameForId: false });

    const result = contentTypeToNodeTypeName(contentType, options);

    expect(result).toBe('ContentfulBlogPost');
  });

  it('uses custom nodePrefix', () => {
    const contentType = createMockContentType({ name: 'Blog Post' });
    const options = createMockOptions({ nodePrefix: 'CMS' });

    const result = contentTypeToNodeTypeName(contentType, options);

    expect(result).toBe('CMSBlogPost');
  });

  it('handles names with special characters', () => {
    const contentType = createMockContentType({ name: 'FAQ & Help' });
    const options = createMockOptions();

    const result = contentTypeToNodeTypeName(contentType, options);

    // Special characters are removed, first letter of each word capitalized
    // "FAQ" stays uppercase because only first char is uppercased, rest preserved
    expect(result).toBe('ContentfulFAQHelp');
  });
});

describe('getAssetNodeTypeName', () => {
  it('returns asset type name with default prefix', () => {
    const options = createMockOptions();

    const result = getAssetNodeTypeName(options);

    expect(result).toBe('ContentfulAsset');
  });

  it('uses custom nodePrefix', () => {
    const options = createMockOptions({ nodePrefix: 'CMS' });

    const result = getAssetNodeTypeName(options);

    expect(result).toBe('CMSAsset');
  });
});

describe('parseContentTypeFields', () => {
  it('parses Symbol field', () => {
    const contentType = createMockContentType({
      fields: [
        {
          id: 'title',
          name: 'Title',
          type: 'Symbol',
          localized: false,
          required: true,
          disabled: false,
          omitted: false,
          validations: [],
        } as ContentTypeField,
      ],
    });

    const result = parseContentTypeFields(contentType);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      id: 'title',
      name: 'Title',
      type: 'string',
      required: true,
      localized: false,
    });
  });

  it('parses Text field', () => {
    const contentType = createMockContentType({
      fields: [
        {
          id: 'body',
          name: 'Body',
          type: 'Text',
          localized: false,
          required: false,
          disabled: false,
          omitted: false,
          validations: [],
        } as ContentTypeField,
      ],
    });

    const result = parseContentTypeFields(contentType);

    expect(result[0]?.type).toBe('string');
  });

  it('parses Integer field', () => {
    const contentType = createMockContentType({
      fields: [
        {
          id: 'count',
          name: 'Count',
          type: 'Integer',
          localized: false,
          required: false,
          disabled: false,
          omitted: false,
          validations: [],
        } as ContentTypeField,
      ],
    });

    const result = parseContentTypeFields(contentType);

    expect(result[0]?.type).toBe('number');
  });

  it('parses Number field', () => {
    const contentType = createMockContentType({
      fields: [
        {
          id: 'price',
          name: 'Price',
          type: 'Number',
          localized: false,
          required: false,
          disabled: false,
          omitted: false,
          validations: [],
        } as ContentTypeField,
      ],
    });

    const result = parseContentTypeFields(contentType);

    expect(result[0]?.type).toBe('number');
  });

  it('parses Boolean field', () => {
    const contentType = createMockContentType({
      fields: [
        {
          id: 'published',
          name: 'Published',
          type: 'Boolean',
          localized: false,
          required: false,
          disabled: false,
          omitted: false,
          validations: [],
        } as ContentTypeField,
      ],
    });

    const result = parseContentTypeFields(contentType);

    expect(result[0]?.type).toBe('boolean');
  });

  it('parses Date field', () => {
    const contentType = createMockContentType({
      fields: [
        {
          id: 'publishedAt',
          name: 'Published At',
          type: 'Date',
          localized: false,
          required: false,
          disabled: false,
          omitted: false,
          validations: [],
        } as ContentTypeField,
      ],
    });

    const result = parseContentTypeFields(contentType);

    expect(result[0]?.type).toBe('date');
  });

  it('parses Array field with Symbol items', () => {
    const contentType = createMockContentType({
      fields: [
        {
          id: 'tags',
          name: 'Tags',
          type: 'Array',
          localized: false,
          required: false,
          disabled: false,
          omitted: false,
          validations: [],
          items: {
            type: 'Symbol',
            validations: [],
          },
        } as ContentTypeField,
      ],
    });

    const result = parseContentTypeFields(contentType);

    expect(result[0]?.type).toBe('array');
    expect(result[0]?.arrayItemType).toBe('string');
  });

  it('skips disabled fields', () => {
    const contentType = createMockContentType({
      fields: [
        {
          id: 'title',
          name: 'Title',
          type: 'Symbol',
          localized: false,
          required: true,
          disabled: true,
          omitted: false,
          validations: [],
        } as ContentTypeField,
      ],
    });

    const result = parseContentTypeFields(contentType);

    expect(result).toHaveLength(0);
  });

  it('skips omitted fields', () => {
    const contentType = createMockContentType({
      fields: [
        {
          id: 'title',
          name: 'Title',
          type: 'Symbol',
          localized: false,
          required: true,
          disabled: false,
          omitted: true,
          validations: [],
        } as ContentTypeField,
      ],
    });

    const result = parseContentTypeFields(contentType);

    expect(result).toHaveLength(0);
  });

  it('parses Location field', () => {
    const contentType = createMockContentType({
      fields: [
        {
          id: 'coordinates',
          name: 'Coordinates',
          type: 'Location',
          localized: false,
          required: false,
          disabled: false,
          omitted: false,
          validations: [],
        } as ContentTypeField,
      ],
    });

    const result = parseContentTypeFields(contentType);

    expect(result[0]?.type).toBe('location');
  });

  it('parses RichText field', () => {
    const contentType = createMockContentType({
      fields: [
        {
          id: 'content',
          name: 'Content',
          type: 'RichText',
          localized: false,
          required: false,
          disabled: false,
          omitted: false,
          validations: [],
        } as ContentTypeField,
      ],
    });

    const result = parseContentTypeFields(contentType);

    expect(result[0]?.type).toBe('richText');
  });

  it('parses Object field', () => {
    const contentType = createMockContentType({
      fields: [
        {
          id: 'metadata',
          name: 'Metadata',
          type: 'Object',
          localized: false,
          required: false,
          disabled: false,
          omitted: false,
          validations: [],
        } as ContentTypeField,
      ],
    });

    const result = parseContentTypeFields(contentType);

    expect(result[0]?.type).toBe('object');
  });

  it('parses Link field to Entry', () => {
    const contentType = createMockContentType({
      fields: [
        {
          id: 'author',
          name: 'Author',
          type: 'Link',
          linkType: 'Entry',
          localized: false,
          required: false,
          disabled: false,
          omitted: false,
          validations: [],
        } as ContentTypeField,
      ],
    });

    const result = parseContentTypeFields(contentType);

    expect(result[0]?.type).toBe('link');
    expect(result[0]?.linkType).toBe('Entry');
  });

  it('parses Link field to Asset', () => {
    const contentType = createMockContentType({
      fields: [
        {
          id: 'image',
          name: 'Image',
          type: 'Link',
          linkType: 'Asset',
          localized: false,
          required: false,
          disabled: false,
          omitted: false,
          validations: [],
        } as ContentTypeField,
      ],
    });

    const result = parseContentTypeFields(contentType);

    expect(result[0]?.type).toBe('link');
    expect(result[0]?.linkType).toBe('Asset');
  });

  it('parses Link field with linkContentType validations', () => {
    const contentType = createMockContentType({
      fields: [
        {
          id: 'author',
          name: 'Author',
          type: 'Link',
          linkType: 'Entry',
          localized: false,
          required: false,
          disabled: false,
          omitted: false,
          validations: [{ linkContentType: ['person', 'organization'] }],
        } as ContentTypeField,
      ],
    });

    const result = parseContentTypeFields(contentType);

    expect(result[0]?.linkContentTypes).toEqual(['person', 'organization']);
  });

  it('handles Link field with empty linkContentType validation', () => {
    const contentType = createMockContentType({
      fields: [
        {
          id: 'author',
          name: 'Author',
          type: 'Link',
          linkType: 'Entry',
          localized: false,
          required: false,
          disabled: false,
          omitted: false,
          validations: [{ linkContentType: [] }],
        } as ContentTypeField,
      ],
    });

    const result = parseContentTypeFields(contentType);

    expect(result[0]?.linkContentTypes).toBeUndefined();
  });

  it('handles Link field without validations property', () => {
    // Create field without validations property by using an object literal
    // and casting through unknown to bypass TypeScript's type checking
    const field = {
      id: 'author',
      name: 'Author',
      type: 'Link',
      linkType: 'Entry',
      localized: false,
      required: false,
      disabled: false,
      omitted: false,
    } as unknown as ContentTypeField;

    const contentType = createMockContentType({
      fields: [field],
    });

    const result = parseContentTypeFields(contentType);

    expect(result[0]?.linkContentTypes).toBeUndefined();
  });

  it('parses Array of Link to Entry', () => {
    const contentType = createMockContentType({
      fields: [
        {
          id: 'relatedPosts',
          name: 'Related Posts',
          type: 'Array',
          localized: false,
          required: false,
          disabled: false,
          omitted: false,
          validations: [],
          items: {
            type: 'Link',
            linkType: 'Entry',
            validations: [],
          },
        } as ContentTypeField,
      ],
    });

    const result = parseContentTypeFields(contentType);

    expect(result[0]?.type).toBe('array');
    expect(result[0]?.arrayItemType).toBe('link');
    expect(result[0]?.arrayLinkType).toBe('Entry');
  });

  it('parses Array of Link to Asset', () => {
    const contentType = createMockContentType({
      fields: [
        {
          id: 'gallery',
          name: 'Gallery',
          type: 'Array',
          localized: false,
          required: false,
          disabled: false,
          omitted: false,
          validations: [],
          items: {
            type: 'Link',
            linkType: 'Asset',
            validations: [],
          },
        } as ContentTypeField,
      ],
    });

    const result = parseContentTypeFields(contentType);

    expect(result[0]?.type).toBe('array');
    expect(result[0]?.arrayItemType).toBe('link');
    expect(result[0]?.arrayLinkType).toBe('Asset');
  });

  it('parses Array of Link with content type restrictions', () => {
    const contentType = createMockContentType({
      fields: [
        {
          id: 'sections',
          name: 'Sections',
          type: 'Array',
          localized: false,
          required: false,
          disabled: false,
          omitted: false,
          validations: [],
          items: {
            type: 'Link',
            linkType: 'Entry',
            validations: [{ linkContentType: ['heroBlock', 'textBlock'] }],
          },
        } as ContentTypeField,
      ],
    });

    const result = parseContentTypeFields(contentType);

    expect(result[0]?.arrayLinkContentTypes).toEqual([
      'heroBlock',
      'textBlock',
    ]);
  });

  it('handles Array of Link with empty content type validation', () => {
    const contentType = createMockContentType({
      fields: [
        {
          id: 'sections',
          name: 'Sections',
          type: 'Array',
          localized: false,
          required: false,
          disabled: false,
          omitted: false,
          validations: [],
          items: {
            type: 'Link',
            linkType: 'Entry',
            validations: [{ linkContentType: [] }],
          },
        } as ContentTypeField,
      ],
    });

    const result = parseContentTypeFields(contentType);

    expect(result[0]?.arrayLinkContentTypes).toBeUndefined();
  });

  it('handles unknown field type', () => {
    const contentType = createMockContentType({
      fields: [
        {
          id: 'unknown',
          name: 'Unknown',
          type: 'UnknownType' as ContentTypeField['type'],
          localized: false,
          required: false,
          disabled: false,
          omitted: false,
          validations: [],
        } as ContentTypeField,
      ],
    });

    const result = parseContentTypeFields(contentType);

    expect(result[0]?.type).toBe('unknown');
  });
});

describe('toPascalCase', () => {
  it('converts space-separated words to PascalCase', () => {
    expect(toPascalCase('blog post')).toBe('BlogPost');
  });

  it('converts hyphen-separated words to PascalCase', () => {
    expect(toPascalCase('blog-post')).toBe('BlogPost');
  });

  it('converts underscore-separated words to PascalCase', () => {
    expect(toPascalCase('blog_post')).toBe('BlogPost');
  });

  it('removes special characters', () => {
    expect(toPascalCase('Blog Post!')).toBe('BlogPost');
  });

  it('handles single word', () => {
    expect(toPascalCase('blog')).toBe('Blog');
  });

  it('handles mixed separators', () => {
    expect(toPascalCase('blog-post_item number')).toBe('BlogPostItemNumber');
  });
});

describe('parseField', () => {
  it('parses a basic field with all properties', () => {
    const field: ContentTypeField = {
      id: 'title',
      name: 'Title Field',
      type: 'Symbol',
      localized: true,
      required: true,
      disabled: false,
      omitted: false,
      validations: [],
    };

    const result = parseField(field);

    expect(result).toEqual({
      id: 'title',
      name: 'Title Field',
      type: 'string',
      required: true,
      localized: true,
    });
  });

  it('handles Link field without linkType', () => {
    const field: ContentTypeField = {
      id: 'ref',
      name: 'Reference',
      type: 'Link',
      localized: false,
      required: false,
      disabled: false,
      omitted: false,
      validations: [],
    };

    const result = parseField(field);

    expect(result.type).toBe('link');
    expect(result.linkType).toBeUndefined();
  });

  it('handles Array field without items', () => {
    const field: ContentTypeField = {
      id: 'items',
      name: 'Items',
      type: 'Array',
      localized: false,
      required: false,
      disabled: false,
      omitted: false,
      validations: [],
    };

    const result = parseField(field);

    expect(result.type).toBe('array');
    expect(result.arrayItemType).toBeUndefined();
  });
});

describe('fetchContentTypes', () => {
  it('fetches content types from client', async () => {
    const mockContentTypes = [
      createMockContentType({ id: 'blogPost', name: 'Blog Post' }),
      createMockContentType({ id: 'author', name: 'Author' }),
    ];

    const mockClient = {
      getContentTypes: vi.fn().mockResolvedValue({ items: mockContentTypes }),
    } as unknown as ContentfulClient;

    const options = createMockOptions();

    const result = await fetchContentTypes(mockClient, options);

    expect(mockClient.getContentTypes).toHaveBeenCalled();
    expect(result).toEqual(mockContentTypes);
  });

  it('applies content type filter when provided', async () => {
    const mockContentTypes = [
      createMockContentType({ id: 'blogPost', name: 'Blog Post' }),
      createMockContentType({ id: 'author', name: 'Author' }),
    ];

    const mockClient = {
      getContentTypes: vi.fn().mockResolvedValue({ items: mockContentTypes }),
    } as unknown as ContentfulClient;

    const options = createMockOptions({
      contentTypeFilter: (ct) => ct.sys.id === 'blogPost',
    });

    const result = await fetchContentTypes(mockClient, options);

    expect(result).toHaveLength(1);
    expect(result[0]?.sys.id).toBe('blogPost');
  });
});

describe('createContentTypeMap', () => {
  it('creates a map from content type ID to node type name', () => {
    const contentTypes = [
      createMockContentType({ id: 'blogPost', name: 'Blog Post' }),
      createMockContentType({ id: 'author', name: 'Author' }),
    ];
    const options = createMockOptions();

    const result = createContentTypeMap(contentTypes, options);

    expect(result.get('blogPost')).toBe('ContentfulBlogPost');
    expect(result.get('author')).toBe('ContentfulAuthor');
  });

  it('uses custom nodePrefix', () => {
    const contentTypes = [
      createMockContentType({ id: 'blogPost', name: 'Blog Post' }),
    ];
    const options = createMockOptions({ nodePrefix: 'CMS' });

    const result = createContentTypeMap(contentTypes, options);

    expect(result.get('blogPost')).toBe('CMSBlogPost');
  });

  it('returns empty map for empty content types array', () => {
    const options = createMockOptions();

    const result = createContentTypeMap([], options);

    expect(result.size).toBe(0);
  });
});

describe('createFieldLinkMap', () => {
  it('creates map for single Link field to Asset', () => {
    const contentTypes = [
      createMockContentType({
        id: 'blogPost',
        name: 'Blog Post',
        fields: [
          {
            id: 'image',
            name: 'Image',
            type: 'Link',
            linkType: 'Asset',
            localized: false,
            required: false,
            disabled: false,
            omitted: false,
            validations: [],
          } as ContentTypeField,
        ],
      }),
    ];
    const options = createMockOptions();

    const result = createFieldLinkMap(contentTypes, options);

    expect(result.get('blogPost.image')).toEqual({
      linkType: 'Asset',
      possibleTypes: ['ContentfulAsset'],
    });
  });

  it('creates map for single Link field to Entry without restrictions', () => {
    const contentTypes = [
      createMockContentType({
        id: 'blogPost',
        name: 'Blog Post',
        fields: [
          {
            id: 'author',
            name: 'Author',
            type: 'Link',
            linkType: 'Entry',
            localized: false,
            required: false,
            disabled: false,
            omitted: false,
            validations: [],
          } as ContentTypeField,
        ],
      }),
    ];
    const options = createMockOptions();

    const result = createFieldLinkMap(contentTypes, options);

    expect(result.get('blogPost.author')).toEqual({
      linkType: 'Entry',
      possibleTypes: [],
    });
  });

  it('creates map for single Link field to Entry with content type restrictions', () => {
    const contentTypes = [
      createMockContentType({
        id: 'blogPost',
        name: 'Blog Post',
        fields: [
          {
            id: 'author',
            name: 'Author',
            type: 'Link',
            linkType: 'Entry',
            localized: false,
            required: false,
            disabled: false,
            omitted: false,
            validations: [{ linkContentType: ['person'] }],
          } as ContentTypeField,
        ],
      }),
      createMockContentType({
        id: 'person',
        name: 'Person',
        fields: [],
      }),
    ];
    const options = createMockOptions();

    const result = createFieldLinkMap(contentTypes, options);

    expect(result.get('blogPost.author')).toEqual({
      linkType: 'Entry',
      possibleTypes: ['ContentfulPerson'],
    });
  });

  it('creates map for Array of Link to Asset', () => {
    const contentTypes = [
      createMockContentType({
        id: 'blogPost',
        name: 'Blog Post',
        fields: [
          {
            id: 'gallery',
            name: 'Gallery',
            type: 'Array',
            localized: false,
            required: false,
            disabled: false,
            omitted: false,
            validations: [],
            items: {
              type: 'Link',
              linkType: 'Asset',
              validations: [],
            },
          } as ContentTypeField,
        ],
      }),
    ];
    const options = createMockOptions();

    const result = createFieldLinkMap(contentTypes, options);

    expect(result.get('blogPost.gallery')).toEqual({
      linkType: 'Asset',
      possibleTypes: ['ContentfulAsset'],
    });
  });

  it('creates map for Array of Link to Entry without restrictions', () => {
    const contentTypes = [
      createMockContentType({
        id: 'blogPost',
        name: 'Blog Post',
        fields: [
          {
            id: 'relatedPosts',
            name: 'Related Posts',
            type: 'Array',
            localized: false,
            required: false,
            disabled: false,
            omitted: false,
            validations: [],
            items: {
              type: 'Link',
              linkType: 'Entry',
              validations: [],
            },
          } as ContentTypeField,
        ],
      }),
    ];
    const options = createMockOptions();

    const result = createFieldLinkMap(contentTypes, options);

    expect(result.get('blogPost.relatedPosts')).toEqual({
      linkType: 'Entry',
      possibleTypes: [],
    });
  });

  it('creates map for Array of Link to Entry with content type restrictions', () => {
    const contentTypes = [
      createMockContentType({
        id: 'page',
        name: 'Page',
        fields: [
          {
            id: 'sections',
            name: 'Sections',
            type: 'Array',
            localized: false,
            required: false,
            disabled: false,
            omitted: false,
            validations: [],
            items: {
              type: 'Link',
              linkType: 'Entry',
              validations: [{ linkContentType: ['heroBlock', 'textBlock'] }],
            },
          } as ContentTypeField,
        ],
      }),
      createMockContentType({
        id: 'heroBlock',
        name: 'Hero Block',
        fields: [],
      }),
      createMockContentType({
        id: 'textBlock',
        name: 'Text Block',
        fields: [],
      }),
    ];
    const options = createMockOptions();

    const result = createFieldLinkMap(contentTypes, options);

    expect(result.get('page.sections')).toEqual({
      linkType: 'Entry',
      possibleTypes: ['ContentfulHeroBlock', 'ContentfulTextBlock'],
    });
  });

  it('does not include non-link fields', () => {
    const contentTypes = [
      createMockContentType({
        id: 'blogPost',
        name: 'Blog Post',
        fields: [
          {
            id: 'title',
            name: 'Title',
            type: 'Symbol',
            localized: false,
            required: true,
            disabled: false,
            omitted: false,
            validations: [],
          } as ContentTypeField,
        ],
      }),
    ];
    const options = createMockOptions();

    const result = createFieldLinkMap(contentTypes, options);

    expect(result.has('blogPost.title')).toBe(false);
  });

  it('filters out unknown content type references', () => {
    const contentTypes = [
      createMockContentType({
        id: 'blogPost',
        name: 'Blog Post',
        fields: [
          {
            id: 'author',
            name: 'Author',
            type: 'Link',
            linkType: 'Entry',
            localized: false,
            required: false,
            disabled: false,
            omitted: false,
            validations: [{ linkContentType: ['person', 'unknownType'] }],
          } as ContentTypeField,
        ],
      }),
      createMockContentType({ id: 'person', name: 'Person', fields: [] }),
    ];
    const options = createMockOptions();

    const result = createFieldLinkMap(contentTypes, options);

    // Only 'person' should be in possibleTypes since 'unknownType' is not in contentTypes
    expect(result.get('blogPost.author')).toEqual({
      linkType: 'Entry',
      possibleTypes: ['ContentfulPerson'],
    });
  });

  it('skips disabled and omitted fields', () => {
    const contentTypes = [
      createMockContentType({
        id: 'blogPost',
        name: 'Blog Post',
        fields: [
          {
            id: 'oldImage',
            name: 'Old Image',
            type: 'Link',
            linkType: 'Asset',
            localized: false,
            required: false,
            disabled: true,
            omitted: false,
            validations: [],
          } as ContentTypeField,
          {
            id: 'hiddenRef',
            name: 'Hidden Ref',
            type: 'Link',
            linkType: 'Entry',
            localized: false,
            required: false,
            disabled: false,
            omitted: true,
            validations: [],
          } as ContentTypeField,
        ],
      }),
    ];
    const options = createMockOptions();

    const result = createFieldLinkMap(contentTypes, options);

    expect(result.has('blogPost.oldImage')).toBe(false);
    expect(result.has('blogPost.hiddenRef')).toBe(false);
  });

  it('handles Array of Symbol (non-link array)', () => {
    const contentTypes = [
      createMockContentType({
        id: 'blogPost',
        name: 'Blog Post',
        fields: [
          {
            id: 'tags',
            name: 'Tags',
            type: 'Array',
            localized: false,
            required: false,
            disabled: false,
            omitted: false,
            validations: [],
            items: {
              type: 'Symbol',
              validations: [],
            },
          } as ContentTypeField,
        ],
      }),
    ];
    const options = createMockOptions();

    const result = createFieldLinkMap(contentTypes, options);

    expect(result.has('blogPost.tags')).toBe(false);
  });
});
