/**
 * Contentful Source Plugin for Universal Data Layer
 *
 * This plugin sources content from Contentful CMS and creates UDL nodes
 * for entries and assets. It supports incremental sync via Contentful's
 * Sync API for efficient updates.
 */

import type { SourceNodesContext } from 'universal-data-layer';
import { createContentfulClient } from './src/client.js';
import type { ContentfulPluginOptions } from './src/types/index.js';
import { resolveOptions } from './src/types/index.js';
import {
  fetchContentTypes,
  createContentTypeMap,
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

/**
 * Plugin configuration
 */
export const config = {
  type: 'source' as const,
  name: '@udl/plugin-source-contentful',
  indexes: ['contentfulId'],
  codegen: {
    output: './generated',
    guards: true,
    helpers: true,
    includeInternal: true,
  },
};

/**
 * Called when the plugin is loaded.
 * Validates required options.
 */
export function onLoad({
  options,
}: {
  options?: ContentfulPluginOptions;
} = {}): void {
  if (!options?.spaceId) {
    throw new Error(
      '[@udl/plugin-source-contentful] Missing required option: spaceId'
    );
  }

  if (!options.accessToken) {
    throw new Error(
      '[@udl/plugin-source-contentful] Missing required option: accessToken'
    );
  }

  const resolved = resolveOptions(options);
  console.log(
    `[@udl/plugin-source-contentful] Initialized for space "${resolved.spaceId}" (${resolved.environment})`
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
}: SourceNodesContext<ContentfulPluginOptions>): Promise<void> {
  if (!options) {
    throw new Error(
      '[@udl/plugin-source-contentful] Plugin options are required'
    );
  }

  const resolvedOptions = resolveOptions(options);
  const client = createContentfulClient(resolvedOptions);

  // Fetch content types for type name mapping
  console.log('[@udl/plugin-source-contentful] Fetching content types...');
  const contentTypes = await fetchContentTypes(client, resolvedOptions);
  const contentTypeMap = createContentTypeMap(contentTypes, resolvedOptions);

  console.log(
    `[@udl/plugin-source-contentful] Found ${contentTypes.length} content types`
  );

  // Perform sync (initial or delta based on stored token)
  console.log('[@udl/plugin-source-contentful] Syncing content...');
  const syncResult = await performSync(client, resolvedOptions);
  const stats = getSyncStats(syncResult);

  console.log(
    `[@udl/plugin-source-contentful] Sync complete (${stats.isInitialSync ? 'initial' : 'delta'}): ` +
      `${stats.entriesCount} entries, ${stats.assetsCount} assets, ` +
      `${stats.deletedEntriesCount} deleted entries, ${stats.deletedAssetsCount} deleted assets`
  );

  // Create transform contexts
  const entryContext: EntryTransformContext = {
    createNodeId,
    createContentDigest,
    options: resolvedOptions,
    contentTypeMap,
  };

  const assetContext: AssetTransformContext = {
    createNodeId,
    createContentDigest,
    options: resolvedOptions,
  };

  // Process new/updated entries
  for (const entry of syncResult.entries) {
    const transformed = transformEntry(entry, entryContext);
    await actions.createNode(transformed);
  }

  // Process new/updated assets
  for (const asset of syncResult.assets) {
    const transformed = transformAsset(asset, assetContext);
    await actions.createNode(transformed);
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
    }
  }

  // Process deleted assets
  for (const deletedAsset of syncResult.deletedAssets) {
    const nodeId = getAssetNodeId(deletedAsset.sys.id, assetContext);
    await actions.deleteNode(nodeId);
  }

  // Log summary
  const assetTypeName = getAssetNodeTypeName(resolvedOptions);
  const entryTypeNames = [...contentTypeMap.values()];

  console.log(
    `[@udl/plugin-source-contentful] Created node types: ${[assetTypeName, ...entryTypeNames].join(', ')}`
  );
}
