import { createClient, type ContentfulClientApi } from 'contentful';
import type { ContentfulPluginOptions } from './types/index.js';
import { ContentfulConfigError } from './utils/errors.js';

/**
 * The Contentful client type used throughout the plugin.
 */
export type ContentfulClient = ContentfulClientApi<undefined>;

/**
 * Creates a configured Contentful client instance.
 *
 * @param options - Plugin options containing credentials and configuration
 * @returns A configured Contentful client
 * @throws ContentfulConfigError if required options (spaceId, accessToken) are missing
 *
 * @example
 * ```ts
 * const client = createContentfulClient({
 *   spaceId: 'your-space-id',
 *   accessToken: 'your-access-token',
 * });
 *
 * // For preview API (draft content)
 * const previewClient = createContentfulClient({
 *   spaceId: 'your-space-id',
 *   accessToken: 'your-preview-token',
 *   host: 'preview.contentful.com',
 * });
 * ```
 */
export function createContentfulClient(
  options: ContentfulPluginOptions
): ContentfulClient {
  const { spaceId, accessToken, host, environment } = options;

  if (!spaceId) {
    throw new ContentfulConfigError('Missing required option: spaceId');
  }

  if (!accessToken) {
    throw new ContentfulConfigError('Missing required option: accessToken');
  }

  return createClient({
    space: spaceId,
    accessToken,
    host: host ?? 'cdn.contentful.com',
    environment: environment ?? 'master',
  });
}
