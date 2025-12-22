import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FileCacheStorage } from '@/cache/file-cache.js';
import type { CachedData, SerializedNode } from '@/cache/types.js';
import type { DeletionLogData } from '@/sync/index.js';
import * as fs from 'node:fs';

/** Helper to create a valid test node */
function createTestNode(
  overrides: Partial<SerializedNode> & { id?: string; _type?: string } = {}
): SerializedNode {
  const { id = 'node-1', _type = 'TestNode', ...rest } = overrides;
  return {
    internal: {
      id,
      type: _type,
      contentDigest: 'test-digest',
      owner: 'test-plugin',
      createdAt: 1000,
      modifiedAt: 2000,
    },
    ...rest,
  };
}

// Mock node:fs module
vi.mock('node:fs', () => ({
  existsSync: vi.fn(),
  mkdirSync: vi.fn(),
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  unlinkSync: vi.fn(),
}));

describe('FileCacheStorage', () => {
  const mockBasePath = '/test/project';
  const expectedFilePath = '/test/project/.udl-cache/nodes.json';

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should use provided base path', () => {
      const cache = new FileCacheStorage(mockBasePath);
      // We verify the path is correct by testing load() behavior
      vi.mocked(fs.existsSync).mockReturnValue(false);
      cache.load();
      expect(fs.existsSync).toHaveBeenCalledWith(expectedFilePath);
    });

    it('should default to process.cwd() when no base path provided', () => {
      const originalCwd = process.cwd();
      const cache = new FileCacheStorage();
      vi.mocked(fs.existsSync).mockReturnValue(false);
      cache.load();
      expect(fs.existsSync).toHaveBeenCalledWith(
        `${originalCwd}/.udl-cache/nodes.json`
      );
    });
  });

  describe('load', () => {
    it('should return null when cache file does not exist', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      const cache = new FileCacheStorage(mockBasePath);

      const result = await cache.load();

      expect(result).toBeNull();
      expect(fs.existsSync).toHaveBeenCalledWith(expectedFilePath);
      expect(fs.readFileSync).not.toHaveBeenCalled();
    });

    it('should load and return valid cached data', async () => {
      const cachedData: CachedData = {
        nodes: [createTestNode()],
        indexes: { TestNode: ['id'] },
        meta: {
          version: 1,
          createdAt: 1000,
          updatedAt: 2000,
        },
      };

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(cachedData));

      const cache = new FileCacheStorage(mockBasePath);
      const result = await cache.load();

      expect(result).toEqual(cachedData);
      expect(fs.readFileSync).toHaveBeenCalledWith(expectedFilePath, 'utf-8');
    });

    it('should return null when cache version mismatches', async () => {
      const cachedData: CachedData = {
        nodes: [],
        indexes: {},
        meta: {
          version: 999, // Wrong version
          createdAt: 1000,
          updatedAt: 2000,
        },
      };

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(cachedData));

      const cache = new FileCacheStorage(mockBasePath);
      const result = await cache.load();

      expect(result).toBeNull();
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Cache version mismatch')
      );
    });

    it('should return null when meta.version is undefined', async () => {
      const cachedData = {
        nodes: [],
        indexes: {},
        meta: {
          createdAt: 1000,
          updatedAt: 2000,
          // version is missing
        },
      };

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(cachedData));

      const cache = new FileCacheStorage(mockBasePath);
      const result = await cache.load();

      expect(result).toBeNull();
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Cache version mismatch')
      );
    });

    it('should return null when meta is undefined', async () => {
      const cachedData = {
        nodes: [],
        indexes: {},
        // meta is missing entirely
      };

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(cachedData));

      const cache = new FileCacheStorage(mockBasePath);
      const result = await cache.load();

      expect(result).toBeNull();
    });

    it('should return null and warn when JSON parse fails', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue('invalid json {{{');

      const cache = new FileCacheStorage(mockBasePath);
      const result = await cache.load();

      expect(result).toBeNull();
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('Failed to load cache'),
        expect.any(Error)
      );
    });

    it('should return null and warn when readFileSync throws', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockImplementation(() => {
        throw new Error('Permission denied');
      });

      const cache = new FileCacheStorage(mockBasePath);
      const result = await cache.load();

      expect(result).toBeNull();
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('Failed to load cache'),
        expect.any(Error)
      );
    });
  });

  describe('save', () => {
    it('should create directory if it does not exist', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      const cache = new FileCacheStorage(mockBasePath);
      const data: CachedData = {
        nodes: [],
        indexes: {},
        meta: { version: 1, createdAt: 1000, updatedAt: 2000 },
      };

      await cache.save(data);

      expect(fs.mkdirSync).toHaveBeenCalledWith('/test/project/.udl-cache', {
        recursive: true,
      });
    });

    it('should not create directory if it already exists', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);

      const cache = new FileCacheStorage(mockBasePath);
      const data: CachedData = {
        nodes: [],
        indexes: {},
        meta: { version: 1, createdAt: 1000, updatedAt: 2000 },
      };

      await cache.save(data);

      expect(fs.mkdirSync).not.toHaveBeenCalled();
    });

    it('should write cache data with version and updatedAt', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);

      const cache = new FileCacheStorage(mockBasePath);
      const data: CachedData = {
        nodes: [createTestNode()],
        indexes: { TestNode: ['id'] },
        meta: { version: 0, createdAt: 1000, updatedAt: 0 },
      };

      const beforeSave = Date.now();
      await cache.save(data);
      const afterSave = Date.now();

      expect(fs.writeFileSync).toHaveBeenCalledTimes(1);
      const [filePath, content] = vi.mocked(fs.writeFileSync).mock.calls[0] as [
        string,
        string,
      ];
      expect(filePath).toBe(expectedFilePath);

      const savedData = JSON.parse(content) as CachedData;
      expect(savedData.nodes).toEqual(data.nodes);
      expect(savedData.indexes).toEqual(data.indexes);
      expect(savedData.meta.version).toBe(1); // Should be CACHE_VERSION
      expect(savedData.meta.createdAt).toBe(1000);
      expect(savedData.meta.updatedAt).toBeGreaterThanOrEqual(beforeSave);
      expect(savedData.meta.updatedAt).toBeLessThanOrEqual(afterSave);
    });

    it('should preserve existing meta fields while updating version and updatedAt', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);

      const cache = new FileCacheStorage(mockBasePath);
      const data: CachedData = {
        nodes: [],
        indexes: {},
        meta: { version: 0, createdAt: 5000, updatedAt: 6000 },
      };

      await cache.save(data);

      const [, content] = vi.mocked(fs.writeFileSync).mock.calls[0] as [
        string,
        string,
      ];
      const savedData = JSON.parse(content) as CachedData;
      expect(savedData.meta.createdAt).toBe(5000); // Preserved
      expect(savedData.meta.version).toBe(1); // Updated to CACHE_VERSION
    });

    it('should handle circular references in data', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);

      const cache = new FileCacheStorage(mockBasePath);

      // Create circular reference within the node structure
      const nodeWithCircular = createTestNode() as SerializedNode & {
        self?: unknown;
      };
      nodeWithCircular.self = nodeWithCircular;

      const data: CachedData = {
        nodes: [nodeWithCircular],
        indexes: {},
        meta: { version: 1, createdAt: 1000, updatedAt: 2000 },
      };

      // Should not throw
      await cache.save(data);

      expect(fs.writeFileSync).toHaveBeenCalled();
      const [, content] = vi.mocked(fs.writeFileSync).mock.calls[0] as [
        string,
        string,
      ];
      expect(content).toContain('[Circular]');
    });

    it('should handle null values in data', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);

      const cache = new FileCacheStorage(mockBasePath);
      const nodeWithNull = createTestNode() as SerializedNode & {
        value?: unknown;
      };
      nodeWithNull.value = null;
      const data: CachedData = {
        nodes: [nodeWithNull],
        indexes: {},
        meta: { version: 1, createdAt: 1000, updatedAt: 2000 },
      };

      await cache.save(data);

      const [, content] = vi.mocked(fs.writeFileSync).mock.calls[0] as [
        string,
        string,
      ];
      const savedData = JSON.parse(content);
      expect(savedData.nodes[0].value).toBeNull();
    });
  });

  describe('clear', () => {
    it('should delete cache file if it exists', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);

      const cache = new FileCacheStorage(mockBasePath);
      await cache.clear();

      expect(fs.existsSync).toHaveBeenCalledWith(expectedFilePath);
      expect(fs.unlinkSync).toHaveBeenCalledWith(expectedFilePath);
    });

    it('should not attempt to delete if cache file does not exist', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      const cache = new FileCacheStorage(mockBasePath);
      await cache.clear();

      expect(fs.existsSync).toHaveBeenCalledWith(expectedFilePath);
      expect(fs.unlinkSync).not.toHaveBeenCalled();
    });
  });
});

