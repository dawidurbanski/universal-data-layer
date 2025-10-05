export interface Scenario {
  id: string;
  package: string;
  feature: string;
  path: string;
  hasDescription: boolean;
  hasReproduction: boolean;
  dependsOn?: string[];
}

export interface ScenarioRegistry {
  scenarios: Scenario[];
  packages: string[];
}

/**
 * Discovers all manual test scenarios across packages
 * Uses Vite's glob import to statically import all manifest files
 */
// Derive the absolute base path from the first manifest we find
let cachedBasePath: string | null = null;

// Declare global variable injected by Vite
declare const __REPO_ROOT__: string;

async function getBasePath(): Promise<string> {
  if (cachedBasePath) return cachedBasePath;

  // Use the repo root path injected by Vite at build time
  if (typeof __REPO_ROOT__ !== 'undefined') {
    cachedBasePath = `/@fs${__REPO_ROOT__}`;
    return cachedBasePath;
  }

  // Fallback: try to derive from fetch
  try {
    const testPath = '../../../../packages/core/tests/manual/manifest.ts';
    const response = await fetch(
      new URL(testPath, import.meta.url).href + '?import'
    );

    const finalUrl = response.url;

    if (finalUrl.includes('/@fs/')) {
      const match = finalUrl.match(/(\/@fs\/[^/]+(?:\/[^/]+)*?)\/packages\//);
      if (match && match[1]) {
        cachedBasePath = match[1];
        return cachedBasePath;
      }
    }
  } catch {
    // Silent fallthrough to error
  }

  // Last resort: error message
  throw new Error(
    'Could not determine repository root path. Please check Vite configuration.'
  );
}

export async function discoverScenarios(): Promise<ScenarioRegistry> {
  const scenarios: Scenario[] = [];
  const packages = new Set<string>();

  // Use Vite's glob import to find all manifest files in feature directories
  // Using eager glob import with explicit pattern
  const manifests = import.meta.glob(
    '../../../../packages/*/tests/manual/features/*/manifest.ts',
    { eager: true }
  );

  for (const [path, module] of Object.entries(manifests)) {
    try {
      // Extract package name and feature name from path
      // Path format: ../../../../packages/{package}/tests/manual/features/{feature}/manifest.ts
      const match = path.match(
        /packages\/([^/]+)\/tests\/manual\/features\/([^/]+)\//
      );
      if (!match || !match[1] || !match[2]) {
        continue;
      }

      const pkg = match[1];
      const featureName = match[2];

      const manifest = module as {
        default?: {
          package: string;
          feature: string;
          title?: string;
          description?: string;
          hasDescription?: boolean;
          hasReproduction?: boolean;
          dependsOn?: string[];
        };
      };

      // Each manifest exports a plain object as default export
      if (manifest.default) {
        const scenario = manifest.default;

        // Build path using @fs protocol with derived base path
        const basePath = await getBasePath();
        const scenarioPath = `${basePath}/packages/${pkg}/tests/manual/features/${featureName}/index.html`;

        scenarios.push({
          id: `${pkg}/${featureName}`,
          package: pkg,
          feature: featureName,
          path: scenarioPath,
          hasDescription: scenario.hasDescription ?? false,
          hasReproduction: scenario.hasReproduction ?? false,
          dependsOn: scenario.dependsOn ?? [],
        });
        packages.add(pkg);
      }
    } catch (error) {
      console.error(`Error loading manifest from ${path}:`, error);
    }
  }

  return {
    scenarios,
    packages: Array.from(packages).sort(),
  };
}

/**
 * Loads markdown documentation for a scenario
 */
export async function loadDocumentation(
  pkg: string,
  feature: string,
  type: 'description' | 'reproduction'
): Promise<string | null> {
  try {
    // Use the cached base path (must be set by discoverScenarios first)
    if (!cachedBasePath) {
      return null;
    }

    const response = await fetch(
      `${cachedBasePath}/packages/${pkg}/tests/manual/features/${feature}/${type}.md`
    );

    if (!response.ok) {
      return null;
    }

    return await response.text();
  } catch {
    return null;
  }
}
