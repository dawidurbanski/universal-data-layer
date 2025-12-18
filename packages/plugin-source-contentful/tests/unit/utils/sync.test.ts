import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import type { Asset, DeletedAsset, DeletedEntry, Entry } from 'contentful';
import type { ContentfulClient } from '@/client.js';
import type {
  ResolvedContentfulPluginOptions,
  SyncTokenStorage,
} from '@/types/index.js';
import {
  clearSyncToken,
  FileSyncTokenStorage,
  getSyncStats,
  performSync,
  type SyncResult,
} from '@/utils/sync.js';

// Mock node:fs
vi.mock('node:fs', () => ({
  existsSync: vi.fn(),
  mkdirSync: vi.fn(),
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
}));

const mockExistsSync = existsSync as Mock;
const mockMkdirSync = mkdirSync as Mock;
const mockReadFileSync = readFileSync as Mock;
const mockWriteFileSync = writeFileSync as Mock;

describe('FileSyncTokenStorage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('uses default base path when not provided', () => {
      const storage = new FileSyncTokenStorage();
      // Access private filePath through prototype to verify
      // We can verify behavior instead by checking file operations
      mockExistsSync.mockReturnValue(false);

      // Trigger ensureLoaded
      storage.getSyncToken('test');

      // Should check for file in default cwd path
      expect(mockExistsSync).toHaveBeenCalledWith(
        expect.stringContaining('.udl-cache/contentful-sync-tokens.json')
      );
    });

    it('uses custom base path when provided', () => {
      const storage = new FileSyncTokenStorage('/custom/path');
      mockExistsSync.mockReturnValue(false);

      storage.getSyncToken('test');

      expect(mockExistsSync).toHaveBeenCalledWith(
        '/custom/path/.udl-cache/contentful-sync-tokens.json'
      );
    });
  });

  describe('getSyncToken', () => {
    it('returns token when it exists in cache', async () => {
      const storage = new FileSyncTokenStorage('/base');
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(
        JSON.stringify({ 'space1:master': 'token123' })
      );

      const token = await storage.getSyncToken('space1:master');

      expect(token).toBe('token123');
    });

    it('returns null when token does not exist', async () => {
      const storage = new FileSyncTokenStorage('/base');
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify({}));

      const token = await storage.getSyncToken('nonexistent');

      expect(token).toBeNull();
    });

    it('returns null when file does not exist', async () => {
      const storage = new FileSyncTokenStorage('/base');
      mockExistsSync.mockReturnValue(false);

      const token = await storage.getSyncToken('space1:master');

      expect(token).toBeNull();
    });

    it('returns null and starts fresh when file is corrupted', async () => {
      const storage = new FileSyncTokenStorage('/base');
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue('invalid json {{{');

      const token = await storage.getSyncToken('space1:master');

      expect(token).toBeNull();
    });

    it('only loads file once (caches loaded state)', async () => {
      const storage = new FileSyncTokenStorage('/base');
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(
        JSON.stringify({ 'space1:master': 'token123' })
      );

      await storage.getSyncToken('space1:master');
      await storage.getSyncToken('space1:master');

      expect(mockReadFileSync).toHaveBeenCalledTimes(1);
    });
  });

  describe('setSyncToken', () => {
    it('stores token and saves to file', async () => {
      const storage = new FileSyncTokenStorage('/base');
      mockExistsSync.mockReturnValue(false);

      await storage.setSyncToken('space1:master', 'newtoken');

      expect(mockWriteFileSync).toHaveBeenCalledWith(
        '/base/.udl-cache/contentful-sync-tokens.json',
        JSON.stringify({ 'space1:master': 'newtoken' }, null, 2)
      );
    });

    it('creates directory if it does not exist', async () => {
      const storage = new FileSyncTokenStorage('/base');
      // First call for ensureLoaded, second for save
      mockExistsSync
        .mockReturnValueOnce(false) // file doesn't exist for loading
        .mockReturnValueOnce(false); // directory doesn't exist for saving

      await storage.setSyncToken('space1:master', 'newtoken');

      expect(mockMkdirSync).toHaveBeenCalledWith('/base/.udl-cache', {
        recursive: true,
      });
    });

    it('does not create directory if it exists', async () => {
      const storage = new FileSyncTokenStorage('/base');
      mockExistsSync
        .mockReturnValueOnce(false) // file doesn't exist for loading
        .mockReturnValueOnce(true); // directory exists for saving

      await storage.setSyncToken('space1:master', 'newtoken');

      expect(mockMkdirSync).not.toHaveBeenCalled();
    });

    it('preserves existing tokens when adding new one', async () => {
      const storage = new FileSyncTokenStorage('/base');
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(
        JSON.stringify({ existing: 'existingtoken' })
      );

      await storage.setSyncToken('new:key', 'newtoken');

      expect(mockWriteFileSync).toHaveBeenCalledWith(
        '/base/.udl-cache/contentful-sync-tokens.json',
        JSON.stringify(
          { existing: 'existingtoken', 'new:key': 'newtoken' },
          null,
          2
        )
      );
    });
  });

  describe('clearSyncToken', () => {
    it('removes token and saves to file', async () => {
      const storage = new FileSyncTokenStorage('/base');
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(
        JSON.stringify({
          'space1:master': 'token1',
          'space2:master': 'token2',
        })
      );

      await storage.clearSyncToken('space1:master');

      expect(mockWriteFileSync).toHaveBeenCalledWith(
        '/base/.udl-cache/contentful-sync-tokens.json',
        JSON.stringify({ 'space2:master': 'token2' }, null, 2)
      );
    });

    it('handles clearing non-existent token gracefully', async () => {
      const storage = new FileSyncTokenStorage('/base');
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify({ other: 'token' }));

      await storage.clearSyncToken('nonexistent');

      expect(mockWriteFileSync).toHaveBeenCalledWith(
        '/base/.udl-cache/contentful-sync-tokens.json',
        JSON.stringify({ other: 'token' }, null, 2)
      );
    });
  });
});

