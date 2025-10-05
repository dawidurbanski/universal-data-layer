import type { Scenario, ScenarioRegistry } from './registry';

export class Sidebar {
  private container: HTMLElement;
  private registry: ScenarioRegistry;
  private onScenarioSelect?: (scenario: Scenario) => void;
  private activeScenarioId: string | null = null;

  constructor(
    container: HTMLElement,
    registry: ScenarioRegistry,
    onScenarioSelect?: (scenario: Scenario) => void
  ) {
    this.container = container;
    this.registry = registry;
    this.onScenarioSelect = onScenarioSelect ?? (() => {});
    this.render();
  }

  private render(): void {
    if (this.registry.scenarios.length === 0) {
      this.container.innerHTML = `
        <div class="empty-state p-4">
          <p class="text-sm">No manual test scenarios found.</p>
          <p class="text-xs mt-2">Create scenarios in packages/*/tests/manual/features/</p>
        </div>
      `;
      return;
    }

    // Group scenarios by package
    const scenariosByPackage = new Map<string, Scenario[]>();

    for (const scenario of this.registry.scenarios) {
      if (!scenariosByPackage.has(scenario.package)) {
        scenariosByPackage.set(scenario.package, []);
      }
      scenariosByPackage.get(scenario.package)!.push(scenario);
    }

    let html = '<div class="sidebar">';

    for (const [pkg, scenarios] of scenariosByPackage) {
      html += `
        <div class="sidebar-section">
          <h3 class="sidebar-heading">${pkg}</h3>
          <nav>
      `;

      for (const scenario of scenarios) {
        html += `
          <a
            href="#"
            class="sidebar-item"
            data-scenario-id="${scenario.id}"
          >
            ${scenario.feature}
          </a>
        `;
      }

      html += `
          </nav>
        </div>
      `;
    }

    html += '</div>';

    this.container.innerHTML = html;

    // Attach event listeners
    this.container.querySelectorAll('.sidebar-item').forEach((item) => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        const scenarioId = (item as HTMLElement).dataset['scenarioId'];
        if (scenarioId) {
          this.selectScenario(scenarioId);
        }
      });
    });
  }

  private selectScenario(scenarioId: string): void {
    const scenario = this.registry.scenarios.find((s) => s.id === scenarioId);

    if (!scenario) {
      console.warn(`Scenario not found: ${scenarioId}`);
      return;
    }

    // Update active state
    this.container.querySelectorAll('.sidebar-item').forEach((item) => {
      item.classList.remove('active');
    });

    const activeItem = this.container.querySelector(
      `[data-scenario-id="${scenarioId}"]`
    );
    if (activeItem) {
      activeItem.classList.add('active');
    }

    this.activeScenarioId = scenarioId;

    // Notify callback
    if (this.onScenarioSelect) {
      this.onScenarioSelect(scenario);
    }
  }

  public getActiveScenario(): string | null {
    return this.activeScenarioId;
  }
}
