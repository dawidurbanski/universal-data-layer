# Remote UDL with Webhooks Demo

This manual test demonstrates the **remote UDL pattern** where data syncs from an external system via webhooks, without needing an actual remote UDL server.

**Note:** The "Remote" store persists to localStorage, so changes survive page refreshes. The webhook log is also persisted.

## What This Tests

1. **MSW Mocking** - REST API calls intercepted by Mock Service Worker
2. **Webhook Integration** - MSW handlers send webhooks to UDL after mutations
3. **Default Webhook Handler** - UDL's built-in handler processes CRUD webhooks
4. **Real-time Sync** - Data changes propagate from "remote" to UDL

## Architecture

```
┌─────────────────────┐     ┌─────────────────────┐     ┌─────────────────────┐
│   React UI          │────▶│   MSW Handlers      │────▶│   UDL Server        │
│   (Browser)         │     │   (Mock Backend)    │     │   (localhost:4000)  │
│                     │◀────│                     │     │                     │
│  • Todo list        │     │  • Intercept REST   │     │  • Receives webhooks│
│  • Add/Edit/Delete  │     │  • In-memory store  │     │  • Updates nodes    │
│  • Query UDL        │     │  • Send webhooks    │     │  • GraphQL queries  │
└─────────────────────┘     └─────────────────────┘     └─────────────────────┘
```

## Data Flow

### Initial Load

```
Plugin sourceNodes
    ↓ fetch
MSW: GET http://localhost:3001/api/todos
    ↓ mock response
Plugin creates RemoteTodo nodes in UDL
    ↓
GraphQL schema built
    ↓
UI queries UDL
```

### CRUD Operations

```
User clicks "Add Todo"
    ↓ POST
MSW: POST http://localhost:3001/api/todos
    ↓
MSW updates in-memory store
MSW sends webhook to UDL
    ↓ POST /_webhooks/remote-todo-source/sync
UDL default handler creates node
    ↓
User clicks "Refresh from UDL"
    ↓ GraphQL query
UI shows updated data
```

## Webhook Payload Format

The MSW handlers send webhooks using UDL's default webhook format:

```json
{
  "operation": "create",
  "nodeId": "RemoteTodo-4",
  "nodeType": "RemoteTodo",
  "data": {
    "todoId": 4,
    "title": "New todo item",
    "completed": false
  }
}
```

### Supported Operations

| Operation | Description          | Response                    |
| --------- | -------------------- | --------------------------- |
| `create`  | Create new node      | 201 Created (409 if exists) |
| `update`  | Update existing node | 200 OK (404 if not found)   |
| `delete`  | Delete node          | 200 OK (404 if not found)   |
| `upsert`  | Create or update     | 200 OK (always succeeds)    |

## Important: Node ID Format

The plugin uses a **predictable ID format** (`RemoteTodo-{id}`) instead of the default
`createNodeId()` function (which generates SHA-256 hashes). This allows the browser
to replicate the same IDs when sending webhooks, ensuring updates go to the correct nodes.

```typescript
// Plugin uses simple format:
const nodeId = `RemoteTodo-${todo.id}`; // "RemoteTodo-1"

// NOT the default createNodeId:
// createNodeId('RemoteTodo', '1') → "49fdbcb26d..."  (SHA-256 hash)
```

## Plugin Configuration

### Remote Todo Source (`plugins/remote-todo-source/udl.config.ts`)

```typescript
export async function sourceNodes({
  actions,
  createNodeId,
  createContentDigest,
}) {
  // Fetch from MSW-mocked endpoint
  const response = await fetch('http://localhost:3001/api/todos');
  const todos = await response.json();

  for (const todo of todos) {
    await actions.createNode({
      internal: {
        id: createNodeId('RemoteTodo', String(todo.id)),
        type: 'RemoteTodo',
        owner: 'remote-todo-source',
        contentDigest: createContentDigest(todo),
      },
      todoId: todo.id,
      title: todo.title,
      completed: todo.completed,
    });
  }
}
```

### Feature Config (`udl.config.ts`)

```typescript
export const config = defineConfig({
  plugins: [{ name: './plugins/remote-todo-source', options: {} }],
  // Enable default webhook handler
  defaultWebhook: {
    enabled: true,
    path: 'sync', // Endpoint: /_webhooks/remote-todo-source/sync
  },
});
```

## MSW Handlers

The MSW handlers in `mocks/remote-todos.ts` intercept REST calls and send webhooks:

```typescript
http.post('http://localhost:3001/api/todos', async ({ request }) => {
  const body = await request.json();
  const newTodo = { id: nextId++, ...body };
  todos.push(newTodo);

  // Send webhook to UDL
  await fetch('http://localhost:4000/_webhooks/remote-todo-source/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      operation: 'create',
      nodeId: `RemoteTodo-${newTodo.id}`,
      nodeType: 'RemoteTodo',
      data: {
        todoId: newTodo.id,
        title: newTodo.title,
        completed: newTodo.completed,
      },
    }),
  });

  return HttpResponse.json(newTodo, { status: 201 });
});
```

## Key Concepts

### Why MSW?

MSW (Mock Service Worker) intercepts HTTP requests at the network level:

- Works with any HTTP client (fetch, axios, etc.)
- Handlers run in Node.js (same process as UDL server)
- `onUnhandledRequest: 'bypass'` allows webhook requests to reach UDL

### Why Manual Refresh?

This demo uses manual refresh to clearly demonstrate:

1. CRUD operation happens (REST call)
2. Webhook is sent to UDL
3. User explicitly refreshes to see changes

In production, you might use:

- Automatic refresh after webhook debounce
- WebSocket for real-time updates
- Polling at intervals

### Reset Remote Store Button

The "Reset Remote Store" button:

1. Resets the Remote store to initial 3 items
2. Calculates what changed (deleted items, added items, modified items)
3. Sends reconciliation webhooks to UDL to sync:
   - CREATE webhooks for items that need to be restored
   - DELETE webhooks for items that were added and need removal
   - UPDATE webhooks for items that were modified
4. Clears the webhook log

This ensures UDL always mirrors the Remote store state.

### Default Webhook Handler

UDL's default webhook handler provides:

- Standardized CRUD operations
- Automatic node management
- No custom handler code needed

Enable in config:

```typescript
defaultWebhook: {
  enabled: true,
  path: 'sync',
}
```

## Testing Steps

1. Start the UDL server (`npm run dev` in packages/core)
2. Open the manual test harness
3. Navigate to "Remote UDL with Webhooks"
4. Initial todos should load automatically
5. Add a new todo using the form
6. Click "Refresh from UDL" to see the new todo
7. Toggle a todo's completion status
8. Click "Refresh from UDL" to see the change
9. Delete a todo
10. Click "Refresh from UDL" to verify deletion
