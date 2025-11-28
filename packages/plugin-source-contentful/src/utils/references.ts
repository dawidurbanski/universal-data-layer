/**
 * Reference handling utilities for Contentful linked content.
 *
 * This module provides types and utilities for handling references between
 * Contentful entries and assets. References are stored with the Contentful ID
 * so they can be resolved at query time using the `contentfulId` index.
 */

/**
 * A reference to a linked Contentful entry or asset.
 *
 * References are resolved at query time using the `contentfulId` index.
 * This approach is used because the Sync API returns unresolved links
 * that don't include content type information for linked entries.
 */
export interface ContentfulReference {
  /** Marker to identify this object as a Contentful reference */
  __contentfulRef: true;
  /** The Contentful sys.id of the linked entry or asset */
  contentfulId: string;
  /** The type of linked content */
  linkType: 'Entry' | 'Asset';
}

/**
 * Rich text content structure with extracted references.
 */
export interface RichTextContent {
  /** The raw rich text JSON document */
  raw: RichTextDocument;
  /** References to embedded entries and assets within the rich text */
  references: ContentfulReference[];
}

/**
 * Rich text document structure from Contentful.
 */
export interface RichTextDocument {
  nodeType: 'document';
  content: RichTextNode[];
  data: Record<string, unknown>;
}

/**
 * A node within a rich text document.
 */
export interface RichTextNode {
  nodeType: string;
  content?: RichTextNode[];
  data?: Record<string, unknown>;
  value?: string;
}

/**
 * Creates a reference object from a Contentful ID and link type.
 *
 * @param contentfulId - The Contentful sys.id of the linked content
 * @param linkType - Whether this is an Entry or Asset link
 * @returns A ContentfulReference object
 */
export function createReference(
  contentfulId: string,
  linkType: 'Entry' | 'Asset'
): ContentfulReference {
  return {
    __contentfulRef: true,
    contentfulId,
    linkType,
  };
}

/**
 * Checks if a value is a ContentfulReference.
 *
 * @param value - The value to check
 * @returns True if the value is a ContentfulReference
 */
export function isContentfulReference(
  value: unknown
): value is ContentfulReference {
  return (
    typeof value === 'object' &&
    value !== null &&
    '__contentfulRef' in value &&
    (value as ContentfulReference).__contentfulRef === true
  );
}
