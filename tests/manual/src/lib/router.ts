import type { Scenario } from './registry';
import { loadDocumentation } from './registry';
import { marked } from 'marked';

// Configure marked for better rendering
marked.setOptions({
  gfm: true,
  breaks: true,
});

export class Router {
  private contentContainer: HTMLElement;
  private docsContainer: HTMLElement | null;

  constructor(contentContainer: HTMLElement, docsContainer?: HTMLElement) {
    this.contentContainer = contentContainer;
    this.docsContainer = docsContainer || null;
  }

  public async loadScenario(scenario: Scenario): Promise<void> {
    // Load scenario in iframe
    this.contentContainer.innerHTML = `
      <iframe
        src="${scenario.path}"
        class="w-full h-full border-0"
        title="${scenario.feature}"
      ></iframe>
    `;

    // Load documentation if available
    if (this.docsContainer) {
      await this.loadDocs(scenario);
    }
  }

  private async loadDocs(scenario: Scenario): Promise<void> {
    if (!this.docsContainer) return;

    const hasDescription = scenario.hasDescription;
    const hasReproduction = scenario.hasReproduction;

    if (!hasDescription && !hasReproduction) {
      this.docsContainer.innerHTML = '';
      return;
    }

    let html = '<div class="p-4">';

    // If both exist, create tabs
    if (hasDescription && hasReproduction) {
      const description = await loadDocumentation(
        scenario.package,
        scenario.feature,
        'description'
      );
      const reproduction = await loadDocumentation(
        scenario.package,
        scenario.feature,
        'reproduction'
      );

      html += `
        <div class="mb-4 border-b border-gray-200">
          <nav class="flex space-x-4" role="tablist">
            <button
              class="tab-button px-4 py-2 text-sm font-medium border-b-2 border-blue-500 text-blue-600"
              data-tab="description"
            >
              Description
            </button>
            <button
              class="tab-button px-4 py-2 text-sm font-medium border-b-2 border-transparent text-gray-500 hover:text-gray-700"
              data-tab="reproduction"
            >
              Reproduction
            </button>
          </nav>
        </div>
        <div class="tab-content markdown-content" data-tab="description">
          ${await this.renderMarkdown(description || '')}
        </div>
        <div class="tab-content markdown-content hidden" data-tab="reproduction">
          ${await this.renderMarkdown(reproduction || '')}
        </div>
      `;

      this.docsContainer.innerHTML = html + '</div>';

      // Add tab switching functionality
      this.docsContainer.querySelectorAll('.tab-button').forEach((button) => {
        button.addEventListener('click', () => {
          const tab = (button as HTMLElement).dataset['tab'];
          this.switchTab(tab || 'description');
        });
      });
    } else {
      // Single document
      const type: 'description' | 'reproduction' = hasDescription
        ? 'description'
        : 'reproduction';
      const content = await loadDocumentation(
        scenario.package,
        scenario.feature,
        type
      );

      html += `
        <div class="markdown-content">
          ${await this.renderMarkdown(content || '')}
        </div>
      `;

      this.docsContainer.innerHTML = html + '</div>';
    }
  }

  private switchTab(tab: string): void {
    if (!this.docsContainer) return;

    // Update button states
    this.docsContainer.querySelectorAll('.tab-button').forEach((btn) => {
      const isActive = (btn as HTMLElement).dataset['tab'] === tab;
      btn.classList.toggle('border-blue-500', isActive);
      btn.classList.toggle('text-blue-600', isActive);
      btn.classList.toggle('border-transparent', !isActive);
      btn.classList.toggle('text-gray-500', !isActive);
    });

    // Update content visibility
    this.docsContainer.querySelectorAll('.tab-content').forEach((content) => {
      const isActive = (content as HTMLElement).dataset['tab'] === tab;
      content.classList.toggle('hidden', !isActive);
    });
  }

  private async renderMarkdown(markdown: string): Promise<string> {
    return await marked.parse(markdown);
  }

  public showEmptyState(): void {
    this.contentContainer.innerHTML = `
      <div class="empty-state">
        <div>
          <h2 class="text-xl font-semibold text-gray-700 mb-2">No Scenario Selected</h2>
          <p class="text-sm">Select a scenario from the sidebar to begin testing.</p>
        </div>
      </div>
    `;

    if (this.docsContainer) {
      this.docsContainer.innerHTML = '';
    }
  }
}
