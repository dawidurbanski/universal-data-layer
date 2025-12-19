import { defineConfig } from 'universal-data-layer';

/**
 * UDL Configuration for Node API Demo
 *
 * This config demonstrates how to set up plugins for the Node API.
 * The three plugins showcase:
 * 1. Sourcing data (creating nodes)
 * 2. Extending nodes (adding computed fields)
 * 3. Filtering data (removing nodes)
 */

export const config = defineConfig({
  plugins: [
    // Plugin 1: Basic data source - creates Product nodes from static data
    {
      name: './plugins/plugin1-data-source',
      options: {
        indexes: ['slug'], // Enable slug field indexing for O(1) lookups
      },
    },

    // Plugin 2: Node extension - enriches Product nodes with computed fields
    './plugins/plugin2-node-extension',

    // Plugin 3: Node filter - removes discontinued products
    './plugins/plugin3-node-filter',
  ],
});
