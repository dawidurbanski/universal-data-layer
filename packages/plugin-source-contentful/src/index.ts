/**
 * Contentful Source Plugin for Universal Data Layer
 *
 * @packageDocumentation
 */

// Re-export plugin configuration from the root udl.config.ts
export { config, onLoad, sourceNodes } from '../udl.config.js';

// Export types for consumers
export type {
  ContentfulPluginOptions,
  ResolvedContentfulPluginOptions,
  SyncTokenStorage,
  ContentfulReference,
  RichTextContent,
  RichTextDocument,
  RichTextNode,
} from './types/index.js';

// Export utility functions and helpers
export { createReference, isContentfulReference } from './utils/references.js';
export { resolveOptions, DEFAULT_OPTIONS } from './utils/options.js';

// Export client creation for advanced usage
export { createContentfulClient, type ContentfulClient } from './client.js';

// Export error classes for error handling
export {
  ContentfulPluginError,
  ContentfulConfigError,
  ContentfulApiError,
  ContentfulSyncError,
  ContentfulTransformError,
  isRateLimitError,
  isAuthError,
  isNotFoundError,
} from './utils/errors.js';

// Export sync utilities for advanced usage
export { FileSyncTokenStorage, clearSyncToken } from './utils/sync.js';
