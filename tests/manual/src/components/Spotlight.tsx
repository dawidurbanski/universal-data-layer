import { useState, useEffect, useRef, useMemo } from 'react';
import Fuse from 'fuse.js';
import type { Scenario } from '@/types';

interface SpotlightProps {
  isOpen: boolean;
  onClose: () => void;
  scenarios: Scenario[];
  onSelectScenario: (scenario: Scenario) => void;
}

function Spotlight({
  isOpen,
  onClose,
  scenarios,
  onSelectScenario,
}: SpotlightProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Configure fuzzy search
  const fuse = useMemo(
    () =>
      new Fuse(scenarios, {
        keys: [
          { name: 'title', weight: 2 },
          { name: 'package', weight: 1.5 },
          { name: 'feature', weight: 1 },
          { name: 'description', weight: 0.5 },
        ],
        threshold: 0.4,
        includeScore: true,
      }),
    [scenarios]
  );

  // Filter scenarios based on query
  const filteredScenarios = useMemo(() => {
    if (!query.trim()) {
      return scenarios;
    }
    return fuse.search(query).map((result) => result.item);
  }, [query, scenarios, fuse]);

  // Reset selected index when filtered results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [filteredScenarios]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
      setQuery('');
      setSelectedIndex(0);
    }
  }, [isOpen]);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((prev) =>
            Math.min(prev + 1, filteredScenarios.length - 1)
          );
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((prev) => Math.max(prev - 1, 0));
          break;
        case 'Enter':
          e.preventDefault();
          if (filteredScenarios[selectedIndex]) {
            onSelectScenario(filteredScenarios[selectedIndex]);
            onClose();
          }
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, selectedIndex, filteredScenarios, onSelectScenario, onClose]);

  // Scroll selected item into view
  useEffect(() => {
    if (listRef.current) {
      const selectedElement = listRef.current.children[
        selectedIndex
      ] as HTMLElement;
      selectedElement?.scrollIntoView({
        block: 'nearest',
        behavior: 'smooth',
      });
    }
  }, [selectedIndex]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh] bg-black/50"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-white rounded-lg shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input */}
        <div className="border-b border-gray-200 p-4">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search test scenarios..."
            className="w-full px-4 py-2 text-lg border-none outline-none bg-transparent"
            aria-label="Search test scenarios"
          />
        </div>

        {/* Results */}
        <div
          ref={listRef}
          className="max-h-[400px] overflow-y-auto"
          role="listbox"
        >
          {filteredScenarios.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              No scenarios found
            </div>
          ) : (
            filteredScenarios.map((scenario, index) => (
              <button
                key={scenario.id}
                onClick={() => {
                  onSelectScenario(scenario);
                  onClose();
                }}
                className={`w-full text-left px-4 py-3 border-b border-gray-100 hover:bg-gray-50 transition-colors ${
                  index === selectedIndex ? 'bg-blue-50' : ''
                }`}
                role="option"
                aria-selected={index === selectedIndex}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">
                      {scenario.title}
                    </div>
                    <div className="text-sm text-gray-500 mt-1">
                      {scenario.package} / {scenario.feature}
                    </div>
                  </div>
                  {index === selectedIndex && (
                    <div className="text-xs text-gray-400 ml-4">↵</div>
                  )}
                </div>
              </button>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 px-4 py-2 bg-gray-50 flex items-center justify-between text-xs text-gray-500">
          <div className="flex gap-4">
            <span>
              <kbd className="px-2 py-1 bg-white border border-gray-300 rounded">
                ↑↓
              </kbd>{' '}
              Navigate
            </span>
            <span>
              <kbd className="px-2 py-1 bg-white border border-gray-300 rounded">
                ↵
              </kbd>{' '}
              Select
            </span>
            <span>
              <kbd className="px-2 py-1 bg-white border border-gray-300 rounded">
                Esc
              </kbd>{' '}
              Close
            </span>
          </div>
          <div className="text-gray-400">
            {filteredScenarios.length}{' '}
            {filteredScenarios.length === 1 ? 'result' : 'results'}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Spotlight;
