import { defineConfig } from 'eslint/config';
import nextPlugin from '@next/eslint-plugin-next';

const eslintConfig = defineConfig([
  {
    plugins: {
      '@next/next': nextPlugin,
    },
    rules: {
      ...nextPlugin.configs.recommended.rules,
    },
  },
]);

export default eslintConfig;
