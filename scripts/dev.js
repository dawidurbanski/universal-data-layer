#!/usr/bin/env node

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const args = process.argv.slice(2);
const packageFlag = args.find((arg) => arg.startsWith('--package='));
const featureFlag = args.find((arg) => arg.startsWith('--feature='));

// Package name aliases - maps user-friendly names to actual directory names
const packageAliases = {
  'universal-data-layer': 'core',
};

const packageInput = packageFlag?.split('=')[1];
// Resolve alias to actual directory name in packages/
const packageName = packageInput
  ? packageAliases[packageInput] || packageInput
  : undefined;
const featureName = featureFlag?.split('=')[1];

console.log('Starting manual test server...');

if (packageName) {
  console.log(`📦 Package filter: ${packageName}`);
}

if (featureName) {
  console.log(`🎯 Feature filter: ${featureName}`);
}

// Function to dynamically import TypeScript file using tsx
async function importTypeScript(filePath) {
  const { execSync } = await import('child_process');

  // Use tsx to compile and execute the TypeScript file
  const result = execSync(
    `npx tsx -e "
    import manifest from '${filePath}';
    console.log(JSON.stringify({ default: manifest }));
  "`,
    { encoding: 'utf-8' }
  );

  return JSON.parse(result.trim());
}

// Function to load manifests from feature directories
async function loadManifests() {
  const manifests = [];
  const fs = await import('fs');

  if (packageName && featureName) {
    // Load manifest from specific feature
    const manifestPath = resolve(
      __dirname,
      `../packages/${packageName}/tests/manual/features/${featureName}/manifest.ts`
    );
    try {
      const manifest = await importTypeScript(manifestPath);
      // Each manifest is a plain object with default export
      if (manifest.default) {
        manifests.push({ package: packageName, scenarios: [manifest.default] });
      }
    } catch (error) {
      console.warn(
        `Could not read manifest for package ${packageName}, feature ${featureName}:`,
        error.message
      );
    }
  } else if (packageName) {
    // Load all manifests from specific package
    const featuresDir = resolve(
      __dirname,
      `../packages/${packageName}/tests/manual/features`
    );
    try {
      if (fs.existsSync(featuresDir)) {
        const featureDirs = fs.readdirSync(featuresDir, {
          withFileTypes: true,
        });
        const scenarios = [];

        for (const featureDir of featureDirs) {
          if (featureDir.isDirectory()) {
            const manifestPath = resolve(
              featuresDir,
              featureDir.name,
              'manifest.ts'
            );
            if (fs.existsSync(manifestPath)) {
              try {
                const manifest = await importTypeScript(manifestPath);
                if (manifest.default) {
                  scenarios.push(manifest.default);
                }
              } catch {
                // Silently skip features with invalid manifests
                continue;
              }
            }
          }
        }

        if (scenarios.length > 0) {
          manifests.push({ package: packageName, scenarios });
        }
      }
    } catch (error) {
      console.warn(
        `Could not read features directory for package ${packageName}:`,
        error.message
      );
    }
  } else {
    // Load manifests from all packages
    const packagesDir = resolve(__dirname, '../packages');

    try {
      const packageDirs = fs.readdirSync(packagesDir, { withFileTypes: true });

      for (const dir of packageDirs) {
        if (!dir.isDirectory()) continue;

        const featuresDir = resolve(
          packagesDir,
          dir.name,
          'tests/manual/features'
        );

        if (!fs.existsSync(featuresDir)) continue;

        const featureDirs = fs.readdirSync(featuresDir, {
          withFileTypes: true,
        });
        const scenarios = [];

        for (const featureDir of featureDirs) {
          if (!featureDir.isDirectory()) continue;

          const manifestPath = resolve(
            featuresDir,
            featureDir.name,
            'manifest.ts'
          );

          if (fs.existsSync(manifestPath)) {
            try {
              const manifest = await importTypeScript(manifestPath);
              if (manifest.default) {
                scenarios.push(manifest.default);
              }
            } catch {
              // Silently skip features with invalid manifests
              continue;
            }
          }
        }

        if (scenarios.length > 0) {
          manifests.push({ package: dir.name, scenarios });
        }
      }
    } catch (error) {
      console.warn('Could not read packages directory:', error.message);
    }
  }

  return manifests;
}