describe('performSync', () => {
  const mockClient: ContentfulClient = {
    sync: vi.fn(),
  } as unknown as ContentfulClient;

  const baseOptions: ResolvedContentfulPluginOptions = {
    spaceId: 'space123',
    environment: 'master',
    accessToken: 'token',
    host: 'cdn.contentful.com',
    nodePrefix: 'Contentful',
    locale: 'en-US',
    downloadAssets: false,
    useNameForId: true,
    forceFullSync: false,
  };

  const mockSyncResponse = {
    entries: [{ sys: { id: 'entry1' } }] as unknown as Entry[],
    assets: [{ sys: { id: 'asset1' } }] as unknown as Asset[],
    deletedEntries: [{ sys: { id: 'deleted1' } }] as unknown as DeletedEntry[],
    deletedAssets: [
      { sys: { id: 'deletedAsset1' } },
    ] as unknown as DeletedAsset[],
    nextSyncToken: 'nextToken123',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (mockClient.sync as Mock).mockResolvedValue(mockSyncResponse);
  });

  it('performs initial sync when no token exists', async () => {
    const tokenStorage: SyncTokenStorage = {
      getSyncToken: vi.fn().mockResolvedValue(null),
      setSyncToken: vi.fn().mockResolvedValue(undefined),
    };

    const result = await performSync(mockClient, baseOptions, tokenStorage);

    expect(mockClient.sync).toHaveBeenCalledWith({ initial: true });
    expect(result.isInitialSync).toBe(true);
    expect(tokenStorage.setSyncToken).toHaveBeenCalledWith(
      'space123:master',
      'nextToken123'
    );
  });

  it('performs delta sync when token exists', async () => {
    const tokenStorage: SyncTokenStorage = {
      getSyncToken: vi.fn().mockResolvedValue('existingToken'),
      setSyncToken: vi.fn().mockResolvedValue(undefined),
    };

    const result = await performSync(mockClient, baseOptions, tokenStorage);

    expect(mockClient.sync).toHaveBeenCalledWith({
      nextSyncToken: 'existingToken',
    });
    expect(result.isInitialSync).toBe(false);
  });

  it('forces initial sync when forceFullSync is true', async () => {
    const tokenStorage: SyncTokenStorage = {
      getSyncToken: vi.fn().mockResolvedValue('existingToken'),
      setSyncToken: vi.fn().mockResolvedValue(undefined),
    };

    const options = { ...baseOptions, forceFullSync: true };
    const result = await performSync(mockClient, options, tokenStorage);

    expect(tokenStorage.getSyncToken).not.toHaveBeenCalled();
    expect(mockClient.sync).toHaveBeenCalledWith({ initial: true });
    expect(result.isInitialSync).toBe(true);
  });

  it('returns sync result with all data', async () => {
    const tokenStorage: SyncTokenStorage = {
      getSyncToken: vi.fn().mockResolvedValue(null),
      setSyncToken: vi.fn().mockResolvedValue(undefined),
    };

    const result = await performSync(mockClient, baseOptions, tokenStorage);

    expect(result).toEqual({
      entries: mockSyncResponse.entries,
      assets: mockSyncResponse.assets,
      deletedEntries: mockSyncResponse.deletedEntries,
      deletedAssets: mockSyncResponse.deletedAssets,
      nextSyncToken: 'nextToken123',
      isInitialSync: true,
    });
  });

  it('uses options.syncTokenStorage when tokenStorage not provided', async () => {
    const optionStorage: SyncTokenStorage = {
      getSyncToken: vi.fn().mockResolvedValue(null),
      setSyncToken: vi.fn().mockResolvedValue(undefined),
    };

    const options = { ...baseOptions, syncTokenStorage: optionStorage };
    await performSync(mockClient, options);

    expect(optionStorage.getSyncToken).toHaveBeenCalledWith('space123:master');
    expect(optionStorage.setSyncToken).toHaveBeenCalled();
  });

  it('falls back to FileSyncTokenStorage when no storage provided', async () => {
    mockExistsSync.mockReturnValue(false);

    await performSync(mockClient, baseOptions, undefined, '/custom/base');

    // The FileSyncTokenStorage should have been used and attempted to read/write
    expect(mockExistsSync).toHaveBeenCalled();
    expect(mockWriteFileSync).toHaveBeenCalled();
  });

  it('does not store sync token if nextSyncToken is undefined', async () => {
    const tokenStorage: SyncTokenStorage = {
      getSyncToken: vi.fn().mockResolvedValue(null),
      setSyncToken: vi.fn().mockResolvedValue(undefined),
    };

    const responseWithoutToken = {
      ...mockSyncResponse,
      nextSyncToken: undefined,
    };
    (mockClient.sync as Mock).mockResolvedValue(responseWithoutToken);

    await performSync(mockClient, baseOptions, tokenStorage);

    expect(tokenStorage.setSyncToken).not.toHaveBeenCalled();
  });
});

