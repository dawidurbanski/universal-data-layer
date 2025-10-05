import type { Plugin, ViteDevServer } from 'vite';
import { resolve } from 'path';
import fs from 'fs';
import type { Scenario, ScenarioManifest } from './types';

export function scenariosPlugin(): Plugin {
  let server: ViteDevServer;
  const repoRoot = resolve(__dirname, '../../..');

  return {
    name: 'vite-plugin-scenarios',
    configureServer(_server) {
      server = _server;

      // Serve markdown files from packages
      server.middlewares.use((req, res, next) => {
        if (req.url?.startsWith('/packages/') && req.url.endsWith('.md')) {
          const filePath = resolve(repoRoot, req.url.slice(1));
          if (fs.existsSync(filePath)) {
            const content = fs.readFileSync(filePath, 'utf-8');
            res.setHeader('Content-Type', 'text/markdown');
            res.end(content);
            return;
          }
        }
        next();
      });

      // API endpoint for scenarios
      server.middlewares.use('/api/scenarios', async (req, res) => {
        try {
          const scenarios = await loadManifests(server);
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ scenarios }));
        } catch (error) {
          console.error('Error loading scenarios:', error);
          res.statusCode = 500;
          res.end(JSON.stringify({ error: 'Failed to load scenarios' }));
        }
      });
    },
  };
}

async function loadManifests(server: ViteDevServer) {
  const packagesDir = resolve(__dirname, '../../../packages');
  const allScenarios: Scenario[] = [];

  // Read filter from environment variables
  const packageFilter = process.env['VITE_PACKAGE_FILTER'];
  const featureFilter = process.env['VITE_FEATURE_FILTER'];

  try {
    const packageDirs = fs.readdirSync(packagesDir, { withFileTypes: true });

    for (const dir of packageDirs) {
      if (!dir.isDirectory()) continue;

      // Apply package filter
      if (packageFilter && dir.name !== packageFilter) continue;

      const featuresDir = resolve(
        packagesDir,
        dir.name,
        'tests/manual/features'
      );

      // Check if features directory exists
      if (!fs.existsSync(featuresDir)) continue;

      // Read all feature directories
      const featureDirs = fs.readdirSync(featuresDir, { withFileTypes: true });

      for (const featureDir of featureDirs) {
        if (!featureDir.isDirectory()) continue;

        // Apply feature filter
        if (featureFilter && featureDir.name !== featureFilter) continue;

        const manifestPath = resolve(
          featuresDir,
          featureDir.name,
          'manifest.ts'
        );

        if (fs.existsSync(manifestPath)) {
          try {
            // Use Vite's ssrLoadModule to load TypeScript files
            const manifest = await server.ssrLoadModule(manifestPath);

            // Each manifest exports a plain object (not an array)
            if (manifest['default']) {
              const scenario: ScenarioManifest = manifest['default'];
              const dependsOn = scenario.dependsOn || [];

              // Ensure we have an id and title field
              allScenarios.push({
                id: `${scenario.package}/${scenario.feature}`,
                ...scenario,
                title: scenario.title || scenario.feature,
                dependsOn,
              });
            }
          } catch (error) {
            console.warn(
              `Failed to load manifest for ${dir.name}/${featureDir.name}:`,
              error
            );
          }
        }
      }
    }
  } catch (error) {
    console.warn('Failed to read packages directory:', error);
  }

  return allScenarios;
}
