import { defineConfig } from 'universal-data-layer';

/**
 * UDL Configuration for JSONPlaceholder Todos Demo
 *
 * This config demonstrates:
 * 1. Fetching data from an external REST API
 * 2. Sourcing the data as nodes
 * 3. Using generated types, guards, and helpers
 */

export const config = defineConfig({
  plugins: [
    // Todo source plugin - fetches from JSONPlaceholder API
    {
      name: './plugins/todo-source',
      options: {
        indexes: ['userId'], // Enable userId indexing for efficient lookups
      },
    },
  ],
  // Codegen is now configured in the plugin's udl.config.ts
  // Types will be generated at: plugins/todo-source/generated/
});