describe('clearSyncToken', () => {
  const baseOptions: ResolvedContentfulPluginOptions = {
    spaceId: 'space123',
    environment: 'master',
    accessToken: 'token',
    host: 'cdn.contentful.com',
    nodePrefix: 'Contentful',
    locale: 'en-US',
    downloadAssets: false,
    useNameForId: true,
    forceFullSync: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls clearSyncToken on storage when available', async () => {
    const tokenStorage: SyncTokenStorage = {
      getSyncToken: vi.fn(),
      setSyncToken: vi.fn(),
      clearSyncToken: vi.fn().mockResolvedValue(undefined),
    };

    await clearSyncToken(baseOptions, tokenStorage);

    expect(tokenStorage.clearSyncToken).toHaveBeenCalledWith('space123:master');
    expect(tokenStorage.setSyncToken).not.toHaveBeenCalled();
  });

  it('falls back to setSyncToken with empty string when clearSyncToken not available', async () => {
    const tokenStorage: SyncTokenStorage = {
      getSyncToken: vi.fn(),
      setSyncToken: vi.fn().mockResolvedValue(undefined),
      // No clearSyncToken method
    };

    await clearSyncToken(baseOptions, tokenStorage);

    expect(tokenStorage.setSyncToken).toHaveBeenCalledWith(
      'space123:master',
      ''
    );
  });

  it('uses options.syncTokenStorage when tokenStorage not provided', async () => {
    const optionStorage: SyncTokenStorage = {
      getSyncToken: vi.fn(),
      setSyncToken: vi.fn(),
      clearSyncToken: vi.fn().mockResolvedValue(undefined),
    };

    const options = { ...baseOptions, syncTokenStorage: optionStorage };
    await clearSyncToken(options);

    expect(optionStorage.clearSyncToken).toHaveBeenCalledWith(
      'space123:master'
    );
  });

  it('falls back to FileSyncTokenStorage when no storage provided', async () => {
    mockExistsSync.mockReturnValue(false);

    await clearSyncToken(baseOptions);

    // FileSyncTokenStorage should have been used
    expect(mockExistsSync).toHaveBeenCalled();
    expect(mockWriteFileSync).toHaveBeenCalled();
  });
});

describe('getSyncStats', () => {
  it('returns correct counts for all fields', () => {
    const syncResult: SyncResult = {
      entries: [
        { sys: { id: '1' } },
        { sys: { id: '2' } },
      ] as SyncResult['entries'],
      assets: [{ sys: { id: 'a1' } }] as SyncResult['assets'],
      deletedEntries: [
        { sys: { id: 'd1' } },
        { sys: { id: 'd2' } },
        { sys: { id: 'd3' } },
      ] as SyncResult['deletedEntries'],
      deletedAssets: [] as SyncResult['deletedAssets'],
      nextSyncToken: 'token',
      isInitialSync: true,
    };

    const stats = getSyncStats(syncResult);

    expect(stats).toEqual({
      entriesCount: 2,
      assetsCount: 1,
      deletedEntriesCount: 3,
      deletedAssetsCount: 0,
      isInitialSync: true,
    });
  });

  it('returns correct counts for delta sync', () => {
    const syncResult: SyncResult = {
      entries: [] as SyncResult['entries'],
      assets: [] as SyncResult['assets'],
      deletedEntries: [{ sys: { id: 'd1' } }] as SyncResult['deletedEntries'],
      deletedAssets: [{ sys: { id: 'da1' } }] as SyncResult['deletedAssets'],
      nextSyncToken: 'token',
      isInitialSync: false,
    };

    const stats = getSyncStats(syncResult);

    expect(stats).toEqual({
      entriesCount: 0,
      assetsCount: 0,
      deletedEntriesCount: 1,
      deletedAssetsCount: 1,
      isInitialSync: false,
    });
  });
});
