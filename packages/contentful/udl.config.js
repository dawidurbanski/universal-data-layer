export const config = {
  type: 'source',
  name: 'contentful',
  version: '0.0.1',
};

export function onLoad({ options, config }) {
  console.log('Plugin Contentful loaded', options, config);
}
