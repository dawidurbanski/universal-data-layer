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
        // Global exclusions (keep in sync with root vitest.config.ts)
        'node_modules/**',
        'dist/**',
        'coverage/**',
        '**/*.test.ts',
        '**/*.spec.ts',
        '**/*.config.{js,ts,mjs,cjs}',
        '**/*.d.ts',
        '**/index.ts',
        '**/handlers/**',
        '**/mocks/**',
        '**/generated/**',
        // Custom exclusions for core package
        'src/utils/import-meta-resolve.ts',
        'src/schema.ts',
        'src/server.ts',
        'src/start-server.ts',
        // Watch mode is excluded - contains untestable patterns
        // (infinite promises, signal handlers, file watchers)
        'src/codegen/watch.ts',
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