describe('safeStringify (via FileCacheStorage.save)', () => {
  // safeStringify is tested indirectly through save() tests
  // Additional edge case tests for the replacer function

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should handle primitive values correctly via save', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);

    const cache = new FileCacheStorage('/test');
    const nodeWithPrimitives = createTestNode() as SerializedNode & {
      stringVal: string;
      numberVal: number;
      boolVal: boolean;
      nullVal: null;
    };
    nodeWithPrimitives.stringVal = 'hello';
    nodeWithPrimitives.numberVal = 42;
    nodeWithPrimitives.boolVal = true;
    nodeWithPrimitives.nullVal = null;

    const data: CachedData = {
      nodes: [nodeWithPrimitives],
      indexes: {},
      meta: { version: 1, createdAt: 1000, updatedAt: 2000 },
    };

    await cache.save(data);

    const [, content] = vi.mocked(fs.writeFileSync).mock.calls[0] as [
      string,
      string,
    ];
    const savedData = JSON.parse(content);
    expect(savedData.nodes[0].stringVal).toBe('hello');
    expect(savedData.nodes[0].numberVal).toBe(42);
    expect(savedData.nodes[0].boolVal).toBe(true);
    expect(savedData.nodes[0].nullVal).toBeNull();
  });

  it('should handle nested objects correctly via save', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);

    const cache = new FileCacheStorage('/test');
    const nodeWithNested = createTestNode() as SerializedNode & {
      nested: { deep: { value: string } };
    };
    nodeWithNested.nested = { deep: { value: 'found' } };

    const data: CachedData = {
      nodes: [nodeWithNested],
      indexes: {},
      meta: { version: 1, createdAt: 1000, updatedAt: 2000 },
    };

    await cache.save(data);

    const [, content] = vi.mocked(fs.writeFileSync).mock.calls[0] as [
      string,
      string,
    ];
    const savedData = JSON.parse(content);
    expect(savedData.nodes[0].nested.deep.value).toBe('found');
  });

  it('should handle arrays correctly via save', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);

    const cache = new FileCacheStorage('/test');
    const nodeWithArray = createTestNode() as SerializedNode & {
      items: unknown[];
    };
    nodeWithArray.items = [1, 2, { nested: true }];

    const data: CachedData = {
      nodes: [nodeWithArray],
      indexes: {},
      meta: { version: 1, createdAt: 1000, updatedAt: 2000 },
    };

    await cache.save(data);

    const [, content] = vi.mocked(fs.writeFileSync).mock.calls[0] as [
      string,
      string,
    ];
    const savedData = JSON.parse(content);
    expect(savedData.nodes[0].items).toEqual([1, 2, { nested: true }]);
  });

  it('should handle deeply nested circular references via save', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);

    const cache = new FileCacheStorage('/test');

    const inner: Record<string, unknown> = { value: 'inner' };
    const outer: Record<string, unknown> = { inner };
    inner['parent'] = outer; // Circular reference

    const nodeWithDeepCircular = createTestNode() as SerializedNode & {
      data: Record<string, unknown>;
    };
    nodeWithDeepCircular.data = outer;

    const data: CachedData = {
      nodes: [nodeWithDeepCircular],
      indexes: {},
      meta: { version: 1, createdAt: 1000, updatedAt: 2000 },
    };

    await cache.save(data);

    const [, content] = vi.mocked(fs.writeFileSync).mock.calls[0] as [
      string,
      string,
    ];
    expect(content).toContain('[Circular]');
  });
});

