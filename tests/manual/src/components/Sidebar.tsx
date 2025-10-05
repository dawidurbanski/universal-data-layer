import { Link } from 'react-router-dom';
import type { Scenario } from '../types';

interface SidebarProps {
  scenarios: Scenario[];
  selectedScenario: Scenario | null;
  onSelectScenario: (scenario: Scenario) => void;
}

function Sidebar({
  scenarios,
  selectedScenario,
  onSelectScenario,
}: SidebarProps) {
  // Check if we're in package-only mode
  const packageFilter = __PACKAGE_FILTER__;
  const isPackageOnlyMode = !!packageFilter;

  // Group scenarios by package
  const scenariosByPackage = scenarios.reduce(
    (acc, scenario) => {
      if (!acc[scenario.package]) {
        acc[scenario.package] = [];
      }
      acc[scenario.package]?.push(scenario);
      return acc;
    },
    {} as Record<string, Scenario[]>
  );

  const packages = Object.keys(scenariosByPackage);

  // Show features if we have a selected scenario (derived from URL) or in package-only mode
  const currentPackage =
    selectedScenario?.package || (isPackageOnlyMode ? packageFilter : null);

  if (currentPackage) {
    const pkgScenarios = scenariosByPackage[currentPackage] || [];

    return (
      <aside className="sidebar">
        {!isPackageOnlyMode && (
          <div className="p-4 border-b border-gray-200">
            <Link
              to="/"
              className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
            >
              <span>←</span>
              <span>Back to packages</span>
            </Link>
          </div>
        )}

        <nav className="p-2">
          {pkgScenarios.map((scenario) => (
            <Link
              key={scenario.id}
              to={`/${scenario.package}/${scenario.feature}`}
              onClick={() => onSelectScenario(scenario)}
              className={`sidebar-item w-full text-left block ${selectedScenario?.id === scenario.id ? 'active' : ''}`}
            >
              <span className="font-medium">{scenario.title}</span>
            </Link>
          ))}
        </nav>
      </aside>
    );
  }

  // Show package list
  return (
    <aside className="sidebar">
      <nav className="p-2">
        <div className="sidebar-section">
          <div className="sidebar-heading">Packages</div>
          {packages.map((packageName) => {
            const count = scenariosByPackage[packageName]?.length || 0;
            const firstScenario = scenariosByPackage[packageName]?.[0];
            return (
              <Link
                key={packageName}
                to={
                  firstScenario
                    ? `/${firstScenario.package}/${firstScenario.feature}`
                    : '/'
                }
                className="sidebar-item w-full block"
              >
                <div className="flex justify-between items-center">
                  <span className="font-medium">{packageName}</span>
                  <span className="text-xs text-gray-500">
                    {count} test{count !== 1 ? 's' : ''}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </nav>
    </aside>
  );
}

export default Sidebar;
