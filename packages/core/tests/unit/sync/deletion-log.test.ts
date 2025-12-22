import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  DeletionLog,
  type DeletionLogData,
  type DeletionNodeInfo,
} from '@/sync/deletionLog.js';

/** Helper to create a mock node for testing */
function createMockNode(
  overrides: Partial<DeletionNodeInfo['internal']> = {}
): DeletionNodeInfo {
  return {
    internal: {
      id: 'node-1',
      type: 'TestNode',
      owner: 'test-plugin',
      ...overrides,
    },
  };
}

describe('DeletionLog', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-06-15T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('constructor', () => {
    it('creates an empty deletion log', () => {
      const log = new DeletionLog();
      expect(log.size()).toBe(0);
    });

    it('accepts custom TTL in days', () => {
      const log = new DeletionLog(7);
      expect(log.size()).toBe(0);
    });
  });

  describe('recordDeletion', () => {
    it('adds entry with correct fields', () => {
      const log = new DeletionLog();
      const node = createMockNode({
        id: 'product-123',
        type: 'Product',
        owner: 'shopify-plugin',
      });

      log.recordDeletion(node);

      expect(log.size()).toBe(1);
      const entries = log.getDeletedSince(new Date(0));
      expect(entries).toHaveLength(1);
      expect(entries[0]).toEqual({
        nodeId: 'product-123',
        nodeType: 'Product',
        owner: 'shopify-plugin',
        deletedAt: '2024-06-15T12:00:00.000Z',
      });
    });

    it('adds entry with current timestamp', () => {
      const log = new DeletionLog();

      log.recordDeletion(createMockNode());

      const entries = log.getDeletedSince(new Date(0));
      expect(entries[0].deletedAt).toBe('2024-06-15T12:00:00.000Z');
    });

    it('records multiple deletions', () => {
      const log = new DeletionLog();

      log.recordDeletion(createMockNode({ id: 'node-1' }));
      vi.advanceTimersByTime(1000);
      log.recordDeletion(createMockNode({ id: 'node-2' }));
      vi.advanceTimersByTime(1000);
      log.recordDeletion(createMockNode({ id: 'node-3' }));

      expect(log.size()).toBe(3);
    });
  });

  describe('getDeletedSince', () => {
    it('returns entries deleted after the given timestamp', () => {
      const log = new DeletionLog();

      // Record at 12:00
      log.recordDeletion(createMockNode({ id: 'node-1' }));

      // Advance 1 hour and record
      vi.advanceTimersByTime(60 * 60 * 1000);
      log.recordDeletion(createMockNode({ id: 'node-2' }));

      // Query for entries after 12:30
      const entries = log.getDeletedSince('2024-06-15T12:30:00.000Z');
      expect(entries).toHaveLength(1);
      expect(entries[0].nodeId).toBe('node-2');
    });

    it('returns empty array when no matches', () => {
      const log = new DeletionLog();

      log.recordDeletion(createMockNode());

      const entries = log.getDeletedSince('2024-06-15T13:00:00.000Z');
      expect(entries).toHaveLength(0);
    });

    it('returns empty array when log is empty', () => {
      const log = new DeletionLog();

      const entries = log.getDeletedSince(new Date(0));
      expect(entries).toHaveLength(0);
    });

    it('works with Date objects', () => {
      const log = new DeletionLog();

      log.recordDeletion(createMockNode({ id: 'node-1' }));

      const entries = log.getDeletedSince(new Date('2024-06-15T11:00:00.000Z'));
      expect(entries).toHaveLength(1);
    });

    it('works with ISO string timestamps', () => {
      const log = new DeletionLog();

      log.recordDeletion(createMockNode({ id: 'node-1' }));

      const entries = log.getDeletedSince('2024-06-15T11:00:00.000Z');
      expect(entries).toHaveLength(1);
    });

    it('excludes entries at exactly the given timestamp', () => {
      const log = new DeletionLog();

      log.recordDeletion(createMockNode());

      const entries = log.getDeletedSince('2024-06-15T12:00:00.000Z');
      expect(entries).toHaveLength(0);
    });
  });

  describe('cleanup', () => {
    it('removes entries older than TTL', () => {
      const log = new DeletionLog(30); // 30 day TTL

      // Record at current time
      log.recordDeletion(createMockNode({ id: 'node-1' }));

      // Advance 31 days
      vi.advanceTimersByTime(31 * 24 * 60 * 60 * 1000);

      const removed = log.cleanup();

      expect(removed).toBe(1);
      expect(log.size()).toBe(0);
    });

    it('keeps entries within TTL', () => {
      const log = new DeletionLog(30);

      log.recordDeletion(createMockNode({ id: 'node-1' }));

      // Advance 29 days
      vi.advanceTimersByTime(29 * 24 * 60 * 60 * 1000);

      const removed = log.cleanup();

      expect(removed).toBe(0);
      expect(log.size()).toBe(1);
    });

    it('returns correct count of removed entries', () => {
      const log = new DeletionLog(1); // 1 day TTL

      // Record 3 nodes
      log.recordDeletion(createMockNode({ id: 'node-1' }));
      log.recordDeletion(createMockNode({ id: 'node-2' }));
      log.recordDeletion(createMockNode({ id: 'node-3' }));

      // Advance 2 days
      vi.advanceTimersByTime(2 * 24 * 60 * 60 * 1000);

      const removed = log.cleanup();

      expect(removed).toBe(3);
    });

    it('only removes entries older than TTL', () => {
      const log = new DeletionLog(1); // 1 day TTL

      // Record old node
      log.recordDeletion(createMockNode({ id: 'old-node' }));

      // Advance 2 days
      vi.advanceTimersByTime(2 * 24 * 60 * 60 * 1000);

      // Record new node
      log.recordDeletion(createMockNode({ id: 'new-node' }));

      const removed = log.cleanup();

      expect(removed).toBe(1);
      expect(log.size()).toBe(1);
      const entries = log.getDeletedSince(new Date(0));
      expect(entries[0].nodeId).toBe('new-node');
    });

    it('works with custom TTL', () => {
      const log = new DeletionLog(7); // 7 day TTL

      log.recordDeletion(createMockNode());

      // Advance 8 days
      vi.advanceTimersByTime(8 * 24 * 60 * 60 * 1000);

      const removed = log.cleanup();
      expect(removed).toBe(1);
    });
  });

  describe('toJSON', () => {
    it('returns serializable data structure', () => {
      const log = new DeletionLog();

      log.recordDeletion(createMockNode({ id: 'node-1' }));

      const data = log.toJSON();

      expect(data).toEqual({
        entries: [
          {
            nodeId: 'node-1',
            nodeType: 'TestNode',
            owner: 'test-plugin',
            deletedAt: '2024-06-15T12:00:00.000Z',
          },
        ],
        lastCleanup: '2024-06-15T12:00:00.000Z',
      });
    });

    it('returns copy of entries (not reference)', () => {
      const log = new DeletionLog();

      log.recordDeletion(createMockNode());

      const data1 = log.toJSON();
      const data2 = log.toJSON();

      expect(data1.entries).not.toBe(data2.entries);
    });
  });

  describe('fromJSON', () => {
    it('restores deletion log from persisted data', () => {
      const data: DeletionLogData = {
        entries: [
          {
            nodeId: 'node-1',
            nodeType: 'Product',
            owner: 'shopify',
            deletedAt: '2024-06-15T11:00:00.000Z',
          },
        ],
        lastCleanup: '2024-06-15T11:00:00.000Z',
      };

      const log = DeletionLog.fromJSON(data);

      expect(log.size()).toBe(1);
      const entries = log.getDeletedSince(new Date(0));
      expect(entries[0].nodeId).toBe('node-1');
    });

    it('runs cleanup on load', () => {
      const data: DeletionLogData = {
        entries: [
          {
            nodeId: 'old-node',
            nodeType: 'TestNode',
            owner: 'test-plugin',
            deletedAt: '2024-05-01T00:00:00.000Z', // 45 days old
          },
          {
            nodeId: 'new-node',
            nodeType: 'TestNode',
            owner: 'test-plugin',
            deletedAt: '2024-06-15T11:00:00.000Z', // 1 hour old
          },
        ],
        lastCleanup: '2024-05-01T00:00:00.000Z',
      };

      const log = DeletionLog.fromJSON(data);

      // Old entry should be cleaned up
      expect(log.size()).toBe(1);
      const entries = log.getDeletedSince(new Date(0));
      expect(entries[0].nodeId).toBe('new-node');
    });

    it('accepts custom TTL override', () => {
      const data: DeletionLogData = {
        entries: [
          {
            nodeId: 'node-1',
            nodeType: 'TestNode',
            owner: 'test-plugin',
            deletedAt: '2024-06-10T00:00:00.000Z', // 5 days old
          },
        ],
        lastCleanup: '2024-06-10T00:00:00.000Z',
      };

      // With 3 day TTL, entry should be cleaned up
      const log = DeletionLog.fromJSON(data, 3);
      expect(log.size()).toBe(0);
    });

    it('creates copy of entries (not reference)', () => {
      const data: DeletionLogData = {
        entries: [
          {
            nodeId: 'node-1',
            nodeType: 'TestNode',
            owner: 'test-plugin',
            deletedAt: '2024-06-15T11:00:00.000Z',
          },
        ],
        lastCleanup: '2024-06-15T11:00:00.000Z',
      };

      const log = DeletionLog.fromJSON(data);

      // Mutating original should not affect log
      data.entries[0].nodeId = 'mutated';

      const entries = log.getDeletedSince(new Date(0));
      expect(entries[0].nodeId).toBe('node-1');
    });
  });

  describe('size', () => {
    it('returns 0 for empty log', () => {
      const log = new DeletionLog();
      expect(log.size()).toBe(0);
    });

    it('returns correct count after additions', () => {
      const log = new DeletionLog();

      log.recordDeletion(createMockNode({ id: 'node-1' }));
      expect(log.size()).toBe(1);

      log.recordDeletion(createMockNode({ id: 'node-2' }));
      expect(log.size()).toBe(2);
    });

    it('returns correct count after cleanup', () => {
      const log = new DeletionLog(1);

      log.recordDeletion(createMockNode());
      expect(log.size()).toBe(1);

      vi.advanceTimersByTime(2 * 24 * 60 * 60 * 1000);
      log.cleanup();

      expect(log.size()).toBe(0);
    });
  });

  describe('round-trip serialization', () => {
    it('preserves all data through toJSON/fromJSON cycle', () => {
      const original = new DeletionLog();

      original.recordDeletion(
        createMockNode({
          id: 'product-1',
          type: 'Product',
          owner: 'shopify',
        })
      );

      vi.advanceTimersByTime(1000);

      original.recordDeletion(
        createMockNode({
          id: 'post-1',
          type: 'BlogPost',
          owner: 'contentful',
        })
      );

      const json = original.toJSON();
      const restored = DeletionLog.fromJSON(json);

      expect(restored.size()).toBe(2);

      const entries = restored.getDeletedSince(new Date(0));
      expect(entries).toHaveLength(2);
      expect(entries[0].nodeId).toBe('product-1');
      expect(entries[1].nodeId).toBe('post-1');
    });
  });
});
