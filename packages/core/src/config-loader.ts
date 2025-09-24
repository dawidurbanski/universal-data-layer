import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export interface UDLConfig {
  port?: number;
  host?: string;
  endpoint?: string;
}

export async function loadConfig(
  cwd: string = process.cwd()
): Promise<UDLConfig> {
  const configPaths = [
    join(cwd, 'udl.config.js'),
    join(cwd, 'udl.config.mjs'),
    join(cwd, 'udl.config.cjs'),
  ];

  for (const configPath of configPaths) {
    if (existsSync(configPath)) {
      try {
        const absolutePath = resolve(configPath);
        const fileUrl = pathToFileURL(absolutePath).href;
        const module = await import(fileUrl);
        const config = module.default || module;

        return {
          port: config.port,
          host: config.host,
          endpoint: config.endpoint,
        };
      } catch (error) {
        console.warn(`Failed to load config from ${configPath}:`, error);
      }
    }
  }

  return {};
}
