import { describe, it, expect } from 'vitest';
import {
  contentTypeToNodeTypeName,
  getAssetNodeTypeName,
  parseContentTypeFields,
} from '@/utils/content-types.js';
import type { ContentType, ContentTypeField } from 'contentful';
import type { ResolvedContentfulPluginOptions } from '@/types/index.js';

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
});
