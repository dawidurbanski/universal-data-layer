import type {
  ContentfulPluginOptions,
  ResolvedContentfulPluginOptions,
} from '../types/options.js';

/**
 * Default values for optional plugin options.
 */
export const DEFAULT_OPTIONS = {
  host: 'cdn.contentful.com',
  environment: 'master',
  nodePrefix: 'Contentful',
  locale: 'en-US',
  useNameForId: true,
  downloadAssets: false,
  forceFullSync: false,
} as const satisfies Partial<ContentfulPluginOptions>;

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
