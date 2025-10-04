import type { UDLConfig, OnLoadContext } from './src/loader.js';

export const config: UDLConfig = {
  type: 'core',
  name: 'universal-data-layer',
  version: '0.0.1',
};

export function onLoad(context: OnLoadContext) {
  const { options, config } = context;
  console.log('Core loaded', options, config);
}
