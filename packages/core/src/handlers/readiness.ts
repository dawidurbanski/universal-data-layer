/**
 * Server readiness state tracking for health check endpoints.
 * Tracks initialization status of server components.
 */

import { isShuttingDown } from '@/shutdown.js';

export interface ReadinessChecks {
  graphql: boolean;
  nodeStore: boolean;
}

/**
 * Current readiness state of server components.
 * All components start as not ready.
 */
const state: ReadinessChecks = {
  graphql: false,
  nodeStore: false,
};

/**
 * Update the readiness status of a component.
 * @param component - The component name ('graphql' or 'nodeStore')
 * @param ready - Whether the component is ready
 */
export function setReady(
  component: keyof ReadinessChecks,
  ready: boolean
): void {
  state[component] = ready;
}

/**
 * Check if all server components are ready.
 * Returns false if shutdown is in progress.
 * @returns true if all components are ready and not shutting down, false otherwise
 */
export function isReady(): boolean {
  if (isShuttingDown()) {
    return false;
  }
  return state.graphql && state.nodeStore;
}

/**
 * Get the current readiness status of all components.
 * @returns Object with readiness status for each component
 */
export function getReadinessChecks(): ReadinessChecks {
  return { ...state };
}

/**
 * Reset readiness state (for testing purposes).
 */
export function resetReadiness(): void {
  state.graphql = false;
  state.nodeStore = false;
}
