import type { IncomingMessage, ServerResponse } from 'node:http';
import { URL } from 'node:url';
import { defaultStore } from '@/nodes/defaultStore.js';
import { defaultDeletionLog } from '@/sync/index.js';
import type { Node } from '@/nodes/types.js';

/**
 * Response format for the sync endpoint.
 * Contains updated nodes, deleted node IDs, and metadata for the next sync.
 */
export interface SyncResponse {
  /** Nodes created or updated since the given timestamp */
  updated: Node[];
  /** Node IDs deleted since the given timestamp */
  deleted: {
    nodeId: string;
    nodeType: string;
    deletedAt: string;
  }[];
  /** Server timestamp for the next sync (use as `since` for subsequent calls) */
  serverTime: string;
  /** Whether there are more updates (pagination - not implemented yet) */
  hasMore: boolean;
}

/**
 * Sync endpoint handler.
 * Returns nodes updated and deleted since a given timestamp.
 *
 * @example
 * ```
 * GET /_sync?since=2024-01-01T00:00:00Z
 * GET /_sync?since=2024-01-01T00:00:00Z&types=Product,Collection
 * ```
 *
 * @param req - HTTP request
 * @param res - HTTP response
 */
export function syncHandler(req: IncomingMessage, res: ServerResponse): void {
  if (req.method !== 'GET') {
    res.writeHead(405, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Method not allowed' }));
    return;
  }

  const url = new URL(req.url!, `http://${req.headers.host}`);
  const since = url.searchParams.get('since');
  const typesParam = url.searchParams.get('types');

  if (!since) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Missing required parameter: since' }));
    return;
  }

  let sinceDate: Date;
  try {
    sinceDate = new Date(since);
    if (isNaN(sinceDate.getTime())) {
      throw new Error('Invalid date');
    }
  } catch {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({ error: 'Invalid date format for since parameter' })
    );
    return;
  }

  const types = typesParam ? typesParam.split(',').map((t) => t.trim()) : null;
  const sinceMs = sinceDate.getTime();

  // Get updated nodes
  let allNodes = defaultStore.getAll();

  // Filter by type if specified
  if (types) {
    allNodes = allNodes.filter((node) => types.includes(node.internal.type));
  }

  // Filter by modifiedAt (nodes updated after the since timestamp)
  const updated = allNodes.filter((node) => {
    const modifiedAt = node.internal.modifiedAt;
    if (!modifiedAt) return false;
    return modifiedAt > sinceMs;
  });

  // Get deleted nodes
  const deletedEntries = defaultDeletionLog.getDeletedSince(sinceDate);
  const filteredDeleted = types
    ? deletedEntries.filter((entry) => types.includes(entry.nodeType))
    : deletedEntries;

  const response: SyncResponse = {
    updated,
    deleted: filteredDeleted.map((entry) => ({
      nodeId: entry.nodeId,
      nodeType: entry.nodeType,
      deletedAt: entry.deletedAt,
    })),
    serverTime: new Date().toISOString(),
    hasMore: false,
  };

  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(response));
}
