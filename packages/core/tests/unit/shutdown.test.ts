import { describe, it, expect, beforeEach } from 'vitest';
import {
  isShuttingDown,
  setShuttingDown,
  resetShutdownState,
} from '@/shutdown.js';

describe('shutdown state', () => {
  beforeEach(() => {
    resetShutdownState();
  });

  describe('initial state', () => {
    it('should not be shutting down initially', () => {
      expect(isShuttingDown()).toBe(false);
    });
  });

  describe('setShuttingDown', () => {
    it('should set shutdown state to true', () => {
      setShuttingDown(true);
      expect(isShuttingDown()).toBe(true);
    });

    it('should set shutdown state to false', () => {
      setShuttingDown(true);
      setShuttingDown(false);
      expect(isShuttingDown()).toBe(false);
    });

    it('should handle multiple true calls', () => {
      setShuttingDown(true);
      setShuttingDown(true);
      expect(isShuttingDown()).toBe(true);
    });
  });

  describe('resetShutdownState', () => {
    it('should reset shutdown state to false', () => {
      setShuttingDown(true);
      expect(isShuttingDown()).toBe(true);

      resetShutdownState();
      expect(isShuttingDown()).toBe(false);
    });

    it('should be idempotent when already false', () => {
      resetShutdownState();
      expect(isShuttingDown()).toBe(false);
    });
  });
});
