import { describe, it, expect, beforeEach } from 'vitest';
import {
  setReady,
  isReady,
  getReadinessChecks,
  resetReadiness,
} from '@/handlers/readiness.js';

describe('readiness state', () => {
  beforeEach(() => {
    resetReadiness();
  });

  describe('initial state', () => {
    it('should have all components as false initially', () => {
      const checks = getReadinessChecks();
      expect(checks.graphql).toBe(false);
      expect(checks.nodeStore).toBe(false);
    });

    it('should not be ready initially', () => {
      expect(isReady()).toBe(false);
    });
  });

  describe('setReady', () => {
    it('should update graphql status to true', () => {
      setReady('graphql', true);

      const checks = getReadinessChecks();
      expect(checks.graphql).toBe(true);
      expect(checks.nodeStore).toBe(false);
    });

    it('should update nodeStore status to true', () => {
      setReady('nodeStore', true);

      const checks = getReadinessChecks();
      expect(checks.graphql).toBe(false);
      expect(checks.nodeStore).toBe(true);
    });

    it('should update graphql status to false', () => {
      setReady('graphql', true);
      setReady('graphql', false);

      const checks = getReadinessChecks();
      expect(checks.graphql).toBe(false);
    });

    it('should update nodeStore status to false', () => {
      setReady('nodeStore', true);
      setReady('nodeStore', false);

      const checks = getReadinessChecks();
      expect(checks.nodeStore).toBe(false);
    });

    it('should update both components independently', () => {
      setReady('graphql', true);
      setReady('nodeStore', true);

      const checks = getReadinessChecks();
      expect(checks.graphql).toBe(true);
      expect(checks.nodeStore).toBe(true);
    });
  });

  describe('isReady', () => {
    it('should return false when no components are ready', () => {
      expect(isReady()).toBe(false);
    });

    it('should return false when only graphql is ready', () => {
      setReady('graphql', true);
      expect(isReady()).toBe(false);
    });

    it('should return false when only nodeStore is ready', () => {
      setReady('nodeStore', true);
      expect(isReady()).toBe(false);
    });

    it('should return true when all components are ready', () => {
      setReady('graphql', true);
      setReady('nodeStore', true);
      expect(isReady()).toBe(true);
    });

    it('should return false after resetting a ready component', () => {
      setReady('graphql', true);
      setReady('nodeStore', true);
      expect(isReady()).toBe(true);

      setReady('graphql', false);
      expect(isReady()).toBe(false);
    });
  });

  describe('getReadinessChecks', () => {
    it('should return a copy of the state', () => {
      const checks1 = getReadinessChecks();
      const checks2 = getReadinessChecks();

      expect(checks1).not.toBe(checks2);
      expect(checks1).toEqual(checks2);
    });

    it('should reflect current state', () => {
      setReady('graphql', true);
      const checks = getReadinessChecks();
      expect(checks.graphql).toBe(true);
      expect(checks.nodeStore).toBe(false);
    });

    it('should not be affected by mutations to returned object', () => {
      const checks = getReadinessChecks();
      checks.graphql = true;

      const freshChecks = getReadinessChecks();
      expect(freshChecks.graphql).toBe(false);
    });
  });

  describe('resetReadiness', () => {
    it('should reset all components to false', () => {
      setReady('graphql', true);
      setReady('nodeStore', true);

      resetReadiness();

      const checks = getReadinessChecks();
      expect(checks.graphql).toBe(false);
      expect(checks.nodeStore).toBe(false);
    });

    it('should make isReady return false', () => {
      setReady('graphql', true);
      setReady('nodeStore', true);
      expect(isReady()).toBe(true);

      resetReadiness();
      expect(isReady()).toBe(false);
    });
  });
});
