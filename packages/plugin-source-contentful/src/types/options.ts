import type { ContentType } from 'contentful';

/**
 * Interface for custom sync token storage implementations.
 * Allows users to provide their own storage mechanism for sync tokens
 * (e.g., database, Redis, file system).
 */
export interface SyncTokenStorage {
  /**
   * Retrieve a stored sync token for a given key.
   * @param key - The storage key (typically spaceId:environment)
   * @returns The sync token if found, or null if not exists
   */
  getSyncToken(key: string): Promise<string | null>;

  /**
   * Store a sync token for a given key.
   * @param key - The storage key (typically spaceId:environment)
   * @param token - The sync token to store
   */
  setSyncToken(key: string, token: string): Promise<void>;

  /**
   * Clear a stored sync token (optional).
   * If not implemented, setSyncToken with empty string will be used.
   * @param key - The storage key
   */
  clearSyncToken?(key: string): Promise<void>;
}

/**
 * Configuration options for the Contentful source plugin.
 */
export interface ContentfulPluginOptions {
  /**
   * Your Contentful space ID.
   * Found in Settings > General Settings in the Contentful web app.
   */
  spaceId: string;

  /**
   * Your Contentful Delivery API access token.
   * For preview mode, use a Preview API token instead.
   * Found in Settings > API Keys in the Contentful web app.
   */
  accessToken: string;

  /**
   * The Contentful API host.
   * Use 'preview.contentful.com' for draft/preview content.
   * @default 'cdn.contentful.com'
   */
  host?: string;

  /**
   * The Contentful environment to fetch content from.
   * @default 'master'
   */
  environment?: string;

  /**
   * Prefix for all generated node type names.
   * Allows multiple Contentful spaces with different prefixes.
   * @example 'ContentfulCMS' -> ContentfulCMSBlogPost, ContentfulCMSAsset
   * @default 'Contentful'
   */
  nodePrefix?: string;

  /**
   * Specific locales to fetch content for.
   * If not specified, fetches content for all available locales.
   * @example ['en-US', 'de-DE']
   */
  locales?: string[];

  /**
   * Whether to download assets locally for static distribution.
   * When true, assets are cached to the local filesystem.
   * @default false
   */
  downloadAssets?: boolean;

  /**
   * Filter function to selectively include/exclude content types.
   * Return true to include the content type, false to exclude.
   * @example (contentType) => contentType.sys.id !== 'internalType'
   */
  contentTypeFilter?: (contentType: ContentType) => boolean;

  /**
   * Whether to use the content type name for GraphQL type names.
   * When true: "Blog Post" -> ContentfulBlogPost
   * When false: uses the content type ID instead (more stable but less readable)
   * @default true
   */
  useNameForId?: boolean;

  /**
   * Force a full re-sync, ignoring any stored sync token.
   * Useful for debugging or when you need to rebuild the entire cache.
   * @default false
   */
  forceFullSync?: boolean;

  /**
   * Custom sync token storage implementation.
   * If not provided, uses the default file-based storage
   * that stores tokens in `.udl-cache/contentful-sync-tokens.json`.
   */
  syncTokenStorage?: SyncTokenStorage;
}

/**
 * Default values for optional plugin options.
 */
export const DEFAULT_OPTIONS = {
  host: 'cdn.contentful.com',
  environment: 'master',
  nodePrefix: 'Contentful',
  useNameForId: true,
  downloadAssets: false,
  forceFullSync: false,
} as const satisfies Partial<ContentfulPluginOptions>;

/**
 * Resolved plugin options with all defaults applied.
 */
export type ResolvedContentfulPluginOptions = Required<
  Omit<
    ContentfulPluginOptions,
    'locales' | 'contentTypeFilter' | 'syncTokenStorage'
  >
> &
  Pick<
    ContentfulPluginOptions,
    'locales' | 'contentTypeFilter' | 'syncTokenStorage'
  >;

/**
 * Apply default values to plugin options.
 */
export function resolveOptions(
  options: ContentfulPluginOptions
): ResolvedContentfulPluginOptions {
  return {
    ...DEFAULT_OPTIONS,
    ...options,
  };
}
