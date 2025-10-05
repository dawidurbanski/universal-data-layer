import { Link } from 'react-router-dom';
import type { Scenario } from '@/types';

interface SidebarProps {
  scenarios: Scenario[];
  selectedScenario: Scenario | null;
  onSelectScenario: (scenario: Scenario) => void;
  onOpenSpotlight: () => void;
}

function Sidebar({
  scenarios,
  selectedScenario,
  onSelectScenario,
  onOpenSpotlight,
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
      <aside className="sidebar flex flex-col">
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

        <nav className="p-2 flex-1 overflow-y-auto">
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

        {/* Search Button */}
        <div className="p-3 border-t border-gray-200">
          <button
            onClick={onOpenSpotlight}
            className="w-full flex items-center justify-between px-3 py-2 text-sm text-gray-600 bg-gray-50 hover:bg-gray-100 rounded-md transition-colors"
            title="Search scenarios (⌘K)"
          >
            <div className="flex items-center gap-2">
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              <span>Search</span>
            </div>
            <kbd className="px-1.5 py-0.5 text-xs bg-white border border-gray-300 rounded">
              ⌘K
            </kbd>
          </button>
        </div>
      </aside>
    );
  }

  // Show package list
  return (
    <aside className="sidebar flex flex-col">
      <nav className="p-2 flex-1 overflow-y-auto">
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

      {/* Search Button */}
      <div className="p-3 border-t border-gray-200">
        <button
          onClick={onOpenSpotlight}
          className="w-full flex items-center justify-between px-3 py-2 text-sm text-gray-600 bg-gray-50 hover:bg-gray-100 rounded-md transition-colors"
          title="Search scenarios (⌘K)"
        >
          <div className="flex items-center gap-2">
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <span>Search</span>
          </div>
          <kbd className="px-1.5 py-0.5 text-xs bg-white border border-gray-300 rounded">
            ⌘K
          </kbd>
        </button>
      </div>
    </aside>
  );
}

export default Sidebar;
