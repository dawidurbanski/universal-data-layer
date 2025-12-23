import { defineConfig } from 'universal-data-layer';

/**
 * UDL Configuration for Remote UDL Webhooks Demo
 *
 * This config demonstrates:
 * 1. Fetching initial data from an MSW-mocked REST API
 * 2. Using webhooks to sync CRUD operations to UDL
 * 3. Testing the remote UDL pattern without a real remote server
 */

export const config = defineConfig({
  plugins: [
    // Remote todo source plugin - fetches from MSW-mocked API
    {
      name: './plugins/remote-todo-source',
      options: {},
    },
  ],
  // Default webhook handler is now automatically registered for all plugins
  // Endpoint: /_webhooks/remote-todo-source/sync
});
