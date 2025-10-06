import { NodeStore } from './store.js';

/**
 * Default singleton node store instance
 * This is automatically created on first import and persists across the application
 * All plugins using the default behavior will share this store
 *
 * @example
 * ```ts
 * // In your application - all modules get the same store instance
 * import { defaultStore } from 'universal-data-layer';
 *
 * // Plugin A sources data
 * await actions.createNode({ ... });
 *
 * // Plugin B can query data from Plugin A
 * const nodes = defaultStore.getAll();
 * ```
 *
 * @example
 * ```ts
 * // For testing - replace with a fresh store
 * import { defaultStore, setDefaultStore } from 'universal-data-layer';
 *
 * beforeEach(() => {
 *   setDefaultStore(new NodeStore());
 * });
 * ```
 */
export let defaultStore: NodeStore = new NodeStore();

/**
 * Replace the default store with a new instance
 * Useful for testing to ensure isolation between test runs
 *
 * @param store - The new store to use as the default
 *
 * @example
 * ```ts
 * import { setDefaultStore, NodeStore } from 'universal-data-layer';
 *
 * // In test setup
 * beforeEach(() => {
 *   setDefaultStore(new NodeStore());
 * });
 * ```
 */
export function setDefaultStore(store: NodeStore): void {
  defaultStore = store;
}
