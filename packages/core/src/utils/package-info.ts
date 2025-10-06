import { pluginTypes, type PluginType } from '@/loader.js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

export function loadPackageJson(callerUrl?: string): Record<string, unknown> {
  const __filename = fileURLToPath(callerUrl || import.meta.url);
  const __dirname = dirname(__filename);
  const packageJsonPath = join(__dirname, 'package.json');
  const packageJsonContent = readFileSync(packageJsonPath, 'utf-8');

  return JSON.parse(packageJsonContent);
}

export function getPackageVersion(callerUrl?: string): string {
  const packageJson = loadPackageJson(callerUrl);
  return packageJson['version'] as string;
}

export function getPackageName(callerUrl?: string): string {
  const packageJson = loadPackageJson(callerUrl);
  const fullName = packageJson['name'] as string;

  if (fullName.startsWith('@universal-data-layer/')) {
    const namePart = fullName.split('/')[1];

    if (!namePart) {
      return fullName;
    }

    const typePrefix = getPackageType(callerUrl) + '-';

    if (namePart.startsWith(typePrefix)) {
      return namePart.substring(typePrefix.length);
    }

    return namePart;
  }

  return fullName;
}

export function getPackageType(callerUrl?: string): PluginType {
  const packageJson = loadPackageJson(callerUrl);
  const fullName = packageJson['name'] as string;

  if (fullName.startsWith('@universal-data-layer/')) {
    const namePart = fullName.split('/')[1];

    if (!namePart) {
      return 'other';
    }

    const typeMatch = namePart.match(/^([^-]+)-/);

    if (typeMatch && typeMatch[1]) {
      const extractedType = typeMatch[1];

      if (pluginTypes.includes(extractedType as PluginType)) {
        return extractedType as PluginType;
      }
    }

    return 'other';
  }

  return 'core';
}
