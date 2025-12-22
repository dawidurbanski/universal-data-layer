/**
 * Remote UDL with Webhooks - Manual Test UI
 *
 * This component demonstrates the remote UDL pattern:
 * 1. CRUD operations are handled in an in-memory "remote" store (simulating a backend)
 * 2. After each mutation, a webhook is sent to UDL
 * 3. User clicks "Refresh from UDL" to see the synced data
 *
 * Note: The "remote" store is in-memory in the browser. In a real scenario,
 * this would be a separate backend service sending webhooks.
 */

import { useState, useEffect, useRef } from 'react';
import { udl, gql } from 'universal-data-layer/client';

interface Todo {
  id: number;
  title: string;
  completed: boolean;
}

interface RemoteTodo {
  todoId: number;
  title: string;
  completed: boolean;
  internal: {
    id: string;
    type: string;
    owner: string;
    contentDigest: string;
  };
}

// UDL server webhook endpoint
const UDL_WEBHOOK_URL =
  'http://localhost:4000/_webhooks/remote-todo-source/sync';

// Initial seed data (matches what sourceNodes loads)
const initialTodos: Todo[] = [
  { id: 1, title: 'Learn UDL', completed: false },
  { id: 2, title: 'Build awesome apps', completed: false },
  { id: 3, title: 'Test webhooks', completed: true },
];

// localStorage keys
const STORAGE_KEY_TODOS = 'udl-remote-webhooks-todos';
const STORAGE_KEY_NEXT_ID = 'udl-remote-webhooks-next-id';
const STORAGE_KEY_WEBHOOK_LOG = 'udl-remote-webhooks-log';

// Load persisted data from localStorage
function loadPersistedTodos(): Todo[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_TODOS);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.error('[RemoteUDL] Failed to load todos from localStorage:', e);
  }
  return [...initialTodos];
}

function loadPersistedNextId(): number {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_NEXT_ID);
    if (stored) {
      return parseInt(stored, 10);
    }
  } catch (e) {
    console.error('[RemoteUDL] Failed to load nextId from localStorage:', e);
  }
  return 4;
}

function loadPersistedWebhookLog(): string[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_WEBHOOK_LOG);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.error(
      '[RemoteUDL] Failed to load webhook log from localStorage:',
      e
    );
  }
  return [];
}

/**
 * Generate node ID matching the plugin's createNodeId pattern.
 */
function createNodeId(type: string, id: string): string {
  return `${type}-${id}`;
}