describe('FileCacheStorage deletion log persistence', () => {
  const mockBasePath = '/test/project';

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should save deletion log when present in data', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);

    const deletionLog: DeletionLogData = {
      entries: [
        {
          nodeId: 'node-1',
          nodeType: 'Product',
          owner: 'shopify-plugin',
          deletedAt: '2024-06-15T12:00:00.000Z',
        },
      ],
      lastCleanup: '2024-06-15T12:00:00.000Z',
    };

    const cache = new FileCacheStorage(mockBasePath);
    const data: CachedData = {
      nodes: [],
      indexes: {},
      deletionLog,
      meta: { version: 1, createdAt: 1000, updatedAt: 2000 },
    };

    await cache.save(data);

    const [, content] = vi.mocked(fs.writeFileSync).mock.calls[0] as [
      string,
      string,
    ];
    const savedData = JSON.parse(content) as CachedData;
    expect(savedData.deletionLog).toEqual(deletionLog);
  });

  it('should load deletion log when present in cached data', async () => {
    const deletionLog: DeletionLogData = {
      entries: [
        {
          nodeId: 'node-1',
          nodeType: 'Product',
          owner: 'shopify-plugin',
          deletedAt: '2024-06-15T12:00:00.000Z',
        },
        {
          nodeId: 'node-2',
          nodeType: 'BlogPost',
          owner: 'contentful-plugin',
          deletedAt: '2024-06-15T13:00:00.000Z',
        },
      ],
      lastCleanup: '2024-06-15T12:00:00.000Z',
    };

    const cachedData: CachedData = {
      nodes: [],
      indexes: {},
      deletionLog,
      meta: { version: 1, createdAt: 1000, updatedAt: 2000 },
    };

    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(cachedData));

    const cache = new FileCacheStorage(mockBasePath);
    const result = await cache.load();

    expect(result?.deletionLog).toEqual(deletionLog);
  });

  it('should return undefined deletionLog when not present (backwards compatibility)', async () => {
    const cachedData: CachedData = {
      nodes: [],
      indexes: {},
      // deletionLog is not present
      meta: { version: 1, createdAt: 1000, updatedAt: 2000 },
    };

    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(cachedData));

    const cache = new FileCacheStorage(mockBasePath);
    const result = await cache.load();

    expect(result?.deletionLog).toBeUndefined();
  });
});
