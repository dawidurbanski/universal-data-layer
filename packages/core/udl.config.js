export const config = {
  type: 'core',
  name: 'universal-data-layer',
  version: '0.0.1',
};

export function onLoad({ options, config }) {
  console.log('Core loaded', options, config);
}
