import type { UDLConfig } from '@core/loader.js';

export const config: UDLConfig = {
  plugins: [
    {
      name: '@udl/plugin-source-contentful',
      options: {
        spaceId: process.env['CONTENTFUL_SPACE_ID'] || '',
        accessToken: process.env['CONTENTFUL_ACCESS_TOKEN'] || '',
        indexes: ['slug'],
      },
    },
  ],
};
