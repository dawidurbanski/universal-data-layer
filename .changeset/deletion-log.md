---
'universal-data-layer': minor
---

Add deletion log for partial sync support

This release introduces a DeletionLog class that tracks node deletions with timestamps, enabling clients to perform partial sync without needing a full refetch.

**Features:**

- `DeletionLog` class for tracking deleted nodes
- `recordDeletion(node)`: Record a node deletion with timestamp
- `getDeletedSince(timestamp)`: Query deletions after a given time
- `cleanup()`: Remove entries older than TTL (default: 30 days)
- Serialization support via `toJSON()` and `fromJSON()` for persistence
- Configurable TTL (time-to-live) for deletion entries

**Example usage:**

```typescript
import { DeletionLog } from 'universal-data-layer';

const log = new DeletionLog(30); // 30 day TTL

// Record a deletion
log.recordDeletion(deletedNode);

// Query deletions since last sync
const deletedSince = log.getDeletedSince(lastSyncTimestamp);

// Serialize for persistence
const data = log.toJSON();

// Restore from persistence
const restored = DeletionLog.fromJSON(data);
```
