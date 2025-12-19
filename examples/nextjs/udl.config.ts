import { defineConfig } from 'universal-data-layer';

export const config = defineConfig({
  plugins: [
    {
      name: '@universal-data-layer/plugin-source-contentful',
      options: {
        // These can be any values - MSW intercepts all Contentful API calls
        spaceId: process.env['CONTENTFUL_SPACE_ID'] || 'mock-space',
        accessToken: process.env['CONTENTFUL_ACCESS_TOKEN'] || 'mock-token',
        environment: process.env['CONTENTFUL_ENVIRONMENT'] || 'master',
        // Register slug as an index for O(1) lookups via contentfulProduct(slug: "...")
        indexes: ['slug'],
      },
    },
  ],
  // Enable codegen with TypedDocumentNode query generation extension
  codegen: {
    output: './generated',
    extensions: ['@universal-data-layer/codegen-typed-queries'],
  },
});
