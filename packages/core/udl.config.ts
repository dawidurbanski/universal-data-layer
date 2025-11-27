import type { UDLConfig } from './src/loader.js';
import {
  getPackageVersion,
  getPackageName,
  getPackageType,
} from './src/utils/package-info.js';

export const config: UDLConfig = {
  type: getPackageType(import.meta.url),
  name: getPackageName(import.meta.url),
  version: getPackageVersion(import.meta.url),
};

export function onLoad() {
  console.log('🟢 Package "core" loaded');
}
