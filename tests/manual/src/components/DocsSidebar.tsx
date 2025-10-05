import { useState, useEffect } from 'react';
import { marked } from 'marked';
import type { Scenario } from '@/types';

interface DocsSidebarProps {
  scenario: Scenario | null;
}

type TabType = 'description' | 'reproduction' | 'dependencies';

function DocsSidebar({ scenario }: DocsSidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [descriptionContent, setDescriptionContent] = useState<string>('');
  const [reproductionContent, setReproductionContent] = useState<string>('');
  const [hasDescription, setHasDescription] = useState(false);
  const [hasReproduction, setHasReproduction] = useState(false);
  const [loading, setLoading] = useState(false);

  const hasDependencies = scenario?.dependsOn && scenario.dependsOn.length > 0;

  // Determine default active tab based on available content
  const getDefaultTab = (): TabType => {
    if (hasDescription) return 'description';
    if (hasReproduction) return 'reproduction';
    if (hasDependencies) return 'dependencies';
    return 'description';
  };

  const [activeTab, setActiveTab] = useState<TabType>('description');

  useEffect(() => {
    if (scenario) {
      loadDocs(scenario);
    } else {
      setDescriptionContent('');
      setReproductionContent('');
      setHasDescription(false);
      setHasReproduction(false);
    }
  }, [scenario]);

  useEffect(() => {
    // Update active tab when content availability changes, only after loading
    if (!loading) {
      setActiveTab(getDefaultTab());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasDescription, hasReproduction, hasDependencies, loading]);

  const loadDocs = async (scenario: Scenario) => {
    setLoading(true);
    const basePath = `/packages/${scenario.package}/tests/manual/features/${scenario.feature}`;

    // Try to load description.md
    try {
      const response = await fetch(`${basePath}/description.md`);
      const contentType = response.headers.get('content-type');
      if (response.ok && contentType?.includes('text/markdown')) {
        const markdown = await response.text();
        const html = await marked(markdown);
        setDescriptionContent(html);
        setHasDescription(true);
      } else {
        setHasDescription(false);
        setDescriptionContent('');
      }
    } catch {
      setHasDescription(false);
      setDescriptionContent('');
    }

    // Try to load reproduction.md
    try {
      const response = await fetch(`${basePath}/reproduction.md`);
      const contentType = response.headers.get('content-type');
      if (response.ok && contentType?.includes('text/markdown')) {
        const markdown = await response.text();
        const html = await marked(markdown);
        setReproductionContent(html);
        setHasReproduction(true);
      } else {
        setHasReproduction(false);
        setReproductionContent('');
      }
    } catch {
      setHasReproduction(false);
      setReproductionContent('');
    }

    setLoading(false);
  };

  if (!scenario || (!hasDescription && !hasReproduction && !hasDependencies)) {
    return null;
  }

  return (
    <aside
      className={`bg-gray-50 border-l border-gray-200 overflow-hidden flex flex-col transition-all duration-300 ${
        isCollapsed ? 'w-10' : 'w-[500px]'
      }`}
    >
      {/* Collapse/Expand Button */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="absolute right-2 top-2 z-20 p-2 hover:bg-gray-200 rounded-md transition-colors"
        title={isCollapsed ? 'Expand docs' : 'Collapse docs'}
      >
        <svg
          className={`w-4 h-4 transition-transform ${isCollapsed ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 5l7 7-7 7"
          />
        </svg>
      </button>

      {!isCollapsed && (
        <>
          {/* Tabs */}
          <div className="flex border-b border-gray-200 bg-white">
            {hasDescription && (
              <button
                onClick={() => setActiveTab('description')}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'description'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                Description
              </button>
            )}
            {hasReproduction && (
              <button
                onClick={() => setActiveTab('reproduction')}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'reproduction'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                Reproduction
              </button>
            )}
            {hasDependencies && (
              <button
                onClick={() => setActiveTab('dependencies')}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'dependencies'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                Dependencies
              </button>
            )}
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {loading ? (
              <div className="text-gray-500">Loading documentation...</div>
            ) : activeTab === 'dependencies' ? (
              <div>
                <h3 className="text-lg font-semibold mb-4 text-gray-800">
                  Dependencies
                </h3>
                {scenario?.dependsOn && scenario.dependsOn.length > 0 ? (
                  <div className="space-y-2">
                    {scenario.dependsOn.map((depId: string) => (
                      <div
                        key={depId}
                        className="bg-white rounded border border-gray-200 p-3"
                      >
                        <div className="font-mono text-sm text-gray-800">
                          {depId}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-gray-500 text-sm">No dependencies</div>
                )}
              </div>
            ) : (
              <div
                className="markdown-content"
                dangerouslySetInnerHTML={{
                  __html:
                    activeTab === 'description'
                      ? descriptionContent
                      : reproductionContent,
                }}
              />
            )}
          </div>
        </>
      )}
    </aside>
  );
}

export default DocsSidebar;
