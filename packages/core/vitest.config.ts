import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: [
        // Default exclusions
        'node_modules/**',
        'dist/**',
        'coverage/**',
        '**/*.test.ts',
        '**/*.spec.ts',
        // Custom exclusions
        'src/utils/import-meta-resolve.ts',
        'src/schema.ts',
        'src/server.ts',
        'src/start-server.ts',
        'src/handlers/**',
        // Barrel export files - no logic to test
        '**/index.ts',
        // Watch mode is excluded - contains untestable patterns
        // (infinite promises, signal handlers, file watchers)
        'src/codegen/watch.ts',
        // Mock files used for testing
        '**/mocks/**',
      ],
      thresholds: {
        branches: 100,
        functions: 100,
        lines: 100,
        statements: 100,
        '100': true,
      },
    },
  },
});
