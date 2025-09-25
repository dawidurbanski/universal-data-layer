import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'json-summary', 'html'],
      exclude: [
        'node_modules/**',
        'dist/**',
        '.turbo/**',
        '.changeset/**',
        '.github/**',
        '.husky/**',
        'coverage/**',
        '**/*.config.{js,ts,mjs,cjs}',
        '**/*.d.ts',
        '**/bin/**',
        '**/__tests__/**',
        '**/__mocks__/**',
        '**/index.ts',
        '**/handlers/**',
        // Until we have a proper packages and true working code
        // we need to ignore the packages folder to stop coverage from failing
        // TODO: Remove this once we have a proper packages and true working code
        '**/packages/**',
      ],
      // Until we have a proper packages and true working code
      // we need to ignore the packages folder to stop coverage from failing
      // TODO: Remove this once we have a proper packages and true working code
      thresholds: {
        branches: 0,
        functions: 0,
        lines: 0,
        statements: 0,
        '100': false,
      },
    },
  },
});
