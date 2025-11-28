import type { ContentType, ContentTypeField } from 'contentful';
import type { ContentfulClient } from '@/client.js';
import type { ResolvedContentfulPluginOptions } from '@/types/index.js';

/**
 * Fetches all content types from Contentful, optionally filtered.
 *
 * @param client - Contentful client instance
 * @param options - Resolved plugin options
 * @returns Array of content types
 */
export async function fetchContentTypes(
  client: ContentfulClient,
  options: ResolvedContentfulPluginOptions
): Promise<ContentType[]> {
  const response = await client.getContentTypes();
  let contentTypes = response.items;

  // Apply content type filter if provided
  if (options.contentTypeFilter) {
    contentTypes = contentTypes.filter(options.contentTypeFilter);
  }

  return contentTypes;
}

/**
 * Converts a Contentful content type to a UDL node type name.
 *
 * @param contentType - The Contentful content type
 * @param options - Resolved plugin options
 * @returns The node type name (e.g., "ContentfulBlogPost")
 *
 * @example
 * ```ts
 * // With useNameForId: true (default)
 * contentTypeToNodeTypeName(blogPostType, options) // "ContentfulBlogPost"
 *
 * // With useNameForId: false
 * contentTypeToNodeTypeName(blogPostType, options) // "ContentfulBlogPost" (uses sys.id)
 *
 * // With custom nodePrefix
 * contentTypeToNodeTypeName(blogPostType, { ...options, nodePrefix: 'CMS' }) // "CMSBlogPost"
 * ```
 */
export function contentTypeToNodeTypeName(
  contentType: ContentType,
  options: ResolvedContentfulPluginOptions
): string {
  const { nodePrefix, useNameForId } = options;

  // Use either the human-readable name or the system ID
  const baseName = useNameForId ? contentType.name : contentType.sys.id;

  // Convert to PascalCase and remove invalid characters
  const pascalCaseName = toPascalCase(baseName);

  return `${nodePrefix}${pascalCaseName}`;
}

/**
 * Gets the asset node type name for the current configuration.
 *
 * @param options - Resolved plugin options
 * @returns The asset node type name (e.g., "ContentfulAsset")
 */
export function getAssetNodeTypeName(
  options: ResolvedContentfulPluginOptions
): string {
  return `${options.nodePrefix}Asset`;
}

/**
 * Converts a string to PascalCase.
 * Handles spaces, hyphens, underscores, and removes invalid characters.
 *
 * @param str - Input string
 * @returns PascalCase string
 *
 * @example
 * ```ts
 * toPascalCase("blog post") // "BlogPost"
 * toPascalCase("blog-post") // "BlogPost"
 * toPascalCase("blog_post") // "BlogPost"
 * toPascalCase("Blog Post!") // "BlogPost"
 * ```
 */
export function toPascalCase(str: string): string {
  return (
    str
      // Split on spaces, hyphens, underscores
      .split(/[\s\-_]+/)
      // Capitalize first letter of each word
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      // Join together
      .join('')
      // Remove any remaining non-alphanumeric characters
      .replace(/[^a-zA-Z0-9]/g, '')
  );
}

/**
 * Maps Contentful field types to simplified type names for codegen.
 */
export type SimplifiedFieldType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'date'
  | 'location'
  | 'richText'
  | 'object'
  | 'link'
  | 'array'
  | 'unknown';

/**
 * Information about a parsed content type field.
 */
export interface ParsedField {
  /** Field ID (used as property name) */
  id: string;
  /** Human-readable field name */
  name: string;
  /** Simplified field type */
  type: SimplifiedFieldType;
  /** Whether the field is required */
  required: boolean;
  /** Whether the field is localized */
  localized: boolean;
  /** For Link fields: the link type ('Entry' or 'Asset') */
  linkType?: 'Entry' | 'Asset';
  /** For Link fields: allowed content type IDs (if restricted) */
  linkContentTypes?: string[];
  /** For Array fields: the item type */
  arrayItemType?: SimplifiedFieldType;
  /** For Array of Links: the link type */
  arrayLinkType?: 'Entry' | 'Asset';
  /** For Array of Links: allowed content type IDs */
  arrayLinkContentTypes?: string[];
}

/**
 * Maps a Contentful field type to a simplified type.
 */
function mapFieldType(field: ContentTypeField): SimplifiedFieldType {
  switch (field.type) {
    case 'Symbol':
    case 'Text':
      return 'string';
    case 'Integer':
    case 'Number':
      return 'number';
    case 'Boolean':
      return 'boolean';
    case 'Date':
      return 'date';
    case 'Location':
      return 'location';
    case 'RichText':
      return 'richText';
    case 'Object':
      return 'object';
    case 'Link':
      return 'link';
    case 'Array':
      return 'array';
    default:
      return 'unknown';
  }
}

/**
 * Extracts linked content type IDs from field validations.
 */
function extractLinkContentTypes(
  field: ContentTypeField
): string[] | undefined {
  for (const validation of field.validations) {
    if (validation.linkContentType && validation.linkContentType.length > 0) {
      return validation.linkContentType;
    }
  }
  return undefined;
}

/**
 * Parses a Contentful content type field into a simplified structure.
 *
 * @param field - The Contentful field definition
 * @returns Parsed field information
 */
export function parseField(field: ContentTypeField): ParsedField {
  const parsed: ParsedField = {
    id: field.id,
    name: field.name,
    type: mapFieldType(field),
    required: field.required,
    localized: field.localized,
  };

  // Handle Link fields
  if (field.type === 'Link' && field.linkType) {
    parsed.linkType = field.linkType as 'Entry' | 'Asset';
    const linkContentTypes = extractLinkContentTypes(field);
    if (linkContentTypes) {
      parsed.linkContentTypes = linkContentTypes;
    }
  }

  // Handle Array fields
  if (field.type === 'Array' && field.items) {
    if (field.items.type === 'Link') {
      parsed.arrayItemType = 'link';
      parsed.arrayLinkType = field.items.linkType as 'Entry' | 'Asset';

      // Extract content type restrictions from items validations
      for (const validation of field.items.validations) {
        if (
          validation.linkContentType &&
          validation.linkContentType.length > 0
        ) {
          parsed.arrayLinkContentTypes = validation.linkContentType;
          break;
        }
      }
    } else if (field.items.type === 'Symbol') {
      parsed.arrayItemType = 'string';
    }
  }

  return parsed;
}

/**
 * Parses all fields from a content type.
 *
 * @param contentType - The Contentful content type
 * @returns Array of parsed field information
 */
export function parseContentTypeFields(
  contentType: ContentType
): ParsedField[] {
  return contentType.fields
    .filter((field) => !field.disabled && !field.omitted)
    .map(parseField);
}

/**
 * Creates a mapping from content type ID to node type name.
 *
 * @param contentTypes - Array of content types
 * @param options - Resolved plugin options
 * @returns Map of content type ID to node type name
 */
export function createContentTypeMap(
  contentTypes: ContentType[],
  options: ResolvedContentfulPluginOptions
): Map<string, string> {
  const map = new Map<string, string>();

  for (const contentType of contentTypes) {
    map.set(
      contentType.sys.id,
      contentTypeToNodeTypeName(contentType, options)
    );
  }

  return map;
}
