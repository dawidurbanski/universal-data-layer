import './styles/main.css';
import { discoverScenarios } from './lib/registry';
import { Sidebar } from './lib/sidebar';
import { Router } from './lib/router';

async function init() {
  const sidebarContainer = document.getElementById('sidebar');
  const contentContainer = document.getElementById('content');
  const docsContainer = document.getElementById('docs');

  if (!sidebarContainer || !contentContainer) {
    console.error('Required containers not found');
    return;
  }

  // Discover all scenarios
  const registry = await discoverScenarios();

  // Initialize router
  const router = new Router(contentContainer, docsContainer || undefined);

  // Show empty state initially
  router.showEmptyState();

  // Initialize sidebar
  new Sidebar(sidebarContainer, registry, (scenario) => {
    router.loadScenario(scenario);
  });
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
