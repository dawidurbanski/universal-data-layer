export const config = {
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

export function onLoad({ options, config }) {
  console.log('Next.js app loaded', options, config);
}
