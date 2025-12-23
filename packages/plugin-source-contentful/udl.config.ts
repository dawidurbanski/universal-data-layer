/**
 * Contentful Source Plugin for Universal Data Layer
 *
 * This plugin sources content from Contentful CMS and creates UDL nodes
 * for entries and assets. It supports incremental sync via Contentful's
 * Sync API for efficient updates.
 */

import {
  defineConfig,
  type SourceNodesContext,
  type ReferenceResolverConfig,
  type EntityKeyConfig,
  type OnLoadContext,
} from 'universal-data-layer';
import { createContentfulClient } from './src/client.js';
import type { ContentfulPluginOptions } from './src/types/index.js';
import { resolveOptions } from './src/utils/options.js';
import {
  fetchContentTypes,
  createContentTypeMap,
  createFieldLinkMap,
  getAssetNodeTypeName,
} from './src/utils/content-types.js';
import {
  transformEntry,
  getEntryNodeId,
  type EntryTransformContext,
} from './src/utils/entries.js';
import {
  transformAsset,
  getAssetNodeId,
  type AssetTransformContext,
} from './src/utils/assets.js';
import { performSync, getSyncStats } from './src/utils/sync.js';
import {
  ContentfulConfigError,
  ContentfulSyncError,
  wrapApiCall,
} from './src/utils/errors.js';
import {
  isContentfulReference,
  type ContentfulReference,
} from './src/utils/references.js';

/** Plugin log prefix for consistent logging */
const LOG_PREFIX = '[@universal-data-layer/plugin-source-contentful]';

/**
 * Plugin configuration
 */
export const config = defineConfig({
  type: 'source',
  name: '@universal-data-layer/plugin-source-contentful',
  indexes: ['contentfulId'],
  /**
   * Use 'sync' strategy because Contentful has its own Sync API.
   * When webhooks arrive, sourceNodes will be re-invoked to fetch
   * changes via the Sync API (delta sync using stored token).
   */
  updateStrategy: 'sync',
  codegen: {
    output: './generated',
    guards: true,
    includeInternal: true,
  },
});

/**
 * Called when the plugin is loaded.
 * Validates required options.
 */
export function onLoad(context?: OnLoadContext<ContentfulPluginOptions>): void {
  const options = context?.options;

  if (!options?.spaceId) {
    throw new ContentfulConfigError('Missing required option: spaceId');
  }

  if (!options.accessToken) {
    throw new ContentfulConfigError('Missing required option: accessToken');
  }

  const resolved = resolveOptions(options);
  console.log(
    `${LOG_PREFIX} Initialized for space "${resolved.spaceId}" (${resolved.environment})`
  );
}

/**
 * Sources nodes from Contentful.
 * Uses the Sync API for efficient incremental updates.
 */
