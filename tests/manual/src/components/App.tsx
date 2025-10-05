import { useState, useEffect, lazy, type ComponentType } from 'react';
import { Routes, Route, useNavigate, useParams } from 'react-router-dom';
import Sidebar from '@/components/Sidebar';
import ScenarioContent from '@/components/ScenarioContent';
import DocsSidebar from '@/components/DocsSidebar';
import Spotlight from '@/components/Spotlight';
import type { Scenario } from '@/types';

// Use Vite's glob import to load all test components
// Path is relative to this file: tests/manual/src/App.tsx
// Target: packages/{package}/tests/manual/features/{feature}/index.tsx
const componentModules = import.meta.glob(
  '../../../../packages/*/tests/manual/features/*/index.tsx',
  { eager: false }
);

function ScenarioView() {
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSpotlightOpen, setIsSpotlightOpen] = useState(false);
  const navigate = useNavigate();
  const { packageName, featureName } = useParams();
  const packageFilter = __PACKAGE_FILTER__;
  const featureFilter = __FEATURE_FILTER__;
  const isPackageOnlyMode = !!packageFilter;
  const isSingleFeatureMode = !!featureFilter;

  useEffect(() => {
    const loadScenarios = async () => {
      try {
        // Load manifest files from packages
        const response = await fetch('/api/scenarios');
        const data = (await response.json()) as { scenarios: Scenario[] };

        console.log(
          'Available component modules:',
          Object.keys(componentModules)
        );
        console.log('Scenarios from API:', data.scenarios);

        // Map components from glob imports
        const scenariosWithComponents = (data.scenarios || []).map(
          (scenario: Scenario) => {
            // Find the matching component module (relative to this file)
            const componentPath = `../../../../packages/${scenario.package}/tests/manual/features/${scenario.feature}/index.tsx`;
            const componentLoader = componentModules[componentPath];

            console.log(
              `Looking for ${componentPath}, found:`,
              !!componentLoader
            );

            return {
              ...scenario,
              component: componentLoader
                ? lazy(() =>
                    componentLoader().then((m) => ({
                      default: (m as { default: ComponentType }).default,
                    }))
                  )
                : undefined,
            };
          }
        );

        setScenarios(scenariosWithComponents as Scenario[]);

        // Auto-navigate to first scenario in package-only mode
        if (
          isPackageOnlyMode &&
          !packageName &&
          scenariosWithComponents.length > 0
        ) {
          const firstScenario = scenariosWithComponents[0];
          if (firstScenario) {
            navigate(`/${firstScenario.package}/${firstScenario.feature}`, {
              replace: true,
            });
          }
        }
      } catch (error) {
        console.error('Failed to load scenarios:', error);
        setScenarios([]);
      } finally {
        setLoading(false);
      }
    };

    loadScenarios();
  }, [isPackageOnlyMode, packageName, navigate]);

  // Handle Cmd+K / Ctrl+K keyboard shortcut to open spotlight
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd+K on Mac, Ctrl+K on Windows/Linux
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        // Only open spotlight if not in single feature mode
        if (!isSingleFeatureMode) {
          setIsSpotlightOpen(true);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSingleFeatureMode]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="text-xl font-semibold text-gray-700">
            Loading scenarios...
          </div>
        </div>
      </div>
    );
  }

  if (scenarios.length === 0) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="text-xl font-semibold text-gray-700 mb-2">
            No test scenarios found
          </div>
          <div className="text-sm text-gray-500">
            Add a manifest.ts file in packages/[package]/tests/manual/
          </div>
        </div>
      </div>
    );
  }

  // Derive selected scenario from URL params
  const selectedScenario =
    scenarios.find(
      (s) => s.package === packageName && s.feature === featureName
    ) || null;

  const handleSelectScenario = (scenario: Scenario) => {
    navigate(`/${scenario.package}/${scenario.feature}`);
  };

  // Filter scenarios for spotlight based on mode
  const spotlightScenarios = isPackageOnlyMode
    ? scenarios.filter((s) => s.package === packageFilter)
    : scenarios;

  return (
    <div className="flex h-screen">
      {!isSingleFeatureMode && (
        <Sidebar
          scenarios={scenarios}
          selectedScenario={selectedScenario}
          onSelectScenario={handleSelectScenario}
          onOpenSpotlight={() => setIsSpotlightOpen(true)}
        />
      )}

      <main className="flex-1 flex flex-col">
        <div className="flex-1 flex overflow-hidden">
          <ScenarioContent scenario={selectedScenario} />
          <DocsSidebar scenario={selectedScenario} />
        </div>
      </main>

      {/* Spotlight - hidden in single feature mode */}
      {!isSingleFeatureMode && (
        <Spotlight
          isOpen={isSpotlightOpen}
          onClose={() => setIsSpotlightOpen(false)}
          scenarios={spotlightScenarios}
          onSelectScenario={handleSelectScenario}
        />
      )}
    </div>
  );
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<ScenarioView />} />
      <Route path="/:packageName/:featureName" element={<ScenarioView />} />
    </Routes>
  );
}

export default App;
