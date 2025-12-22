import { DeletionLog } from './deletionLog.js';

/**
 * Default singleton deletion log instance.
 * This is automatically created on first import and persists across the application.
 * All plugins using the default behavior will share this deletion log.
 *
 * @example
 * ```ts
 * // In your application - all modules get the same deletion log instance
 * import { defaultDeletionLog } from 'universal-data-layer';
 *
 * // Record a deletion
 * defaultDeletionLog.recordDeletion(node);
 *
 * // Query deletions since a timestamp
 * const deleted = defaultDeletionLog.getDeletedSince('2024-01-01T00:00:00.000Z');
 * ```
 *
 * @example
 * ```ts
 * // For testing - replace with a fresh deletion log
 * import { defaultDeletionLog, setDefaultDeletionLog } from 'universal-data-layer';
 *
 * beforeEach(() => {
 *   setDefaultDeletionLog(new DeletionLog());
 * });
 * ```
 */
export let defaultDeletionLog: DeletionLog = new DeletionLog();

/**
 * Replace the default deletion log with a new instance.
 * Useful for testing to ensure isolation between test runs.
 *
 * @param log - The new deletion log to use as the default
 *
 * @example
 * ```ts
 * import { setDefaultDeletionLog, DeletionLog } from 'universal-data-layer';
 *
 * // In test setup
 * beforeEach(() => {
 *   setDefaultDeletionLog(new DeletionLog());
 * });
 * ```
 */
export function setDefaultDeletionLog(log: DeletionLog): void {
  defaultDeletionLog = log;
}