// Load manifests and collect dependencies
loadManifests()
  .then((manifests) => {
    // When running all packages, include all packages with manual tests
    // When running specific package, only include that package's dependencies
    const packagesWithDevMode = new Set();

    if (packageName) {
      // Specific package mode: only run dev for the target package
      packagesWithDevMode.add(packageName);

      // Also collect any dependencies from that package's scenarios
      manifests.forEach(({ scenarios }) => {
        scenarios.forEach((scenario) => {
          if (featureName && scenario.feature !== featureName) {
            return;
          }
          if (scenario.dependsOn) {
            scenario.dependsOn.forEach((dep) => packagesWithDevMode.add(dep));
          }
        });
      });
    } else {
      // All packages mode: include all packages that have manual tests
      manifests.forEach(({ package: pkg }) => {
        packagesWithDevMode.add(pkg);
      });

      // Also collect all dependencies from all scenarios
      manifests.forEach(({ scenarios }) => {
        scenarios.forEach((scenario) => {
          if (scenario.dependsOn) {
            scenario.dependsOn.forEach((dep) => packagesWithDevMode.add(dep));
          }
        });
      });
    }

    console.log(
      `🔄 Starting dev mode for: manual tests${packageName ? ` (package: ${packageName})` : ''} + ${Array.from(packagesWithDevMode).join(', ')}\n`
    );

    // Build turbo command
    // When running specific package: run dev for core + manual-tests, dev for target package
    // When running all packages: run dev for core + manual-tests, dev for all packages with tests
    const turboArgs = ['run'];

    if (packageName) {
      // Specific package mode
      turboArgs.push('dev');
      turboArgs.push('--filter=./tests/manual'); // manual-tests dev
      turboArgs.push('--filter=./packages/core'); // core dev

      // Add dev filter for target package and dependencies (excluding core)
      packagesWithDevMode.forEach((pkg) => {
        if (pkg !== 'core') {
          turboArgs.push(`--filter=./packages/${pkg}`);
        }
      });
    } else {
      // All packages mode
      turboArgs.push('dev');
      turboArgs.push('--filter=./tests/manual'); // manual-tests dev
      turboArgs.push('--filter=./packages/core'); // core dev

      // Add dev filter for all packages with manual tests (excluding core since it's already added)
      packagesWithDevMode.forEach((pkg) => {
        if (pkg !== 'core') {
          turboArgs.push(`--filter=./packages/${pkg}`);
        }
      });
    }

    // Start turbo with all filters
    const turbo = spawn('turbo', turboArgs, {
      cwd: resolve(__dirname, '..'),
      stdio: 'inherit',
      shell: true,
      env: {
        ...process.env,
        VITE_PACKAGE_FILTER: packageName || '',
        VITE_FEATURE_FILTER: featureName || '',
      },
    });

    turbo.on('error', (error) => {
      console.error('Failed to start turbo:', error);
      process.exit(1);
    });

    turbo.on('close', (code) => {
      process.exit(code || 0);
    });

    // Handle termination signals
    process.on('SIGINT', () => {
      turbo.kill('SIGINT');
      process.exit(0);
    });

    process.on('SIGTERM', () => {
      turbo.kill('SIGTERM');
      process.exit(0);
    });
  })
  .catch((error) => {
    console.warn('Could not load manifests:', error.message);
    console.log('Starting with core only...\n');

    // Fallback to just core + manual tests
    const turbo = spawn(
      'turbo',
      ['run', 'dev', '--filter=./tests/manual', '--filter=./packages/core'],
      {
        cwd: resolve(__dirname, '..'),
        stdio: 'inherit',
        shell: true,
      }
    );

    turbo.on('close', (code) => {
      process.exit(code || 0);
    });
  });
