import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type {
  Asset,
  DeletedAsset,
  DeletedEntry,
  Entry,
  EntrySkeletonType,
} from 'contentful';
import type { ContentfulClient } from '@/client.js';
import type {
  ResolvedContentfulPluginOptions,
  SyncTokenStorage,
} from '@/types/index.js';

/**
 * Result of a sync operation, categorized by type.
 */
export interface SyncResult {
  /** New or updated entries */
  entries: Array<Entry<EntrySkeletonType>>;
  /** New or updated assets */
  assets: Asset[];
  /** Deleted entries (contains sys.id for removal) */
  deletedEntries: DeletedEntry[];
  /** Deleted assets (contains sys.id for removal) */
  deletedAssets: DeletedAsset[];
  /** Token for next sync */
  nextSyncToken: string | undefined;
  /** Whether this was an initial sync */
  isInitialSync: boolean;
}

/**
 * Default file-based sync token storage.
 * Stores tokens in `.udl/cache/contentful-sync-tokens.json`.
 */
export class FileSyncTokenStorage implements SyncTokenStorage {
  private readonly filePath: string;
  private cache: Record<string, string> = {};
  private loaded = false;

  constructor(basePath: string = process.cwd()) {
    this.filePath = join(
      basePath,
      '.udl',
      'cache',
      'contentful-sync-tokens.json'
    );
  }

  private ensureLoaded(): void {
    if (this.loaded) return;

    if (existsSync(this.filePath)) {
      try {
        const content = readFileSync(this.filePath, 'utf-8');
        this.cache = JSON.parse(content) as Record<string, string>;
      } catch {
        // If file is corrupted, start fresh
        this.cache = {};
      }
    }
    this.loaded = true;
  }

  private save(): void {
    const dir = dirname(this.filePath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(this.filePath, JSON.stringify(this.cache, null, 2));
  }

  async getSyncToken(spaceId: string): Promise<string | null> {
    this.ensureLoaded();
    return this.cache[spaceId] ?? null;
  }

  async setSyncToken(spaceId: string, token: string): Promise<void> {
    this.ensureLoaded();
    this.cache[spaceId] = token;
    this.save();
  }

  async clearSyncToken(spaceId: string): Promise<void> {
    this.ensureLoaded();
    delete this.cache[spaceId];
    this.save();
  }
}

/**
 * Creates a unique key for storing sync tokens.
 * Includes space ID and environment to handle multiple configurations.
 */
function createSyncTokenKey(options: ResolvedContentfulPluginOptions): string {
  return `${options.spaceId}:${options.environment}`;
}

/**
 * Performs a sync operation with Contentful.
 *
 * - If no sync token exists (or forceFullSync is true), performs initial sync
 * - If sync token exists, performs delta sync to get only changes
 *
 * @param client - Contentful client instance
 * @param options - Resolved plugin options
 * @param tokenStorage - Storage for sync tokens (defaults to file-based)
 * @param basePath - Base path for file-based token storage (defaults to process.cwd())
 * @returns Sync result with entries, assets, and deleted items
 */
export async function performSync(
  client: ContentfulClient,
  options: ResolvedContentfulPluginOptions,
  tokenStorage?: SyncTokenStorage,
  basePath?: string
): Promise<SyncResult> {
  const storage =
    tokenStorage ??
    options.syncTokenStorage ??
    new FileSyncTokenStorage(basePath);
  const tokenKey = createSyncTokenKey(options);

  // Check for existing sync token
  let syncToken: string | null = null;
  if (!options.forceFullSync) {
    syncToken = await storage.getSyncToken(tokenKey);
  }

  const isInitialSync = syncToken === null;

  // Perform sync
  // Note: We use separate calls because TypeScript needs to narrow the type
  const syncResponse = isInitialSync
    ? await client.sync({ initial: true })
    : await client.sync({ nextSyncToken: syncToken as string });

  // Store the new sync token for next time
  if (syncResponse.nextSyncToken) {
    await storage.setSyncToken(tokenKey, syncResponse.nextSyncToken);
  }

  return {
    entries: syncResponse.entries,
    assets: syncResponse.assets,
    deletedEntries: syncResponse.deletedEntries,
    deletedAssets: syncResponse.deletedAssets,
    nextSyncToken: syncResponse.nextSyncToken,
    isInitialSync,
  };
}

/**
 * Clears the stored sync token, forcing a full sync on next run.
 *
 * @param options - Resolved plugin options
 * @param tokenStorage - Storage for sync tokens
 */
export async function clearSyncToken(
  options: ResolvedContentfulPluginOptions,
  tokenStorage?: SyncTokenStorage
): Promise<void> {
  const storage =
    tokenStorage ?? options.syncTokenStorage ?? new FileSyncTokenStorage();
  const tokenKey = createSyncTokenKey(options);

  if (storage.clearSyncToken) {
    await storage.clearSyncToken(tokenKey);
  } else {
    // Fallback: set empty token (will be treated as needing initial sync)
    await storage.setSyncToken(tokenKey, '');
  }
}

/**
 * Gets sync statistics for logging.
 */
export function getSyncStats(result: SyncResult): {
  entriesCount: number;
  assetsCount: number;
  deletedEntriesCount: number;
  deletedAssetsCount: number;
  isInitialSync: boolean;
} {
  return {
    entriesCount: result.entries.length,
    assetsCount: result.assets.length,
    deletedEntriesCount: result.deletedEntries.length,
    deletedAssetsCount: result.deletedAssets.length,
    isInitialSync: result.isInitialSync,
  };
}
