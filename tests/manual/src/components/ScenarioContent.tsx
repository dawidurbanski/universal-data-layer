import { Suspense } from 'react';
import { Link } from 'react-router-dom';
import type { Scenario } from '@/types';

interface ScenarioContentProps {
  scenario: Scenario | null;
}

function ScenarioContent({ scenario }: ScenarioContentProps) {
  const packageFilter = __PACKAGE_FILTER__;
  const featureFilter = __FEATURE_FILTER__;
  const isPackageOnlyMode = !!packageFilter;
  const isSingleFeatureMode = !!featureFilter;

  if (!scenario) {
    return (
      <div className="flex-1 flex items-center justify-center bg-white">
        <div className="text-center text-gray-500">
          <div className="text-lg">Select a scenario to begin testing</div>
        </div>
      </div>
    );
  }

  const ScenarioComponent = scenario.component;

  return (
    <div className="flex-1 bg-white overflow-y-auto">
      <div className="border-b border-gray-200 bg-white sticky top-0 z-10">
        <div className="px-6 py-4">
          <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
            {!isPackageOnlyMode && (
              <>
                <Link
                  to="/"
                  className="font-medium hover:text-gray-900 hover:underline"
                >
                  Packages
                </Link>
                <span>›</span>
              </>
            )}
            {!isSingleFeatureMode && (
              <>
                <span className="font-medium">{scenario.package}</span>
                <span>›</span>
              </>
            )}
            <span>{scenario.feature}</span>
          </div>
          <h2 className="text-2xl font-bold text-gray-900">{scenario.title}</h2>
          {scenario.description && (
            <p className="mt-2 text-gray-600">{scenario.description}</p>
          )}
        </div>
      </div>

      <div className="p-6">
        {ScenarioComponent ? (
          <Suspense
            fallback={<div className="text-gray-500">Loading component...</div>}
          >
            <ScenarioComponent />
          </Suspense>
        ) : (
          <div className="text-center py-12">
            <div className="text-gray-500">
              No component defined for this scenario
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default ScenarioContent;
