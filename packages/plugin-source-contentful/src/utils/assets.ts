import type { Asset, AssetFields } from 'contentful';
import type { ResolvedContentfulPluginOptions } from '@/types/index.js';
import { getAssetNodeTypeName } from './content-types.js';

/**
 * Context passed to asset transformation functions.
 */
export interface AssetTransformContext {
  /** Function to create deterministic node IDs */
  createNodeId: (...args: string[]) => string;
  /** Function to create content digests for change detection */
  createContentDigest: (data: unknown) => string;
  /** Resolved plugin options */
  options: ResolvedContentfulPluginOptions;
}

/**
 * The structure of a transformed asset ready for node creation.
 */
export interface TransformedAsset {
  internal: {
    id: string;
    type: string;
    owner: string;
    contentDigest: string;
  };
  /** Original Contentful asset ID */
  contentfulId: string;
  /** Contentful sys metadata */
  sys: {
    id: string;
    type: 'Asset';
    createdAt: string;
    updatedAt: string;
    revision: number;
    locale?: string;
  };
  /** Asset title */
  title: string | null;
  /** Asset description */
  description: string | null;
  /** File information */
  file: {
    url: string;
    fileName: string;
    contentType: string;
    details: {
      size: number;
      image?: {
        width: number;
        height: number;
      };
    };
  } | null;
  /** Asset MIME type category */
  mimeType: string | null;
  /** Full URL with protocol */
  url: string | null;
  /** Image dimensions (if applicable) */
  width: number | null;
  height: number | null;
  /** Index signature for CreateNodeInput compatibility */
  [key: string]: unknown;
}

/**
 * Extracts MIME type category from content type string.
 */
function getMimeTypeCategory(contentType: string): string {
  if (contentType.startsWith('image/')) return 'image';
  if (contentType.startsWith('video/')) return 'video';
  if (contentType.startsWith('audio/')) return 'audio';
  if (contentType.startsWith('text/')) return 'text';
  if (contentType === 'application/pdf') return 'pdf';
  if (
    contentType === 'application/zip' ||
    contentType === 'application/x-rar-compressed' ||
    contentType === 'application/gzip'
  ) {
    return 'archive';
  }
  if (
    contentType ===
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    contentType === 'application/vnd.ms-excel'
  ) {
    return 'spreadsheet';
  }
  if (
    contentType ===
      'application/vnd.openxmlformats-officedocument.presentationml.presentation' ||
    contentType === 'application/vnd.ms-powerpoint'
  ) {
    return 'presentation';
  }
  if (
    contentType ===
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    contentType === 'application/msword'
  ) {
    return 'document';
  }
  return 'other';
}

/**
 * Normalizes a Contentful asset URL to include the protocol.
 */
function normalizeAssetUrl(url: string): string {
  if (url.startsWith('//')) {
    return `https:${url}`;
  }
  return url;
}

/**
 * Gets asset fields handling both localized and non-localized responses.
 * The Contentful SDK can return fields in different formats depending on configuration.
 */
function getAssetFields(asset: Asset): AssetFields {
  // With the default client configuration, fields should be directly accessible
  return asset.fields as AssetFields;
}

/**
 * Transforms a Contentful asset into a structure ready for UDL node creation.
 *
 * @param asset - The Contentful asset
 * @param context - Transformation context
 * @returns Transformed asset ready for `actions.createNode()`
 */
export function transformAsset(
  asset: Asset,
  context: AssetTransformContext
): TransformedAsset {
  const { createNodeId, createContentDigest, options } = context;

  const nodeTypeName = getAssetNodeTypeName(options);
  const nodeId = createNodeId(nodeTypeName, asset.sys.id);

  const fields = getAssetFields(asset);
  const file = fields.file;

  const sysData: TransformedAsset['sys'] = {
    id: asset.sys.id,
    type: 'Asset',
    createdAt: asset.sys.createdAt,
    updatedAt: asset.sys.updatedAt,
    revision: asset.sys.revision,
  };

  // Only add locale if it exists
  if (asset.sys.locale) {
    sysData.locale = asset.sys.locale;
  }

  return {
    internal: {
      id: nodeId,
      type: nodeTypeName,
      owner: '@udl/plugin-source-contentful',
      contentDigest: createContentDigest(asset),
    },
    contentfulId: asset.sys.id,
    sys: sysData,
    title: fields.title ?? null,
    description: fields.description ?? null,
    file: file
      ? {
          url: normalizeAssetUrl(file.url),
          fileName: file.fileName,
          contentType: file.contentType,
          details: file.details,
        }
      : null,
    mimeType: file ? getMimeTypeCategory(file.contentType) : null,
    url: file ? normalizeAssetUrl(file.url) : null,
    width: file?.details.image?.width ?? null,
    height: file?.details.image?.height ?? null,
  };
}

/**
 * Gets the node ID for a Contentful asset (for deletion).
 *
 * @param assetId - The Contentful asset sys.id
 * @param context - Transformation context
 * @returns The UDL node ID
 */
export function getAssetNodeId(
  assetId: string,
  context: AssetTransformContext
): string {
  const { createNodeId, options } = context;
  const nodeTypeName = getAssetNodeTypeName(options);
  return createNodeId(nodeTypeName, assetId);
}
