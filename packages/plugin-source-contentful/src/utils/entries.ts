import type { Entry, EntrySkeletonType, UnresolvedLink } from 'contentful';
import type { ResolvedContentfulPluginOptions } from '@/types/index.js';

/**
 * Context passed to entry transformation functions.
 */
export interface EntryTransformContext {
  /** Function to create deterministic node IDs */
  createNodeId: (...args: string[]) => string;
  /** Function to create content digests for change detection */
  createContentDigest: (data: unknown) => string;
  /** Resolved plugin options */
  options: ResolvedContentfulPluginOptions;
  /** Map of content type ID to node type name */
  contentTypeMap: Map<string, string>;
}

/**
 * The structure of a transformed entry ready for node creation.
 * This matches the input expected by `actions.createNode()`.
 */
export interface TransformedEntry {
  internal: {
    id: string;
    type: string;
    owner: string;
    contentDigest: string;
  };
  /** Original Contentful entry ID */
  contentfulId: string;
  /** Contentful sys metadata */
  sys: {
    id: string;
    type: string;
    createdAt: string;
    updatedAt: string;
    revision: number;
    contentType: {
      sys: {
        id: string;
      };
    };
    locale?: string;
  };
  /** Transformed field values */
  [key: string]: unknown;
}

/**
 * Checks if a value is an unresolved link.
 */
function isUnresolvedLink(
  value: unknown
): value is UnresolvedLink<'Entry' | 'Asset'> {
  if (typeof value !== 'object' || value === null || !('sys' in value)) {
    return false;
  }
  const sys = (value as Record<string, unknown>)['sys'];
  return (
    typeof sys === 'object' &&
    sys !== null &&
    (sys as Record<string, unknown>)['type'] === 'Link'
  );
}

/**
 * Checks if a value is a resolved entry.
 */
function isResolvedEntry(value: unknown): value is Entry<EntrySkeletonType> {
  if (
    typeof value !== 'object' ||
    value === null ||
    !('sys' in value) ||
    !('fields' in value)
  ) {
    return false;
  }
  const sys = (value as Record<string, unknown>)['sys'];
  return (
    typeof sys === 'object' &&
    sys !== null &&
    (sys as Record<string, unknown>)['type'] === 'Entry'
  );
}

/**
 * Checks if a value is a resolved asset.
 */
function isResolvedAsset(
  value: unknown
): value is { sys: { type: 'Asset'; id: string }; fields: unknown } {
  if (
    typeof value !== 'object' ||
    value === null ||
    !('sys' in value) ||
    !('fields' in value)
  ) {
    return false;
  }
  const sys = (value as Record<string, unknown>)['sys'];
  return (
    typeof sys === 'object' &&
    sys !== null &&
    (sys as Record<string, unknown>)['type'] === 'Asset'
  );
}

/**
 * Transforms a linked entry or asset to a reference object.
 * Stores the node ID that can be used to resolve the reference.
 */
function transformLink(
  value: unknown,
  context: EntryTransformContext
): { __nodeId: string; __type: 'Entry' | 'Asset' } | null {
  const { createNodeId, options, contentTypeMap } = context;

  // Handle unresolved links
  if (isUnresolvedLink(value)) {
    const linkType = value.sys.linkType;
    const linkedId = value.sys.id;

    if (linkType === 'Asset') {
      return {
        __nodeId: createNodeId(`${options.nodePrefix}Asset`, linkedId),
        __type: 'Asset',
      };
    } else if (linkType === 'Entry') {
      // For unresolved entries, we don't know the content type
      // Use a generic prefix - will need to resolve at query time
      return {
        __nodeId: createNodeId(`${options.nodePrefix}Entry`, linkedId),
        __type: 'Entry',
      };
    }
  }

  // Handle resolved entries
  if (isResolvedEntry(value)) {
    const contentTypeId = value.sys.contentType.sys.id;
    const nodeTypeName =
      contentTypeMap.get(contentTypeId) ?? `${options.nodePrefix}Entry`;
    return {
      __nodeId: createNodeId(nodeTypeName, value.sys.id),
      __type: 'Entry',
    };
  }

  // Handle resolved assets
  if (isResolvedAsset(value)) {
    return {
      __nodeId: createNodeId(`${options.nodePrefix}Asset`, value.sys.id),
      __type: 'Asset',
    };
  }

  return null;
}

/**
 * Transforms a field value, handling links, arrays, and nested objects.
 */
