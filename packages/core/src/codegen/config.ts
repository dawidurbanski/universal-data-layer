/**
 * Codegen Configuration
 *
 * Runtime configuration utilities for the code generation system.
 */

import type {
  CodegenConfig,
  ResolvedCodegenConfig,
  CodegenExtensionSpec,
} from './types/index.js';

/**
 * Default configuration values
 */
export const DEFAULT_CODEGEN_CONFIG: Required<
  Omit<CodegenConfig, 'extensions'>
> & {
  extensions: CodegenExtensionSpec[];
} = {
  output: './generated',
  guards: false,
  helpers: false,
  customScalars: {},
  includeInternal: true,
  includeJsDoc: true,
  exportFormat: 'interface',
  extensions: [],
};

/**
 * Merge user config with defaults
 */
export function resolveCodegenConfig(
  config?: CodegenConfig
): ResolvedCodegenConfig {
  return {
    ...DEFAULT_CODEGEN_CONFIG,
    ...config,
    customScalars: {
      ...DEFAULT_CODEGEN_CONFIG.customScalars,
      ...config?.customScalars,
    },
    extensions: config?.extensions ?? [],
  };
}
