import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

// ANSI color codes
export const COLORS = {
  CYAN: '\x1b[36m',
  MAGENTA: '\x1b[35m',
  GREEN: '\x1b[32m',
  RESET: '\x1b[0m',
} as const;

// Default ports
export const DEFAULT_NEXT_PORT = 3000;
export const DEFAULT_UDL_PORT = 4000;

// Environment variable name for UDL endpoint
export const UDL_ENDPOINT_ENV = 'UDL_ENDPOINT';

/**
 * Load the port from udl.config.ts if it exists.
 * Returns undefined if config not found or port not specified.
 */
export async function loadPortFromConfig(): Promise<number | undefined> {
  const configFiles = ['udl.config.ts', 'udl.config.js', 'udl.config.mjs'];

  for (const configFile of configFiles) {
    const configPath = join(process.cwd(), configFile);

    if (existsSync(configPath)) {
      try {
        // For TypeScript files, we need tsx to be available
        if (configFile.endsWith('.ts')) {
          const { register } = await import('tsx/esm/api');
          const unregister = register();
          try {
            const fileUrl = pathToFileURL(configPath).href;
            const module = await import(fileUrl);
            return module.config?.port;
          } finally {
            unregister();
          }
        } else {
          const fileUrl = pathToFileURL(configPath).href;
          const module = await import(fileUrl);
          return module.config?.port;
        }
      } catch {
        // Ignore errors, fall back to default
      }
    }
  }

  return undefined;
}

/**
 * Build the UDL GraphQL endpoint URL from port.
 */
export function buildUdlEndpoint(port: number): string {
  return `http://localhost:${port}/graphql`;
}

/**
 * Resolve the UDL port from CLI options and config file.
 * Priority: CLI option > config file > default
 */
export async function resolveUdlPort(cliPort?: number): Promise<number> {
  if (cliPort !== undefined) {
    return cliPort;
  }
  const configPort = await loadPortFromConfig();
  return configPort ?? DEFAULT_UDL_PORT;
}

/**
 * Create environment variables for spawning Next.js with UDL_ENDPOINT set.
 */
export function createNextEnv(udlEndpoint: string): NodeJS.ProcessEnv {
  return {
    ...process.env,
    [UDL_ENDPOINT_ENV]: udlEndpoint,
  };
}
