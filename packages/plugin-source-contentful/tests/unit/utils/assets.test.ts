import { describe, it, expect } from 'vitest';
import type { Asset } from 'contentful';
import {
  transformAsset,
  getAssetNodeId,
  type AssetTransformContext,
} from '@/utils/assets.js';

// Helper to create a minimal Asset object
function createMockAsset(overrides: Partial<Asset> = {}): Asset {
  return {
    sys: {
      id: 'asset123',
      type: 'Asset',
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-02T00:00:00.000Z',
      revision: 1,
      space: { sys: { type: 'Link', linkType: 'Space', id: 'space123' } },
      environment: {
        sys: { type: 'Link', linkType: 'Environment', id: 'master' },
      },
      ...overrides.sys,
    },
    fields: {
      title: 'Test Asset',
      description: 'A test asset description',
      file: {
        url: '//images.ctfassets.net/test/image.jpg',
        fileName: 'image.jpg',
        contentType: 'image/jpeg',
        details: {
          size: 12345,
          image: {
            width: 800,
            height: 600,
          },
        },
      },
      ...overrides.fields,
    },
    metadata: {
      tags: [],
      concepts: [],
      ...overrides.metadata,
    },
    ...overrides,
  } as Asset;
}

// Helper to create a mock context
function createMockContext(
  overrides: Partial<AssetTransformContext> = {}
): AssetTransformContext {
  return {
    createNodeId: (...args: string[]) => args.join('-'),
    createContentDigest: (data: unknown) =>
      `digest-${JSON.stringify(data).length}`,
    options: {
      spaceId: 'space123',
      accessToken: 'token123',
      host: 'cdn.contentful.com',
      environment: 'master',
      nodePrefix: 'Contentful',
      locale: 'en-US',
      useNameForId: true,
      downloadAssets: false,
      forceFullSync: false,
    },
    ...overrides,
  };
}

