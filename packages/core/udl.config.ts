import type { UDLConfig } from './src/loader.js';

export const config: UDLConfig = {
  type: 'core',
  name: 'universal-data-layer',
  version: '0.0.1',
};

export function onLoad() {
  console.log('🟢 Core loaded');
}
