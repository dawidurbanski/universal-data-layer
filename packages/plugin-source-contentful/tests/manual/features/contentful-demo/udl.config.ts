import { defineConfig } from 'universal-data-layer';

export const config = defineConfig({
  plugins: [
    {
      name: '@universal-data-layer/plugin-source-contentful',
      options: {
        spaceId: process.env['CONTENTFUL_SPACE_ID'] || '',
        accessToken: process.env['CONTENTFUL_ACCESS_TOKEN'] || '',
        indexes: ['slug'],
      },
    },
  ],
});