describe('transformAsset', () => {
  describe('basic transformation', () => {
    it('transforms an asset with all fields', () => {
      const asset = createMockAsset();
      const context = createMockContext();

      const result = transformAsset(asset, context);

      expect(result.internal.id).toBe('ContentfulAsset-asset123');
      expect(result.internal.type).toBe('ContentfulAsset');
      expect(result.internal.owner).toBe(
        '@universal-data-layer/plugin-source-contentful'
      );
      expect(result.internal.contentDigest).toBeDefined();
      expect(result.contentfulId).toBe('asset123');
    });

    it('includes sys metadata', () => {
      const asset = createMockAsset();
      const context = createMockContext();

      const result = transformAsset(asset, context);

      expect(result.sys).toEqual({
        id: 'asset123',
        type: 'Asset',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-02T00:00:00.000Z',
        revision: 1,
      });
    });

    it('includes locale in sys when present', () => {
      const asset = createMockAsset({
        sys: {
          id: 'asset123',
          type: 'Asset',
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-02T00:00:00.000Z',
          revision: 1,
          publishedVersion: 1,
          locale: 'en-US',
          space: { sys: { type: 'Link', linkType: 'Space', id: 'space123' } },
          environment: {
            sys: { type: 'Link', linkType: 'Environment', id: 'master' },
          },
        },
      });
      const context = createMockContext();

      const result = transformAsset(asset, context);

      expect(result.sys.locale).toBe('en-US');
    });

    it('does not include locale in sys when not present', () => {
      const asset = createMockAsset();
      const context = createMockContext();

      const result = transformAsset(asset, context);

      expect(result.sys.locale).toBeUndefined();
    });
  });

  describe('file handling', () => {
    it('transforms file information correctly', () => {
      const asset = createMockAsset();
      const context = createMockContext();

      const result = transformAsset(asset, context);

      expect(result.file).toEqual({
        url: 'https://images.ctfassets.net/test/image.jpg',
        fileName: 'image.jpg',
        contentType: 'image/jpeg',
        details: {
          size: 12345,
          image: {
            width: 800,
            height: 600,
          },
        },
      });
    });

    it('sets file to null when file is missing', () => {
      const asset = createMockAsset({
        fields: {
          title: 'No file asset',
          description: 'An asset without a file',
        },
      });
      const context = createMockContext();

      const result = transformAsset(asset, context);

      expect(result.file).toBeNull();
      expect(result.mimeType).toBeNull();
      expect(result.url).toBeNull();
      expect(result.width).toBeNull();
      expect(result.height).toBeNull();
    });

    it('handles asset with file but no image dimensions', () => {
      const asset = createMockAsset({
        fields: {
          title: 'PDF document',
          description: 'A PDF file',
          file: {
            url: '//assets.ctfassets.net/test/document.pdf',
            fileName: 'document.pdf',
            contentType: 'application/pdf',
            details: {
              size: 54321,
            },
          },
        },
      });
      const context = createMockContext();

      const result = transformAsset(asset, context);

      expect(result.file).toEqual({
        url: 'https://assets.ctfassets.net/test/document.pdf',
        fileName: 'document.pdf',
        contentType: 'application/pdf',
        details: {
          size: 54321,
        },
      });
      expect(result.width).toBeNull();
      expect(result.height).toBeNull();
      expect(result.mimeType).toBe('pdf');
    });

    it('extracts image dimensions when present', () => {
      const asset = createMockAsset();
      const context = createMockContext();

      const result = transformAsset(asset, context);

      expect(result.width).toBe(800);
      expect(result.height).toBe(600);
    });
  });

  describe('URL normalization', () => {
    it('adds https: prefix to protocol-relative URLs', () => {
      const asset = createMockAsset();
      const context = createMockContext();

      const result = transformAsset(asset, context);

      expect(result.url).toBe('https://images.ctfassets.net/test/image.jpg');
    });

    it('preserves URLs that already have a protocol', () => {
      const asset = createMockAsset({
        fields: {
          title: 'Test Asset',
          description: 'A test asset',
          file: {
            url: 'https://example.com/image.jpg',
            fileName: 'image.jpg',
            contentType: 'image/jpeg',
            details: {
              size: 1000,
              image: { width: 100, height: 100 },
            },
          },
        },
      });
      const context = createMockContext();

      const result = transformAsset(asset, context);

      expect(result.url).toBe('https://example.com/image.jpg');
    });
  });

  describe('MIME type detection', () => {
    it('detects image MIME types', () => {
      const asset = createMockAsset();
      const context = createMockContext();

      const result = transformAsset(asset, context);

      expect(result.mimeType).toBe('image');
    });

    it('detects video MIME types', () => {
      const asset = createMockAsset({
        fields: {
          title: 'Video',
          file: {
            url: '//test.com/video.mp4',
            fileName: 'video.mp4',
            contentType: 'video/mp4',
            details: { size: 1000 },
          },
        },
      });
      const context = createMockContext();

      const result = transformAsset(asset, context);

      expect(result.mimeType).toBe('video');
    });

    it('detects audio MIME types', () => {
      const asset = createMockAsset({
        fields: {
          title: 'Audio',
          file: {
            url: '//test.com/audio.mp3',
            fileName: 'audio.mp3',
            contentType: 'audio/mpeg',
            details: { size: 1000 },
          },
        },
      });
      const context = createMockContext();

      const result = transformAsset(asset, context);

      expect(result.mimeType).toBe('audio');
    });

    it('detects text MIME types', () => {
      const asset = createMockAsset({
        fields: {
          title: 'Text',
          file: {
            url: '//test.com/file.txt',
            fileName: 'file.txt',
            contentType: 'text/plain',
            details: { size: 1000 },
          },
        },
      });
      const context = createMockContext();

      const result = transformAsset(asset, context);

      expect(result.mimeType).toBe('text');
    });

    it('detects PDF MIME type', () => {
      const asset = createMockAsset({
        fields: {
          title: 'PDF',
          file: {
            url: '//test.com/doc.pdf',
            fileName: 'doc.pdf',
            contentType: 'application/pdf',
            details: { size: 1000 },
          },
        },
      });
      const context = createMockContext();

      const result = transformAsset(asset, context);

      expect(result.mimeType).toBe('pdf');
    });

    it('detects archive MIME types (zip)', () => {
      const asset = createMockAsset({
        fields: {
          title: 'Archive',
          file: {
            url: '//test.com/archive.zip',
            fileName: 'archive.zip',
            contentType: 'application/zip',
            details: { size: 1000 },
          },
        },
      });
      const context = createMockContext();

      const result = transformAsset(asset, context);

      expect(result.mimeType).toBe('archive');
    });

    it('detects archive MIME types (rar)', () => {
      const asset = createMockAsset({
        fields: {
          title: 'Archive',
          file: {
            url: '//test.com/archive.rar',
            fileName: 'archive.rar',
            contentType: 'application/x-rar-compressed',
            details: { size: 1000 },
          },
        },
      });
      const context = createMockContext();

      const result = transformAsset(asset, context);

      expect(result.mimeType).toBe('archive');
    });

    it('detects archive MIME types (gzip)', () => {
      const asset = createMockAsset({
        fields: {
          title: 'Archive',
          file: {
            url: '//test.com/archive.gz',
            fileName: 'archive.gz',
            contentType: 'application/gzip',
            details: { size: 1000 },
          },
        },
      });
      const context = createMockContext();

      const result = transformAsset(asset, context);

      expect(result.mimeType).toBe('archive');
    });

    it('detects spreadsheet MIME types (xlsx)', () => {
      const asset = createMockAsset({
        fields: {
          title: 'Spreadsheet',
          file: {
            url: '//test.com/sheet.xlsx',
            fileName: 'sheet.xlsx',
            contentType:
              'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            details: { size: 1000 },
          },
        },
      });
      const context = createMockContext();

      const result = transformAsset(asset, context);

      expect(result.mimeType).toBe('spreadsheet');
    });

    it('detects spreadsheet MIME types (xls)', () => {
      const asset = createMockAsset({
        fields: {
          title: 'Spreadsheet',
          file: {
            url: '//test.com/sheet.xls',
            fileName: 'sheet.xls',
            contentType: 'application/vnd.ms-excel',
            details: { size: 1000 },
          },
        },
      });
      const context = createMockContext();

      const result = transformAsset(asset, context);

      expect(result.mimeType).toBe('spreadsheet');
    });

    it('detects presentation MIME types (pptx)', () => {
      const asset = createMockAsset({
        fields: {
          title: 'Presentation',
          file: {
            url: '//test.com/slides.pptx',
            fileName: 'slides.pptx',
            contentType:
              'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            details: { size: 1000 },
          },
        },
      });
      const context = createMockContext();

      const result = transformAsset(asset, context);

      expect(result.mimeType).toBe('presentation');
    });

    it('detects presentation MIME types (ppt)', () => {
      const asset = createMockAsset({
        fields: {
          title: 'Presentation',
          file: {
            url: '//test.com/slides.ppt',
            fileName: 'slides.ppt',
            contentType: 'application/vnd.ms-powerpoint',
            details: { size: 1000 },
          },
        },
      });
      const context = createMockContext();

      const result = transformAsset(asset, context);

      expect(result.mimeType).toBe('presentation');
    });

    it('detects document MIME types (docx)', () => {
      const asset = createMockAsset({
        fields: {
          title: 'Document',
          file: {
            url: '//test.com/doc.docx',
            fileName: 'doc.docx',
            contentType:
              'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            details: { size: 1000 },
          },
        },
      });
      const context = createMockContext();

      const result = transformAsset(asset, context);

      expect(result.mimeType).toBe('document');
    });

    it('detects document MIME types (doc)', () => {
      const asset = createMockAsset({
        fields: {
          title: 'Document',
          file: {
            url: '//test.com/doc.doc',
            fileName: 'doc.doc',
            contentType: 'application/msword',
            details: { size: 1000 },
          },
        },
      });
      const context = createMockContext();

      const result = transformAsset(asset, context);

      expect(result.mimeType).toBe('document');
    });

    it('returns other for unknown MIME types', () => {
      const asset = createMockAsset({
        fields: {
          title: 'Unknown',
          file: {
            url: '//test.com/file.bin',
            fileName: 'file.bin',
            contentType: 'application/octet-stream',
            details: { size: 1000 },
          },
        },
      });
      const context = createMockContext();

      const result = transformAsset(asset, context);

      expect(result.mimeType).toBe('other');
    });
  });

  describe('locale handling', () => {
    it('extracts fields from locale-keyed objects', () => {
      const asset = createMockAsset({
        fields: {
          title: { 'en-US': 'English Title' },
          description: { 'en-US': 'English Description' },
          file: {
            'en-US': {
              url: '//test.com/image.jpg',
              fileName: 'image.jpg',
              contentType: 'image/jpeg',
              details: { size: 1000 },
            },
          },
        } as unknown as Asset['fields'],
      });
      const context = createMockContext();

      const result = transformAsset(asset, context);

      expect(result.title).toBe('English Title');
      expect(result.description).toBe('English Description');
      expect(result.file?.fileName).toBe('image.jpg');
    });

    it('handles non-localized fields', () => {
      const asset = createMockAsset({
        fields: {
          title: 'Direct Title',
          description: 'Direct Description',
          file: {
            url: '//test.com/image.jpg',
            fileName: 'image.jpg',
            contentType: 'image/jpeg',
            details: { size: 1000 },
          },
        },
      });
      const context = createMockContext();

      const result = transformAsset(asset, context);

      expect(result.title).toBe('Direct Title');
      expect(result.description).toBe('Direct Description');
    });

    it('returns value as-is when locale key is not found (not recognized as locale-keyed)', () => {
      // When the requested locale (en-US) is not in the object,
      // isLocaleKeyedObject returns false and the value is returned as-is
      const asset = createMockAsset({
        fields: {
          title: { 'de-DE': 'German Title' },
          description: { 'de-DE': 'German Description' },
        } as unknown as Asset['fields'],
      });
      const context = createMockContext();

      const result = transformAsset(asset, context);

      // Since en-US is not in the object, it's not recognized as locale-keyed
      // and the entire object is returned (which won't match string type)
      expect(result.title).toEqual({ 'de-DE': 'German Title' });
      expect(result.description).toEqual({ 'de-DE': 'German Description' });
    });

    it('returns null when locale exists but value is undefined', () => {
      const asset = createMockAsset({
        fields: {
          title: { 'en-US': undefined },
          description: { 'en-US': undefined },
          file: {
            url: '//test.com/image.jpg',
            fileName: 'image.jpg',
            contentType: 'image/jpeg',
            details: { size: 1000 },
          },
        } as unknown as Asset['fields'],
      });
      const context = createMockContext();

      const result = transformAsset(asset, context);

      expect(result.title).toBeNull();
      expect(result.description).toBeNull();
    });

    it('respects the locale option', () => {
      const asset = createMockAsset({
        fields: {
          title: { 'de-DE': 'German Title', 'en-US': 'English Title' },
          description: { 'de-DE': 'German Desc', 'en-US': 'English Desc' },
          file: {
            'de-DE': {
              url: '//test.com/de.jpg',
              fileName: 'de.jpg',
              contentType: 'image/jpeg',
              details: { size: 1000 },
            },
            'en-US': {
              url: '//test.com/en.jpg',
              fileName: 'en.jpg',
              contentType: 'image/jpeg',
              details: { size: 1000 },
            },
          },
        } as unknown as Asset['fields'],
      });
      const context = createMockContext({
        options: {
          ...createMockContext().options,
          locale: 'de-DE',
        },
      });

      const result = transformAsset(asset, context);

      expect(result.title).toBe('German Title');
      expect(result.description).toBe('German Desc');
      expect(result.file?.fileName).toBe('de.jpg');
    });
  });

  describe('field defaults', () => {
    it('sets title to null when missing', () => {
      const asset = createMockAsset({
        fields: {
          file: {
            url: '//test.com/image.jpg',
            fileName: 'image.jpg',
            contentType: 'image/jpeg',
            details: { size: 1000 },
          },
        },
      });
      const context = createMockContext();

      const result = transformAsset(asset, context);

      expect(result.title).toBeNull();
    });

    it('sets description to null when missing', () => {
      const asset = createMockAsset({
        fields: {
          title: 'Title',
          file: {
            url: '//test.com/image.jpg',
            fileName: 'image.jpg',
            contentType: 'image/jpeg',
            details: { size: 1000 },
          },
        },
      });
      const context = createMockContext();

      const result = transformAsset(asset, context);

      expect(result.description).toBeNull();
    });
  });

  describe('custom node prefix', () => {
    it('uses custom nodePrefix for type name', () => {
      const asset = createMockAsset();
      const context = createMockContext({
        options: {
          ...createMockContext().options,
          nodePrefix: 'CMS',
        },
      });

      const result = transformAsset(asset, context);

      expect(result.internal.type).toBe('CMSAsset');
      expect(result.internal.id).toBe('CMSAsset-asset123');
    });
  });
});

describe('getAssetNodeId', () => {
  it('returns the correct node ID for an asset', () => {
    const context = createMockContext();
    const result = getAssetNodeId('asset456', context);

    expect(result).toBe('ContentfulAsset-asset456');
  });

  it('uses custom nodePrefix', () => {
    const context = createMockContext({
      options: {
        ...createMockContext().options,
        nodePrefix: 'MyPrefix',
      },
    });

    const result = getAssetNodeId('asset789', context);

    expect(result).toBe('MyPrefixAsset-asset789');
  });
});
