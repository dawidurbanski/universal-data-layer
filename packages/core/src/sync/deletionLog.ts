/**
 * Entry in the deletion log tracking a deleted node
 */
export interface DeletionLogEntry {
  /** Node ID that was deleted */
  nodeId: string;
  /** Node type (for filtering) */
  nodeType: string;
  /** Plugin that owned the node */
  owner: string;
  /** ISO 8601 timestamp of deletion */
  deletedAt: string;
}

/**
 * Serializable deletion log data structure
 */
export interface DeletionLogData {
  /** Deletion entries */
  entries: DeletionLogEntry[];
  /** Last cleanup timestamp (ISO 8601) */
  lastCleanup: string;
}

/** Default TTL in days */
const DEFAULT_TTL_DAYS = 30;

/**
 * Minimal node information required for recording a deletion
 */
export interface DeletionNodeInfo {
  internal: {
    id: string;
    type: string;
    owner: string;
  };
}

/**
 * Tracks node deletions with timestamps for partial sync support.
 *
 * The deletion log enables clients to perform partial sync by querying
 * "what was deleted since timestamp X?" and removing those nodes from
 * their local cache.
 *
 * Entries are automatically cleaned up after the TTL expires (default: 30 days).
 *
 * @example
 * ```ts
 * const log = new DeletionLog();
 *
 * // Record a deletion
 * log.recordDeletion(node);
 *
 * // Query deletions since a timestamp
 * const deleted = log.getDeletedSince('2024-01-01T00:00:00.000Z');
 *
 * // Serialize for persistence
 * const data = log.toJSON();
 *
 * // Restore from persistence
 * const restored = DeletionLog.fromJSON(data);
 * ```
 */
export class DeletionLog {
  private entries: DeletionLogEntry[] = [];
  private readonly ttlMs: number;

  /**
   * Create a new deletion log.
   * @param ttlDays - Time-to-live for entries in days (default: 30)
   */
  constructor(ttlDays: number = DEFAULT_TTL_DAYS) {
    this.ttlMs = ttlDays * 24 * 60 * 60 * 1000;
  }

  /**
   * Record a node deletion.
   * @param node - The node that was deleted (must have internal.id, internal.type, internal.owner)
   */
  recordDeletion(node: DeletionNodeInfo): void {
    const entry: DeletionLogEntry = {
      nodeId: node.internal.id,
      nodeType: node.internal.type,
      owner: node.internal.owner,
      deletedAt: new Date().toISOString(),
    };

    this.entries.push(entry);
  }

  /**
   * Get all deletions since a given timestamp.
   * @param since - ISO 8601 timestamp string or Date object
   * @returns Array of deletion entries after the given timestamp
   */
  getDeletedSince(since: string | Date): DeletionLogEntry[] {
    const sinceMs = new Date(since).getTime();
    return this.entries.filter(
      (entry) => new Date(entry.deletedAt).getTime() > sinceMs
    );
  }

  /**
   * Clean up entries older than TTL.
   * @returns Number of entries removed
   */
  cleanup(): number {
    const cutoff = Date.now() - this.ttlMs;
    const before = this.entries.length;

    this.entries = this.entries.filter(
      (entry) => new Date(entry.deletedAt).getTime() > cutoff
    );

    return before - this.entries.length;
  }

  /**
   * Serialize the deletion log for persistence.
   * @returns Serializable deletion log data
   */
  toJSON(): DeletionLogData {
    return {
      entries: [...this.entries],
      lastCleanup: new Date().toISOString(),
    };
  }

  /**
   * Restore a deletion log from persisted data.
   * Runs cleanup on load to remove expired entries.
   *
   * @param data - Persisted deletion log data
   * @param ttlDays - Optional TTL override (default: 30)
   * @returns Restored DeletionLog instance
   */
  static fromJSON(data: DeletionLogData, ttlDays?: number): DeletionLog {
    const log = new DeletionLog(ttlDays);
    log.entries = data.entries.map((entry) => ({ ...entry }));
    log.cleanup();
    return log;
  }

  /**
   * Get the current number of entries.
   * @returns Entry count
   */
  size(): number {
    return this.entries.length;
  }
}
