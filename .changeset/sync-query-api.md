---
'universal-data-layer': minor
---

Add sync query API for partial updates

This release introduces a `GET /_sync` endpoint that enables clients to fetch only the nodes that have changed since their last sync. This enables efficient incremental synchronization without requiring a full data refetch.

**Features:**

- `GET /_sync?since={timestamp}` endpoint for querying changes
- Returns updated nodes and deleted node IDs since the given timestamp
- Optional type filtering via `types` query parameter
- Server timestamp included for use in subsequent sync calls
- Integrates with DeletionLog for tracking deleted nodes

**Response format:**

```typescript
interface SyncResponse {
  updated: Node[]; // Nodes modified after timestamp
  deleted: DeletionLogEntry[]; // Nodes deleted after timestamp
  serverTime: string; // ISO 8601 timestamp for next sync
  hasMore: boolean; // Reserved for future pagination
}
```

**Example usage:**

```typescript
// Initial sync - get all changes since epoch
const response = await fetch(
  'http://localhost:4000/_sync?since=1970-01-01T00:00:00Z'
);
const { updated, deleted, serverTime } = await response.json();

// Store serverTime for next sync
localStorage.setItem('lastSync', serverTime);

// Subsequent sync - get only recent changes
const lastSync = localStorage.getItem('lastSync');
const response = await fetch(`http://localhost:4000/_sync?since=${lastSync}`);
```

**Type filtering:**

```
GET /_sync?since=2024-01-01T00:00:00Z&types=Product,Collection
```

Only returns changes for the specified node types.
