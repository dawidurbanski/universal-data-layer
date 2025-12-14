import { describe, it, expect, beforeEach } from 'vitest';
import { ReferenceRegistry, createRegistry } from '@/references/index.js';
import type {
  ReferenceResolverConfig,
  EntityKeyConfig,
  NodeStoreLike,
} from '@/references/types.js';
import type { Node } from '@/nodes/types.js';

// Mock node store for testing
function createMockStore(nodes: Node[] = []): NodeStoreLike {
  const nodesByType = new Map<string, Node[]>();

  for (const node of nodes) {
    const type = node.internal.type;
    if (!nodesByType.has(type)) {
      nodesByType.set(type, []);
    }
    nodesByType.get(type)!.push(node);
  }

  return {
    getTypes: () => Array.from(nodesByType.keys()),
    getByField: (type: string, field: string, value: unknown) => {
      const typeNodes = nodesByType.get(type) || [];
      return typeNodes.find(
        (node) => (node as unknown as Record<string, unknown>)[field] === value
      );
    },
  };
}

// Sample reference format (like Contentful)
interface TestReference {
  _testRef: true;
  testId: string;
  possibleTypes?: string[];
}

function isTestReference(value: unknown): value is TestReference {
  return (
    typeof value === 'object' &&
    value !== null &&
    '_testRef' in value &&
    (value as TestReference)._testRef === true
  );
}

const testResolverConfig: ReferenceResolverConfig = {
  id: 'test-plugin',
  markerField: '_testRef',
  lookupField: 'testId',
  isReference: isTestReference,
  getLookupValue: (ref) => (ref as TestReference).testId,
  getPossibleTypes: (ref) => (ref as TestReference).possibleTypes ?? [],
  priority: 10,
};

