import js from '@eslint/js';
import typescript from '@typescript-eslint/eslint-plugin';
import typescriptParser from '@typescript-eslint/parser';
import prettierConfig from 'eslint-config-prettier';
import globals from 'globals';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';

export default [
  js.configs.recommended,
  react.configs.flat.recommended,
  ...reactHooks.configs['flat/recommended'],
  prettierConfig,
  {
    files: ['**/*.js', '**/*.mjs', '**/*.cjs'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.node,
      },
    },
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: typescriptParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
      globals: {
        ...globals.node,
        ...globals.browser,
        NodeJS: 'readonly',
        __PACKAGE_FILTER__: 'readonly',
        __FEATURE_FILTER__: 'readonly',
        __REPO_ROOT__: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': typescript,
    },
    rules: {
      ...typescript.configs.recommended.rules,
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_' },
      ],
      'react/react-in-jsx-scope': 'off',
      // Disable base rule for TypeScript - use TS version that understands function overloads
      'no-redeclare': 'off',
      '@typescript-eslint/no-redeclare': 'error',
    },
  },
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      '**/.turbo/**',
      '**/coverage/**',
      '**/docs/**',
      '**/generated/**',
      '**/.udl-cache/**',
      '**/.next/**',
    ],
  },
  {
    settings: {
      react: {
        version: '19.2.0',
      },
    },
  },
];
