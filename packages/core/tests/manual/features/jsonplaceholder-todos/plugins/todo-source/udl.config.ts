/**
 * Plugin: JSONPlaceholder Todo Source
 *
 * This plugin fetches todo items from the JSONPlaceholder API
 * and creates nodes in the UDL store.
 */

import { defineConfig, type SourceNodesContext } from 'universal-data-layer';

// API response type
interface TodoApiResponse {
  userId: number;
  id: number;
  title: string;
  completed: boolean;
}

export const config = defineConfig({
  type: 'source',
  name: 'jsonplaceholder-todo-source',
  indexes: ['userId'], // Enable userId indexing for efficient lookups
  // Codegen config - outputs relative to this plugin folder
  codegen: {
    output: './generated',
    guards: true,
    includeInternal: true,
    // types not specified = auto-filter by owner (this plugin's nodes only)
  },
});

export async function sourceNodes({
  actions,
  createNodeId,
  createContentDigest,
}: SourceNodesContext) {
  // Fetch todos from the API (limit to first 20 for demo)
  const response = await fetch('https://jsonplaceholder.typicode.com/todos');

  if (!response.ok) {
    throw new Error(`Failed to fetch todos: ${response.statusText}`);
  }

  const todos: TodoApiResponse[] = await response.json();

  // Limit to first 20 todos for the demo
  // const limitedTodos = todos.slice(0, 20);
  const limitedTodos = todos;

  for (const todo of limitedTodos) {
    const nodeId = createNodeId('Todo', String(todo.id));

    await actions.createNode({
      internal: {
        id: nodeId,
        type: 'Todo',
        owner: 'jsonplaceholder-todo-source',
        contentDigest: createContentDigest(todo),
      },
      // Map API fields to node fields
      externalId: todo.id,
      userId: todo.userId,
      title: todo.title,
      completed: todo.completed,
    });
  }
}
