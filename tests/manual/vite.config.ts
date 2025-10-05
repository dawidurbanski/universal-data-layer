import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { scenariosPlugin } from './vite/vite-plugin-scenarios.js';

export default defineConfig({
  plugins: [react(), scenariosPlugin()],
  root: __dirname,
  define: {
    // Pass the repo root path to the client
    __REPO_ROOT__: JSON.stringify(resolve(__dirname, '../..')),
    // Pass filter flags to client
    __PACKAGE_FILTER__: JSON.stringify(
      process.env['VITE_PACKAGE_FILTER'] || ''
    ),
    __FEATURE_FILTER__: JSON.stringify(
      process.env['VITE_FEATURE_FILTER'] || ''
    ),
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
      },
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      'universal-data-layer': resolve(__dirname, '../../packages/core/src'),
      '/packages': resolve(__dirname, '../../packages'),
    },
  },
  server: {
    port: 3333,
    open: true,
    fs: {
      // Allow serving files from parent directories
      allow: ['..', '../..'],
    },
  },
});