export async function sourceNodes({
  actions,
  createNodeId,
  createContentDigest,
  options,
  cacheDir,
}: SourceNodesContext<ContentfulPluginOptions>): Promise<void> {
  if (!options) {
    throw new ContentfulConfigError('Plugin options are required');
  }

  const resolvedOptions = resolveOptions(options);
  const client = createContentfulClient(resolvedOptions);

  // Fetch content types for type name mapping
  console.log(`${LOG_PREFIX} Fetching content types...`);
  const contentTypes = await wrapApiCall(
    () => fetchContentTypes(client, resolvedOptions),
    'Failed to fetch content types'
  );
  const contentTypeMap = createContentTypeMap(contentTypes, resolvedOptions);
  const fieldLinkMap = createFieldLinkMap(contentTypes, resolvedOptions);

  console.log(`${LOG_PREFIX} Found ${contentTypes.length} content types`);

  // Log content type details for debugging
  if (contentTypes.length > 0) {
    const typeNames = contentTypes.map((ct) => ct.name).join(', ');
    console.log(`${LOG_PREFIX} Content types: ${typeNames}`);
  }

  // Perform sync (initial or delta based on stored token)
  // Pass cacheDir so sync token is stored alongside the node cache
  console.log(`${LOG_PREFIX} Syncing content...`);
  let syncResult;
  try {
    syncResult = await performSync(
      client,
      resolvedOptions,
      undefined, // Use default token storage
      cacheDir // Store tokens in the config's cache directory
    );
  } catch (error) {
    throw new ContentfulSyncError(
      `Sync failed: ${error instanceof Error ? error.message : String(error)}`,
      true
    );
  }
  const stats = getSyncStats(syncResult);

  console.log(
    `${LOG_PREFIX} Sync complete (${stats.isInitialSync ? 'initial' : 'delta'}): ` +
      `${stats.entriesCount} entries, ${stats.assetsCount} assets, ` +
      `${stats.deletedEntriesCount} deleted entries, ${stats.deletedAssetsCount} deleted assets`
  );

  // Create transform contexts
  const entryContext: EntryTransformContext = {
    createNodeId,
    createContentDigest,
    options: resolvedOptions,
    contentTypeMap,
    fieldLinkMap,
  };

  const assetContext: AssetTransformContext = {
    createNodeId,
    createContentDigest,
    options: resolvedOptions,
  };

  // Track created nodes for summary
  let createdEntriesCount = 0;
  let createdAssetsCount = 0;
  let deletedNodesCount = 0;

  // Process new/updated entries
  for (const entry of syncResult.entries) {
    try {
      const transformed = transformEntry(entry, entryContext);
      await actions.createNode(transformed);
      createdEntriesCount++;
    } catch (error) {
      console.warn(
        `${LOG_PREFIX} Warning: Failed to transform entry "${entry.sys.id}": ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  // Process new/updated assets
  for (const asset of syncResult.assets) {
    try {
      const transformed = transformAsset(asset, assetContext);
      await actions.createNode(transformed);
      createdAssetsCount++;
    } catch (error) {
      console.warn(
        `${LOG_PREFIX} Warning: Failed to transform asset "${asset.sys.id}": ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  // Process deleted entries
  for (const deletedEntry of syncResult.deletedEntries) {
    // For deleted entries, we need to find the content type to get the correct node ID
    // Since we don't have the content type info for deleted entries, we'll try all possible types
    // This is a limitation of the Sync API - deleted entries don't include content type info
    for (const [contentTypeId] of contentTypeMap) {
      const nodeId = getEntryNodeId(
        deletedEntry.sys.id,
        contentTypeId,
        entryContext
      );
      await actions.deleteNode(nodeId);
      deletedNodesCount++;
    }
  }

  // Process deleted assets
  for (const deletedAsset of syncResult.deletedAssets) {
    const nodeId = getAssetNodeId(deletedAsset.sys.id, assetContext);
    await actions.deleteNode(nodeId);
    deletedNodesCount++;
  }

  // Log summary
  const assetTypeName = getAssetNodeTypeName(resolvedOptions);
  const entryTypeNames = [...contentTypeMap.values()];

  console.log(
    `${LOG_PREFIX} Created ${createdEntriesCount} entries and ${createdAssetsCount} assets`
  );
  if (deletedNodesCount > 0) {
    console.log(`${LOG_PREFIX} Deleted ${deletedNodesCount} nodes`);
  }
  console.log(
    `${LOG_PREFIX} Node types: ${[assetTypeName, ...entryTypeNames].join(', ')}`
  );
}

/**
 * Reference resolver configuration for Contentful references.
 * Tells the core how to identify and resolve references from Contentful.
 */
export const referenceResolver: ReferenceResolverConfig = {
  id: '@universal-data-layer/plugin-source-contentful',
  markerField: '_contentfulRef',
  lookupField: 'contentfulId',
  isReference: isContentfulReference,
  getLookupValue: (ref: unknown): unknown => {
    return (ref as ContentfulReference).contentfulId;
  },
  getPossibleTypes: (ref: unknown): string[] => {
    return (ref as ContentfulReference).possibleTypes ?? [];
  },
  priority: 10,
};

/**
 * Entity key configuration for normalization.
 * Uses contentfulId as the unique identifier for Contentful nodes.
 */
export const entityKeyConfig: EntityKeyConfig = {
  idField: 'contentfulId',
  priority: 10,
};