describe('ReferenceRegistry', () => {
  let registry: ReferenceRegistry;

  beforeEach(() => {
    registry = createRegistry();
  });

  describe('registerResolver', () => {
    it('should register a resolver', () => {
      registry.registerResolver(testResolverConfig);

      const resolver = registry.getResolver('test-plugin');
      expect(resolver).toBeDefined();
      expect(resolver?.id).toBe('test-plugin');
    });

    it('should throw if registering duplicate ID', () => {
      registry.registerResolver(testResolverConfig);

      expect(() => {
        registry.registerResolver(testResolverConfig);
      }).toThrow('already registered');
    });

    it('should sort resolvers by priority', () => {
      const lowPriority: ReferenceResolverConfig = {
        ...testResolverConfig,
        id: 'low-priority',
        priority: 1,
      };
      const highPriority: ReferenceResolverConfig = {
        ...testResolverConfig,
        id: 'high-priority',
        priority: 100,
      };

      registry.registerResolver(lowPriority);
      registry.registerResolver(highPriority);

      const resolvers = registry.getResolvers();
      expect(resolvers[0]?.id).toBe('high-priority');
      expect(resolvers[1]?.id).toBe('low-priority');
    });
  });

  describe('unregisterResolver', () => {
    it('should unregister a resolver', () => {
      registry.registerResolver(testResolverConfig);
      registry.unregisterResolver('test-plugin');

      expect(registry.getResolver('test-plugin')).toBeUndefined();
    });
  });

  describe('isReference', () => {
    beforeEach(() => {
      registry.registerResolver(testResolverConfig);
    });

    it('should return true for registered reference type', () => {
      const ref: TestReference = { _testRef: true, testId: 'abc123' };
      expect(registry.isReference(ref)).toBe(true);
    });

    it('should return false for non-reference objects', () => {
      expect(registry.isReference({ foo: 'bar' })).toBe(false);
      expect(registry.isReference(null)).toBe(false);
      expect(registry.isReference('string')).toBe(false);
      expect(registry.isReference(123)).toBe(false);
    });

    it('should return false when no resolvers registered', () => {
      const emptyRegistry = createRegistry();
      const ref: TestReference = { _testRef: true, testId: 'abc123' };
      expect(emptyRegistry.isReference(ref)).toBe(false);
    });
  });

  describe('identifyReference', () => {
    beforeEach(() => {
      registry.registerResolver(testResolverConfig);
    });

    it('should return the matching resolver config', () => {
      const ref: TestReference = { _testRef: true, testId: 'abc123' };
      const resolver = registry.identifyReference(ref);

      expect(resolver).not.toBeNull();
      expect(resolver?.id).toBe('test-plugin');
    });

    it('should return null for non-reference', () => {
      expect(registry.identifyReference({ foo: 'bar' })).toBeNull();
    });
  });

  describe('isReferenceArray', () => {
    beforeEach(() => {
      registry.registerResolver(testResolverConfig);
    });

    it('should return true for array of references', () => {
      const refs: TestReference[] = [
        { _testRef: true, testId: 'abc' },
        { _testRef: true, testId: 'def' },
      ];
      expect(registry.isReferenceArray(refs)).toBe(true);
    });

    it('should return false for empty array', () => {
      expect(registry.isReferenceArray([])).toBe(false);
    });

    it('should return false for array of non-references', () => {
      expect(registry.isReferenceArray([{ foo: 'bar' }])).toBe(false);
    });

    it('should return false for non-array', () => {
      expect(registry.isReferenceArray('string')).toBe(false);
    });
  });

  describe('getPossibleTypes', () => {
    beforeEach(() => {
      registry.registerResolver(testResolverConfig);
    });

    it('should return possible types from reference', () => {
      const ref: TestReference = {
        _testRef: true,
        testId: 'abc123',
        possibleTypes: ['TypeA', 'TypeB'],
      };
      expect(registry.getPossibleTypes(ref)).toEqual(['TypeA', 'TypeB']);
    });

    it('should return empty array for reference without possible types', () => {
      const ref: TestReference = { _testRef: true, testId: 'abc123' };
      expect(registry.getPossibleTypes(ref)).toEqual([]);
    });

    it('should return empty array for non-reference', () => {
      expect(registry.getPossibleTypes({ foo: 'bar' })).toEqual([]);
    });
  });

  describe('resolveReference', () => {
    const testNode = {
      internal: {
        id: 'node-1',
        type: 'TestType',
        owner: 'test-plugin',
        contentDigest: 'abc123',
        createdAt: Date.now(),
        modifiedAt: Date.now(),
      },
      testId: 'ref-id-1',
      name: 'Test Node',
    } as Node & { testId: string; name: string };

    beforeEach(() => {
      registry.registerResolver(testResolverConfig);
      registry.setStore(createMockStore([testNode]));
    });

    it('should resolve reference to node', () => {
      const ref: TestReference = {
        _testRef: true,
        testId: 'ref-id-1',
        possibleTypes: ['TestType'],
      };

      const resolved = registry.resolveReference(ref);
      expect(resolved).not.toBeNull();
      expect(resolved?.internal.id).toBe('node-1');
      expect((resolved as Node & { name: string }).name).toBe('Test Node');
    });

    it('should return null for non-existent reference', () => {
      const ref: TestReference = {
        _testRef: true,
        testId: 'non-existent',
        possibleTypes: ['TestType'],
      };

      expect(registry.resolveReference(ref)).toBeNull();
    });

    it('should return null for non-reference', () => {
      expect(registry.resolveReference({ foo: 'bar' })).toBeNull();
    });

    it('should return null when exceeding max depth', () => {
      const ref: TestReference = {
        _testRef: true,
        testId: 'ref-id-1',
        possibleTypes: ['TestType'],
      };

      const resolved = registry.resolveReference(ref, {
        resolutionDepth: 10,
        maxDepth: 5,
      });
      expect(resolved).toBeNull();
    });

    it('should warn when no store is set', () => {
      const noStoreRegistry = createRegistry();
      noStoreRegistry.registerResolver(testResolverConfig);

      const ref: TestReference = { _testRef: true, testId: 'ref-id-1' };
      expect(noStoreRegistry.resolveReference(ref)).toBeNull();
    });
  });

  describe('entity key config', () => {
    const entityKeyConfig: EntityKeyConfig = {
      idField: 'testId',
      priority: 10,
    };

    beforeEach(() => {
      registry.registerEntityKeyConfig('test-plugin', entityKeyConfig);
    });

    it('should extract entity key from object', () => {
      const obj = {
        __typename: 'TestType',
        testId: 'abc123',
        name: 'Test',
      };

      expect(registry.getEntityKey(obj)).toBe('TestType:abc123');
    });

    it('should use internal.type as fallback', () => {
      const obj = {
        internal: { type: 'TestType' },
        testId: 'abc123',
      };

      expect(registry.getEntityKey(obj)).toBe('TestType:abc123');
    });

    it('should return null when no type available', () => {
      const obj = { testId: 'abc123' };
      expect(registry.getEntityKey(obj)).toBeNull();
    });

    it('should return null when no id available', () => {
      const obj = { __typename: 'TestType' };
      expect(registry.getEntityKey(obj)).toBeNull();
    });

    it('should return null for non-objects', () => {
      expect(registry.getEntityKey(null)).toBeNull();
      expect(registry.getEntityKey('string')).toBeNull();
    });

    it('should use higher priority config first', () => {
      const lowPriorityConfig: EntityKeyConfig = {
        idField: 'lowPriorityId',
        priority: 1,
      };
      registry.registerEntityKeyConfig('other-plugin', lowPriorityConfig);

      const obj = {
        __typename: 'TestType',
        testId: 'high-priority-value',
        lowPriorityId: 'low-priority-value',
      };

      // Should use testId (priority 10) over lowPriorityId (priority 1)
      expect(registry.getEntityKey(obj)).toBe('TestType:high-priority-value');
    });
  });

  describe('clear', () => {
    it('should clear all registrations', () => {
      registry.registerResolver(testResolverConfig);
      registry.registerEntityKeyConfig('test', { idField: 'testId' });

      registry.clear();

      expect(registry.getResolvers()).toHaveLength(0);
      expect(registry.getResolver('test-plugin')).toBeUndefined();
    });
  });
});
