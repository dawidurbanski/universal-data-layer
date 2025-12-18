import { describe, it, expect, beforeEach } from 'vitest';
import {
  defaultRegistry,
  setDefaultRegistry,
  createRegistry,
  ReferenceRegistry,
} from '@/references/index.js';

describe('references/index', () => {
  describe('defaultRegistry', () => {
    it('is an instance of ReferenceRegistry', () => {
      expect(defaultRegistry).toBeInstanceOf(ReferenceRegistry);
    });
  });

  describe('setDefaultRegistry', () => {
    let originalRegistry: ReferenceRegistry;

    beforeEach(async () => {
      // Store original to restore after test
      originalRegistry = (await import('@/references/index.js'))
        .defaultRegistry;
    });

    it('replaces the default registry', async () => {
      const newRegistry = new ReferenceRegistry();
      setDefaultRegistry(newRegistry);

      // Re-import to get updated value
      const { defaultRegistry: updatedRegistry } =
        await import('@/references/index.js');
      expect(updatedRegistry).toBe(newRegistry);

      // Restore original
      setDefaultRegistry(originalRegistry);
    });
  });

  describe('createRegistry', () => {
    it('creates a new ReferenceRegistry instance', () => {
      const registry = createRegistry();
      expect(registry).toBeInstanceOf(ReferenceRegistry);
    });

    it('creates unique instances on each call', () => {
      const registry1 = createRegistry();
      const registry2 = createRegistry();
      expect(registry1).not.toBe(registry2);
    });
  });

  describe('re-exports', () => {
    it('exports ReferenceRegistry class', () => {
      expect(ReferenceRegistry).toBeDefined();
      expect(typeof ReferenceRegistry).toBe('function');
    });
  });
});
