import { defineConfig } from 'universal-data-layer';

export const { config } = defineConfig({
  config: {
    plugins: [
      {
        name: '@udl/plugin-source-contentful',
        options: {
          spaceId: process.env['CONTENTFUL_SPACE_ID'] || '',
          accessToken: process.env['CONTENTFUL_ACCESS_TOKEN'] || '',
          environment: process.env['CONTENTFUL_ENVIRONMENT'] || 'master',
        },
      },
    ],
  },
});
