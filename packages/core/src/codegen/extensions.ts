/**
 * Codegen Extension Loader
 *
 * Runtime utilities for loading and managing codegen extensions.
 */

import type { CodegenExtension, CodegenExtensionSpec } from './types/index.js';

/**
 * Load extensions from specification array
 *
 * Handles both direct extension objects and package names (which are dynamically imported).
 *
 * @param specs - Array of extension specifications
 * @returns Resolved extension objects
 */
export async function loadExtensions(
  specs: CodegenExtensionSpec[]
): Promise<CodegenExtension[]> {
  const extensions: CodegenExtension[] = [];

  for (const spec of specs) {
    if (typeof spec === 'string') {
      try {
        // Dynamic import of extension package
        const mod = await import(spec);
        const extension = mod.default || mod.extension;

        if (!extension || typeof extension.generate !== 'function') {
          console.warn(
            `⚠️  Extension "${spec}" does not export a valid CodegenExtension`
          );
          continue;
        }

        extensions.push(extension);
      } catch (error) {
        console.warn(`⚠️  Failed to load extension "${spec}":`, error);
      }
    } else {
      extensions.push(spec);
    }
  }

  return extensions;
}
