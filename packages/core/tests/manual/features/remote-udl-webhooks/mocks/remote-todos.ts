/**
 * MSW Handlers for Remote Todo API
 *
 * These handlers simulate a remote REST API that:
 * 1. Stores todos in-memory
 * 2. Sends webhooks to UDL after each mutation
 *
 * The webhooks allow UDL to stay in sync with the "remote" data source.
 */

import { http, HttpResponse } from 'msw';

// Simple todo model
interface Todo {
  id: number;
  title: string;
  completed: boolean;
}

// Initial seed data - matches what sourceNodes will fetch
const initialTodos: Todo[] = [
  { id: 1, title: 'Learn UDL', completed: false },
  { id: 2, title: 'Build awesome apps', completed: false },
  { id: 3, title: 'Test webhooks', completed: true },
];

// Mutable in-memory store
let todos: Todo[] = [...initialTodos];
let nextId = 4;

// UDL server webhook endpoint
// MSW's onUnhandledRequest: 'bypass' allows this to reach the actual server
const UDL_WEBHOOK_URL =
  'http://localhost:4000/_webhooks/remote-todo-source/sync';

/**
 * Send a webhook to UDL to notify about data changes.
 * Uses the default webhook payload format.
 */
async function sendWebhook(
  operation: 'create' | 'update' | 'delete' | 'upsert',
  nodeId: string,
  nodeType: string,
  data?: Record<string, unknown>
): Promise<void> {
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
        `[MSW] Webhook failed: ${response.status} ${response.statusText}`
      );
    } else {
      console.log(`[MSW] Webhook sent: ${operation} ${nodeType} ${nodeId}`);
    }
  } catch (error) {
    console.error('[MSW] Failed to send webhook:', error);
  }
}

/**
 * Generate node ID matching the plugin's createNodeId pattern.
 * Format: {Type}-{id}
 */
function createNodeId(type: string, id: string): string {
  return `${type}-${id}`;
}

/**
 * MSW request handlers for the remote todo API.
 */
export const remoteTodoHandlers = [
  // GET /api/todos - List all todos
  http.get('http://localhost:3001/api/todos', () => {
    console.log('[MSW] GET /api/todos - returning', todos.length, 'todos');
    return HttpResponse.json(todos);
  }),

  // GET /api/todos/:id - Get single todo
  http.get('http://localhost:3001/api/todos/:id', ({ params }) => {
    const id = Number(params['id']);
    const todo = todos.find((t) => t.id === id);

    if (!todo) {
      return new HttpResponse(null, { status: 404 });
    }

    return HttpResponse.json(todo);
  }),

  // POST /api/todos - Create new todo
  http.post('http://localhost:3001/api/todos', async ({ request }) => {
    const body = (await request.json()) as {
      title: string;
      completed?: boolean;
    };

    const newTodo: Todo = {
      id: nextId++,
      title: body.title,
      completed: body.completed ?? false,
    };

    todos.push(newTodo);
    console.log('[MSW] POST /api/todos - created todo:', newTodo);

    // Send webhook to UDL
    const nodeId = createNodeId('RemoteTodo', String(newTodo.id));
    await sendWebhook('create', nodeId, 'RemoteTodo', {
      todoId: newTodo.id,
      title: newTodo.title,
      completed: newTodo.completed,
    });

    return HttpResponse.json(newTodo, { status: 201 });
  }),

  // PUT /api/todos/:id - Full update
  http.put(
    'http://localhost:3001/api/todos/:id',
    async ({ params, request }) => {
      const id = Number(params['id']);
      const body = (await request.json()) as {
        title?: string;
        completed?: boolean;
      };

      const index = todos.findIndex((t) => t.id === id);
      if (index === -1) {
        return new HttpResponse(null, { status: 404 });
      }

      const existing = todos[index]!;
      const updatedTodo: Todo = {
        id,
        title: body.title ?? existing.title,
        completed: body.completed ?? existing.completed,
      };
      todos[index] = updatedTodo;
      console.log('[MSW] PUT /api/todos/:id - updated todo:', updatedTodo);

      // Send webhook to UDL
      const nodeId = createNodeId('RemoteTodo', String(updatedTodo.id));
      await sendWebhook('update', nodeId, 'RemoteTodo', {
        todoId: updatedTodo.id,
        title: updatedTodo.title,
        completed: updatedTodo.completed,
      });

      return HttpResponse.json(updatedTodo);
    }
  ),

  // PATCH /api/todos/:id - Partial update (e.g., toggle completed)
  http.patch(
    'http://localhost:3001/api/todos/:id',
    async ({ params, request }) => {
      const id = Number(params['id']);
      const body = (await request.json()) as {
        title?: string;
        completed?: boolean;
      };

      const index = todos.findIndex((t) => t.id === id);
      if (index === -1) {
        return new HttpResponse(null, { status: 404 });
      }

      const existing = todos[index]!;
      const updatedTodo: Todo = {
        id,
        title: body.title ?? existing.title,
        completed: body.completed ?? existing.completed,
      };
      todos[index] = updatedTodo;
      console.log('[MSW] PATCH /api/todos/:id - updated todo:', updatedTodo);

      // Send webhook to UDL (upsert for partial updates)
      const nodeId = createNodeId('RemoteTodo', String(updatedTodo.id));
      await sendWebhook('upsert', nodeId, 'RemoteTodo', {
        todoId: updatedTodo.id,
        title: updatedTodo.title,
        completed: updatedTodo.completed,
      });

      return HttpResponse.json(updatedTodo);
    }
  ),

  // DELETE /api/todos/:id - Delete todo
  http.delete('http://localhost:3001/api/todos/:id', async ({ params }) => {
    const id = Number(params['id']);

    const index = todos.findIndex((t) => t.id === id);
    if (index === -1) {
      return new HttpResponse(null, { status: 404 });
    }

    todos.splice(index, 1);
    console.log('[MSW] DELETE /api/todos/:id - deleted todo:', id);

    // Send webhook to UDL
    const nodeId = createNodeId('RemoteTodo', String(id));
    await sendWebhook('delete', nodeId, 'RemoteTodo');

    return new HttpResponse(null, { status: 204 });
  }),

  // POST /api/todos/reset - Reset to initial state (for testing)
  http.post('http://localhost:3001/api/todos/reset', () => {
    todos = [...initialTodos];
    nextId = 4;
    console.log('[MSW] POST /api/todos/reset - reset to initial state');
    return HttpResponse.json({ reset: true, count: todos.length });
  }),
];

// Export for registration with MSW
export { remoteTodoHandlers as handlers };
