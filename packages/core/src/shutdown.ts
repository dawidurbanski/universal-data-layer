/**
 * Server shutdown state management.
 * Tracks shutdown state for graceful shutdown handling.
 */

/**
 * Options for graceful shutdown.
 */
export interface ShutdownOptions {
  /** Grace period in milliseconds before forcing exit. Default: 30000 (30 seconds) */
  gracePeriodMs?: number;
  /** Exit code to use when forcing exit after grace period. Default: 1 */
  forceExitCode?: number;
}

/**
 * Current shutdown state.
 */
interface ShutdownState {
  isShuttingDown: boolean;
}

/**
 * Module-level shutdown state.
 */
const state: ShutdownState = {
  isShuttingDown: false,
};

/**
 * Check if the server is currently shutting down.
 * @returns true if shutdown is in progress
 */
export function isShuttingDown(): boolean {
  return state.isShuttingDown;
}

/**
 * Set the shutdown state.
 * @param value - Whether shutdown is in progress
 */
export function setShuttingDown(value: boolean): void {
  state.isShuttingDown = value;
}

/**
 * Reset shutdown state (for testing purposes).
 */
export function resetShutdownState(): void {
  state.isShuttingDown = false;
}
