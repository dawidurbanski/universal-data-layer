/**
 * Plugin: Remote Todo Source
 *
 * This plugin fetches todo items from the MSW-mocked REST API
 * and creates nodes in the UDL store.
 *
 * The REST API is mocked by MSW handlers that also send webhooks
 * to UDL after each mutation, enabling real-time sync testing.
 */

import { defineConfig, type SourceNodesContext } from 'universal-data-layer';

// API response type (matches MSW mock structure)
interface TodoApiResponse {
  id: number;
  title: string;
  completed: boolean;
}

export const config = defineConfig({
  type: 'source',
  name: 'remote-todo-source',
  // Codegen config - outputs relative to this plugin folder
  codegen: {
    output: './generated',
    guards: true,
    includeInternal: true,
  },
});

/**
 * Generate a predictable node ID that can be replicated by the browser.
 * We don't use createNodeId from context because it generates a SHA-256 hash,
 * which the browser can't easily reproduce for webhook payloads.
 */
function makeNodeId(type: string, id: string): string {
  return `${type}-${id}`;
}

export async function sourceNodes({
  actions,
  createContentDigest,
}: SourceNodesContext) {
  // Fetch todos from the MSW-mocked REST API
  // This URL is intercepted by MSW handlers in mocks/remote-todos.ts
  const response = await fetch('http://localhost:3001/api/todos');

  if (!response.ok) {
    throw new Error(`Failed to fetch todos: ${response.statusText}`);
  }

  const todos: TodoApiResponse[] = await response.json();

  console.log(
    `[remote-todo-source] Loaded ${todos.length} todos from remote API`
  );

  for (const todo of todos) {
    // Use predictable ID format that browser can replicate for webhooks
    const nodeId = makeNodeId('RemoteTodo', String(todo.id));

    await actions.createNode({
      internal: {
        id: nodeId,
        type: 'RemoteTodo',
        owner: 'remote-todo-source',
        contentDigest: createContentDigest(todo),
      },
      // Map API fields to node fields
      todoId: todo.id,
      title: todo.title,
      completed: todo.completed,
    });
  }
}
