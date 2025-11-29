import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { config as dotenvConfig } from 'dotenv';

/**
 * Options for loading environment variables
 */
export interface LoadEnvOptions {
  /**
   * Directory to search for .env files
   * @default process.cwd()
   */
  cwd?: string;

  /**
   * Whether to override existing environment variables
   * @default false
   */
  override?: boolean;
}

/**
 * Result of loading environment variables
 */
export interface LoadEnvResult {
  /** Whether any .env file was loaded */
  loaded: boolean;
  /** Path to the .env file that was loaded (if any) */
  path?: string;
}

/**
 * Automatically loads environment variables from .env files.
 *
 * Searches for .env files in the following order (first found is used):
 * 1. .env.local (for local overrides, should be gitignored)
 * 2. .env.{NODE_ENV}.local (e.g., .env.development.local)
 * 3. .env.{NODE_ENV} (e.g., .env.development)
 * 4. .env
 *
 * This function is automatically called by the UDL server before loading configs,
 * so you typically don't need to call it manually.
 *
 * @example
 * ```ts
 * // Manual usage (not typically needed)
 * import { loadEnv } from 'universal-data-layer';
 *
 * loadEnv({ cwd: '/path/to/project' });
 * ```
 */
export function loadEnv(options: LoadEnvOptions = {}): LoadEnvResult {
  const { cwd = process.cwd(), override = false } = options;
  const nodeEnv = process.env['NODE_ENV'] || 'development';

  // Priority order for .env files (first found wins)
  const envFiles = [
    `.env.${nodeEnv}.local`, // e.g., .env.development.local
    `.env.local`, // Local overrides
    `.env.${nodeEnv}`, // e.g., .env.development
    '.env', // Default
  ];

  for (const envFile of envFiles) {
    const envPath = join(cwd, envFile);

    if (existsSync(envPath)) {
      const result = dotenvConfig({ path: envPath, override });

      if (!result.error) {
        console.log(`📄 Loaded environment from ${envFile}`);
        return { loaded: true, path: envPath };
      }
    }
  }

  return { loaded: false };
}
