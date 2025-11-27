import type { UDLConfig } from '@core/loader.js';

/**
 * UDL Configuration for JSONPlaceholder Todos Demo
 *
 * This config demonstrates:
 * 1. Fetching data from an external REST API
 * 2. Sourcing the data as nodes
 * 3. Using generated types, guards, and helpers
 */

export const config: UDLConfig = {
  plugins: [
    // Todo source plugin - fetches from JSONPlaceholder API
    {
      name: './plugins/todo-source',
      options: {
        indexes: ['userId'], // Enable userId indexing for efficient lookups
      },
    },
  ],
  // Automatically generate types, guards, and helpers after sourceNodes
  codegen: {
    output: './generated',
    guards: true,
    helpers: true,
    includeInternal: true, // Disable Node extension since universal-data-layer module path can't be resolved here
    types: ['Todo'], // Only generate code for Todo nodes from this feature's plugin
  },
};
