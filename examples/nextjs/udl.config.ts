import type { UDLConfig, OnLoadContext } from 'universal-data-layer';

export const config: UDLConfig = {
  plugins: [
    'universal-data-layer',
    {
      name: '@universal-data-layer/contentful',
      options: {
        spaceId: process.env.CONTENTFUL_SPACE_ID || 'your_space_id',
        accessToken: process.env.CONTENTFUL_ACCESS_TOKEN || 'your_access_token',
      },
    },
  ],
};

export function onLoad(context: OnLoadContext) {
  const { options, config } = context;
  console.log('Next.js app loaded', options, config);
}
