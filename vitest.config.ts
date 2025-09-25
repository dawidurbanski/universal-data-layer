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
      ],
      thresholds: {
        branches: 90,
        functions: 90,
        lines: 90,
        statements: 90,
      },
    },
  },
});