function transformFieldValue(
  value: unknown,
  context: EntryTransformContext
): unknown {
  // Null or undefined
  if (value === null || value === undefined) {
    return value;
  }

  // Check for links first
  const link = transformLink(value, context);
  if (link) {
    return link;
  }

  // Arrays
  if (Array.isArray(value)) {
    return value.map((item) => transformFieldValue(item, context));
  }

  // Rich Text (has nodeType property)
  if (
    typeof value === 'object' &&
    value !== null &&
    'nodeType' in value &&
    (value as { nodeType: string }).nodeType === 'document'
  ) {
    // Store rich text as-is (raw JSON)
    // Embedded entries/assets within rich text are already resolved by Contentful SDK
    return transformRichText(value as RichTextDocument, context);
  }

  // Plain objects (but not entries/assets/links)
  if (typeof value === 'object' && value !== null) {
    // Check if it's a special Contentful type we should preserve
    if ('lat' in value && 'lon' in value) {
      // Location field
      return value;
    }

    // Generic object - recursively transform
    const transformed: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value)) {
      transformed[key] = transformFieldValue(val, context);
    }
    return transformed;
  }

  // Primitives (string, number, boolean)
  return value;
}

/**
 * Rich text document structure.
 */
interface RichTextDocument {
  nodeType: 'document';
  content: RichTextNode[];
  data: Record<string, unknown>;
}

interface RichTextNode {
  nodeType: string;
  content?: RichTextNode[];
  data?: Record<string, unknown>;
  value?: string;
}

/**
 * Transforms rich text content, extracting embedded entry/asset references.
 */
function transformRichText(
  doc: RichTextDocument,
  context: EntryTransformContext
): {
  raw: RichTextDocument;
  references: Array<{ __nodeId: string; __type: 'Entry' | 'Asset' }>;
} {
  const references: Array<{ __nodeId: string; __type: 'Entry' | 'Asset' }> = [];

  function extractReferences(node: RichTextNode): void {
    // Check for embedded entries/assets
    if (
      node.nodeType === 'embedded-entry-block' ||
      node.nodeType === 'embedded-entry-inline' ||
      node.nodeType === 'entry-hyperlink'
    ) {
      const target = node.data?.['target'];
      if (target) {
        const link = transformLink(target, context);
        if (link) {
          references.push(link);
        }
      }
    }

    if (
      node.nodeType === 'embedded-asset-block' ||
      node.nodeType === 'asset-hyperlink'
    ) {
      const target = node.data?.['target'];
      if (target) {
        const link = transformLink(target, context);
        if (link) {
          references.push(link);
        }
      }
    }

    // Recurse into children
    if (node.content) {
      for (const child of node.content) {
        extractReferences(child);
      }
    }
  }

  for (const node of doc.content) {
    extractReferences(node);
  }

  return {
    raw: doc,
    references,
  };
}

/**
 * Transforms a Contentful entry into a structure ready for UDL node creation.
 *
 * @param entry - The Contentful entry
 * @param context - Transformation context
 * @returns Transformed entry ready for `actions.createNode()`
 */
export function transformEntry(
  entry: Entry<EntrySkeletonType>,
  context: EntryTransformContext
): TransformedEntry {
  const { createNodeId, createContentDigest, options, contentTypeMap } =
    context;

  const contentTypeId = entry.sys.contentType.sys.id;
  const nodeTypeName =
    contentTypeMap.get(contentTypeId) ?? `${options.nodePrefix}Entry`;

  // Create deterministic node ID
  const nodeId = createNodeId(nodeTypeName, entry.sys.id);

  // Transform all fields
  const transformedFields: Record<string, unknown> = {};
  for (const [fieldName, fieldValue] of Object.entries(entry.fields)) {
    transformedFields[fieldName] = transformFieldValue(fieldValue, context);
  }

  const sysData: TransformedEntry['sys'] = {
    id: entry.sys.id,
    type: entry.sys.type,
    createdAt: entry.sys.createdAt,
    updatedAt: entry.sys.updatedAt,
    revision: entry.sys.revision,
    contentType: {
      sys: {
        id: contentTypeId,
      },
    },
  };

  // Only add locale if it exists
  if (entry.sys.locale) {
    sysData.locale = entry.sys.locale;
  }

  return {
    internal: {
      id: nodeId,
      type: nodeTypeName,
      owner: '@udl/plugin-source-contentful',
      contentDigest: createContentDigest(entry),
    },
    contentfulId: entry.sys.id,
    sys: sysData,
    ...transformedFields,
  };
}

/**
 * Gets the node ID for a Contentful entry (for deletion).
 *
 * @param entryId - The Contentful entry sys.id
 * @param contentTypeId - The content type sys.id
 * @param context - Transformation context
 * @returns The UDL node ID
 */
export function getEntryNodeId(
  entryId: string,
  contentTypeId: string,
  context: EntryTransformContext
): string {
  const { createNodeId, options, contentTypeMap } = context;
  const nodeTypeName =
    contentTypeMap.get(contentTypeId) ?? `${options.nodePrefix}Entry`;
  return createNodeId(nodeTypeName, entryId);
}