export default function RemoteUDLWebhooks() {
  // "Remote" store - persisted to localStorage (simulates backend)
  const [remoteTodos, setRemoteTodos] = useState<Todo[]>(loadPersistedTodos);
  const remoteTodosRef = useRef(remoteTodos);
  remoteTodosRef.current = remoteTodos; // Keep ref in sync
  const nextIdRef = useRef(loadPersistedNextId());

  // UDL data (fetched via GraphQL)
  const [udlTodos, setUdlTodos] = useState<RemoteTodo[]>([]);

  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [newTodoTitle, setNewTodoTitle] = useState('');
  const [lastAction, setLastAction] = useState<string>('');
  const [webhookLog, setWebhookLog] = useState<string[]>(
    loadPersistedWebhookLog
  );

  // Persist remoteTodos to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_TODOS, JSON.stringify(remoteTodos));
    localStorage.setItem(STORAGE_KEY_NEXT_ID, String(nextIdRef.current));
  }, [remoteTodos]);

  // Persist webhookLog to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_WEBHOOK_LOG, JSON.stringify(webhookLog));
  }, [webhookLog]);

  // Add to webhook log
  const logWebhook = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setWebhookLog((prev) => [`[${timestamp}] ${message}`, ...prev.slice(0, 9)]);
  };

  /**
   * Send a webhook to UDL to notify about data changes.
   */
  const sendWebhook = async (
    operation: 'create' | 'update' | 'delete' | 'upsert',
    nodeId: string,
    nodeType: string,
    data?: Record<string, unknown>
  ): Promise<boolean> => {
    try {
      const response = await fetch(UDL_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operation,
          nodeId,
          nodeType,
          data,
        }),
      });

      if (!response.ok) {
        console.error(
          `Webhook failed: ${response.status} ${response.statusText}`
        );
        logWebhook(`FAILED: ${operation} ${nodeId} - ${response.status}`);
        return false;
      }

      logWebhook(`${operation.toUpperCase()} ${nodeId} -> OK`);
      return true;
    } catch (err) {
      console.error('Failed to send webhook:', err);
      logWebhook(`FAILED: ${operation} ${nodeId} - ${err}`);
      return false;
    }
  };

  // Fetch todos from UDL via GraphQL
  const fetchFromUDL = async () => {
    setLoading(true);
    setError('');

    try {
      const [err, data] = await udl.query<RemoteTodo[]>(gql`
        {
          allRemoteTodos {
            todoId
            title
            completed
            internal {
              id
              type
              owner
              contentDigest
            }
          }
        }
      `);

      if (err) throw new Error(err.message);
      setUdlTodos(data || []);
      setLastAction(`Refreshed from UDL - found ${data?.length || 0} todos`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch from UDL');
    } finally {
      setLoading(false);
    }
  };

  // Initial load
  useEffect(() => {
    fetchFromUDL();
  }, []);

  // Create new todo
  const createTodo = async () => {
    if (!newTodoTitle.trim()) return;

    setError('');

    const newTodo: Todo = {
      id: nextIdRef.current++,
      title: newTodoTitle,
      completed: false,
    };

    // Update "remote" store immediately
    setRemoteTodos((prev) => [...prev, newTodo]);
    setNewTodoTitle('');

    // Send webhook to UDL
    const nodeId = createNodeId('RemoteTodo', String(newTodo.id));
    const success = await sendWebhook('create', nodeId, 'RemoteTodo', {
      todoId: newTodo.id,
      title: newTodo.title,
      completed: newTodo.completed,
    });

    if (success) {
      setLastAction(`Created todo #${newTodo.id}: "${newTodo.title}"`);
    } else {
      setError('Failed to send webhook to UDL');
    }
  };

  // Toggle todo completed
  const toggleTodo = async (todoId: number) => {
    setError('');

    // Find todo from current state using ref (avoids stale closure)
    const currentTodo = remoteTodosRef.current.find((t) => t.id === todoId);
    if (!currentTodo) {
      setError('Todo not found');
      return;
    }

    const newCompleted = !currentTodo.completed;

    // Update local state
    setRemoteTodos((prev) =>
      prev.map((t) => (t.id === todoId ? { ...t, completed: newCompleted } : t))
    );

    // Send webhook to UDL
    const nodeId = createNodeId('RemoteTodo', String(todoId));
    const success = await sendWebhook('upsert', nodeId, 'RemoteTodo', {
      todoId: todoId,
      title: currentTodo.title,
      completed: newCompleted,
    });

    if (success) {
      setLastAction(
        `Toggled todo #${todoId} to ${newCompleted ? 'completed' : 'incomplete'}`
      );
    } else {
      setError('Failed to send webhook to UDL');
    }
  };

  // Delete todo
  const deleteTodo = async (todoId: number) => {
    setError('');

    // Update "remote" store immediately
    setRemoteTodos((prev) => prev.filter((t) => t.id !== todoId));

    // Send webhook to UDL
    const nodeId = createNodeId('RemoteTodo', String(todoId));
    const success = await sendWebhook('delete', nodeId, 'RemoteTodo');

    if (success) {
      setLastAction(`Deleted todo #${todoId}`);
    } else {
      setError('Failed to send webhook to UDL');
    }
  };

  // Reset to initial state and sync UDL via webhooks
  const resetData = async () => {
    setError('');

    // Get current remote state before reset
    const currentTodos = remoteTodosRef.current;
    const currentIds = new Set(currentTodos.map((t) => t.id));
    const initialIds = new Set(initialTodos.map((t) => t.id));

    // Calculate what webhooks need to be sent to reconcile UDL with initial state
    const webhooksToSend: Array<{
      operation: 'create' | 'delete' | 'upsert';
      nodeId: string;
      nodeType: string;
      data?: Record<string, unknown>;
    }> = [];

    // 1. Items in initial but not in current → need to CREATE in UDL
    for (const todo of initialTodos) {
      if (!currentIds.has(todo.id)) {
        webhooksToSend.push({
          operation: 'create',
          nodeId: createNodeId('RemoteTodo', String(todo.id)),
          nodeType: 'RemoteTodo',
          data: {
            todoId: todo.id,
            title: todo.title,
            completed: todo.completed,
          },
        });
      }
    }

    // 2. Items in current but not in initial → need to DELETE from UDL
    for (const todo of currentTodos) {
      if (!initialIds.has(todo.id)) {
        webhooksToSend.push({
          operation: 'delete',
          nodeId: createNodeId('RemoteTodo', String(todo.id)),
          nodeType: 'RemoteTodo',
        });
      }
    }

    // 3. Items in both but with different values → need to UPDATE in UDL
    for (const initialTodo of initialTodos) {
      const currentTodo = currentTodos.find((t) => t.id === initialTodo.id);
      if (currentTodo) {
        // Check if values differ
        if (
          currentTodo.title !== initialTodo.title ||
          currentTodo.completed !== initialTodo.completed
        ) {
          webhooksToSend.push({
            operation: 'upsert',
            nodeId: createNodeId('RemoteTodo', String(initialTodo.id)),
            nodeType: 'RemoteTodo',
            data: {
              todoId: initialTodo.id,
              title: initialTodo.title,
              completed: initialTodo.completed,
            },
          });
        }
      }
    }

    // Reset remote store to initial state
    setRemoteTodos([...initialTodos]);
    nextIdRef.current = 4;

    // Send all reconciliation webhooks and collect log entries
    if (webhooksToSend.length === 0) {
      setWebhookLog([]);
      setLastAction(
        'Reset complete - no webhooks needed (state already matches initial)'
      );
    } else {
      const newLogEntries: string[] = [];
      let successCount = 0;

      for (const webhook of webhooksToSend) {
        try {
          const response = await fetch(UDL_WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              operation: webhook.operation,
              nodeId: webhook.nodeId,
              nodeType: webhook.nodeType,
              data: webhook.data,
            }),
          });

          const timestamp = new Date().toLocaleTimeString();
          if (response.ok) {
            successCount++;
            newLogEntries.push(
              `[${timestamp}] ${webhook.operation.toUpperCase()} ${webhook.nodeId} -> OK`
            );
          } else {
            newLogEntries.push(
              `[${timestamp}] FAILED: ${webhook.operation} ${webhook.nodeId} - ${response.status}`
            );
          }
        } catch (err) {
          const timestamp = new Date().toLocaleTimeString();
          newLogEntries.push(
            `[${timestamp}] FAILED: ${webhook.operation} ${webhook.nodeId} - ${err}`
          );
        }
      }

      // Set all log entries at once (replacing old log)
      setWebhookLog(newLogEntries);
      setLastAction(
        `Reset complete - sent ${successCount}/${webhooksToSend.length} reconciliation webhooks to UDL`
      );
    }
  };

  return (
    <div className="max-w-5xl">
      <div className="space-y-6">
        {/* Architecture Info */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="font-semibold text-blue-900 mb-2">
            Architecture: Remote UDL with Webhooks
          </h4>
          <div className="text-sm text-blue-700 space-y-2">
            <p>
              <strong>Flow:</strong>
            </p>
            <ol className="list-decimal list-inside ml-4 space-y-1">
              <li>
                CRUD action updates the &quot;remote&quot; in-memory store
                (simulates backend)
              </li>
              <li>
                Webhook is sent to UDL:{' '}
                <code className="bg-blue-100 px-1 rounded">
                  POST /_webhooks/remote-todo-source/sync
                </code>
              </li>
              <li>UDL default handler updates node store</li>
              <li>
                Click <strong>&quot;Refresh from UDL&quot;</strong> to see
                updated data
              </li>
            </ol>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <div className="flex flex-wrap gap-4 items-end">
            <button
              onClick={fetchFromUDL}
              disabled={loading}
              className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 font-medium"
            >
              {loading ? 'Loading...' : 'Refresh from UDL'}
            </button>

            <button
              onClick={resetData}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
            >
              Reset Remote Store
            </button>

            <span className="text-sm text-gray-500">
              UDL Server: <code>http://localhost:4000</code>
            </span>

            <span
              className={`text-sm px-2 py-1 rounded ${loading ? 'bg-yellow-200 text-yellow-800' : 'bg-green-200 text-green-800'}`}
            >
              {loading ? 'Loading...' : 'Ready'}
            </span>
          </div>
        </div>

        {/* Create Todo Form */}
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h4 className="font-semibold text-gray-900 mb-3">Create New Todo</h4>
          <div className="flex gap-2">
            <input
              type="text"
              value={newTodoTitle}
              onChange={(e) => setNewTodoTitle(e.target.value)}
              placeholder="Enter todo title..."
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              onKeyDown={(e) => e.key === 'Enter' && createTodo()}
            />
            <button
              onClick={createTodo}
              disabled={!newTodoTitle.trim()}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
            >
              Add Todo
            </button>
          </div>
        </div>

        {/* Status Messages */}
        <div className="grid md:grid-cols-2 gap-4">
          {/* Last Action - always visible */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
            <p className="text-sm text-yellow-800">
              <strong>Last Action:</strong> {lastAction || 'None yet'}
            </p>
            <p className="text-xs text-yellow-600 mt-1">
              Actions update this message to confirm they executed
            </p>
          </div>

          {/* Webhook Log */}
          {webhookLog.length > 0 && (
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
              <p className="text-sm font-semibold text-purple-900 mb-1">
                Webhook Log:
              </p>
              <div className="text-xs text-purple-700 font-mono space-y-0.5 max-h-24 overflow-y-auto">
                {webhookLog.map((log, i) => (
                  <div key={i}>{log}</div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-700">{error}</p>
            <p className="text-sm text-red-600 mt-1">
              Make sure the UDL server is running on port 4000
            </p>
          </div>
        )}

        {/* Side-by-side comparison */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Remote Store */}
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
            <h4 className="text-lg font-semibold text-orange-900 mb-4">
              &quot;Remote&quot; Store ({remoteTodos.length} todos)
            </h4>
            <p className="text-xs text-orange-700 mb-3">
              In-memory store simulating a backend. Changes here trigger
              webhooks to UDL.
            </p>
            <div className="space-y-2">
              {remoteTodos.map((todo) => (
                <div
                  key={todo.id}
                  className={`border rounded p-3 ${
                    todo.completed
                      ? 'bg-green-50 border-green-200'
                      : 'bg-white border-gray-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={todo.completed}
                        onChange={() => toggleTodo(todo.id)}
                        className="w-4 h-4 cursor-pointer accent-green-600"
                      />
                      <span
                        className={
                          todo.completed ? 'line-through text-gray-500' : ''
                        }
                      >
                        {todo.title}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500">#{todo.id}</span>
                      <button
                        onClick={() => deleteTodo(todo.id)}
                        className="px-2 py-1 text-red-600 hover:bg-red-100 rounded text-xs"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* UDL Store */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="text-lg font-semibold text-blue-900 mb-4">
              UDL Store ({udlTodos.length} todos)
            </h4>
            <p className="text-xs text-blue-700 mb-3">
              Data from UDL via GraphQL. Click &quot;Refresh from UDL&quot; to
              update.
            </p>
            {udlTodos.length === 0 ? (
              <p className="text-gray-500 text-sm">
                No todos found. Click &quot;Refresh from UDL&quot;.
              </p>
            ) : (
              <div className="space-y-2">
                {udlTodos.map((todo) => (
                  <div
                    key={todo.internal.id}
                    className={`border rounded p-3 ${
                      todo.completed
                        ? 'bg-green-50 border-green-200'
                        : 'bg-white border-gray-200'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={todo.completed}
                          disabled
                          className="w-4 h-4"
                        />
                        <span
                          className={
                            todo.completed ? 'line-through text-gray-500' : ''
                          }
                        >
                          {todo.title}
                        </span>
                      </div>
                      <span className="text-xs text-gray-500">
                        #{todo.todoId}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 mt-1 font-mono">
                      {todo.internal.id}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Technical Details */}
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
          <h4 className="font-semibold text-purple-900 mb-2">
            Webhook Payload Format
          </h4>
          <div className="text-sm text-purple-700">
            <pre className="bg-white rounded p-3 text-xs overflow-x-auto border border-purple-200">
              {`POST /_webhooks/remote-todo-source/sync
Content-Type: application/json

{
  "operation": "create" | "update" | "delete" | "upsert",
  "nodeId": "RemoteTodo-1",
  "nodeType": "RemoteTodo",
  "data": {
    "todoId": 1,
    "title": "Example todo",
    "completed": false
  }
}`}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}
