/**
 * Wrapper for import.meta.resolve to enable mocking in tests
 * This is necessary because import.meta.resolve doesn't work properly in Vitest
 * even with Vite 7, so we extract it to allow proper mocking.
 */
export const importMetaResolve = import.meta.resolve;
