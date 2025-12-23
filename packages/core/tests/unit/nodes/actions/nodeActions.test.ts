import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createNodeActions } from '@/nodes/actions/nodeActions.js';
import type { NodeStore } from '@/nodes/store.js';
import type { DeletionLog } from '@/sync/index.js';
import type { Node } from '@/nodes/types.js';
import type { CreateNodeInput } from '@/nodes/actions/createNode.js';
import * as createNodeModule from '@/nodes/actions/createNode.js';
import * as deleteNodeModule from '@/nodes/actions/deleteNode.js';
import * as extendNodeModule from '@/nodes/actions/extendNode.js';
import * as queriesModule from '@/nodes/queries.js';

// Mock dependencies
vi.mock('@/nodes/actions/createNode.js', () => ({
  createNode: vi.fn(),
}));

vi.mock('@/nodes/actions/deleteNode.js', () => ({
  deleteNode: vi.fn(),
}));

vi.mock('@/nodes/actions/extendNode.js', () => ({
  extendNode: vi.fn(),
}));

vi.mock('@/nodes/queries.js', () => ({
  getNode: vi.fn(),
  getNodes: vi.fn(),
  getNodesByType: vi.fn(),
}));

describe('createNodeActions', () => {
  let mockStore: NodeStore;
  let mockDeletionLog: DeletionLog;

  beforeEach(() => {
    vi.clearAllMocks();
    mockStore = {} as NodeStore;
    mockDeletionLog = {
      add: vi.fn(),
      getDeletedSince: vi.fn(),
      clear: vi.fn(),
    } as unknown as DeletionLog;
  });

  describe('createNode', () => {
    it('delegates to createNode with store and owner', async () => {
      const mockNode = { id: 'test-1', internal: { type: 'TestType' } };
      vi.mocked(createNodeModule.createNode).mockResolvedValue(
        mockNode as never
      );

      const actions = createNodeActions({
        store: mockStore,
        owner: 'test-plugin',
      });

      const input: CreateNodeInput = {
        id: 'test-1',
        internal: { id: 'test-1', type: 'TestType', owner: 'test-plugin' },
      };
      const result = await actions.createNode(input);

      expect(createNodeModule.createNode).toHaveBeenCalledWith(input, {
        store: mockStore,
        owner: 'test-plugin',
      });
      expect(result).toBe(mockNode);
    });

    it('passes additional options to createNode', async () => {
      const mockNode = { id: 'test-1', internal: { type: 'TestType' } };
      vi.mocked(createNodeModule.createNode).mockResolvedValue(
        mockNode as never
      );

      const actions = createNodeActions({
        store: mockStore,
        owner: 'test-plugin',
      });

      const input: CreateNodeInput = {
        id: 'test-1',
        internal: { id: 'test-1', type: 'TestType', owner: 'test-plugin' },
      };
      const schema = { override: vi.fn() };
      await actions.createNode(input, { schema } as never);

      expect(createNodeModule.createNode).toHaveBeenCalledWith(input, {
        store: mockStore,
        owner: 'test-plugin',
        schema,
      });
    });
  });

  describe('deleteNode', () => {
    it('delegates to deleteNode with store only when no deletionLog', async () => {
      vi.mocked(deleteNodeModule.deleteNode).mockResolvedValue(true);

      const actions = createNodeActions({
        store: mockStore,
        owner: 'test-plugin',
      });

      const result = await actions.deleteNode('test-1');

      expect(deleteNodeModule.deleteNode).toHaveBeenCalledWith('test-1', {
        store: mockStore,
      });
      expect(result).toBe(true);
    });

    it('includes deletionLog when provided', async () => {
      vi.mocked(deleteNodeModule.deleteNode).mockResolvedValue(true);

      const actions = createNodeActions({
        store: mockStore,
        owner: 'test-plugin',
        deletionLog: mockDeletionLog,
      });

      await actions.deleteNode('test-1');

      expect(deleteNodeModule.deleteNode).toHaveBeenCalledWith('test-1', {
        store: mockStore,
        deletionLog: mockDeletionLog,
      });
    });

    it('passes additional options to deleteNode', async () => {
      vi.mocked(deleteNodeModule.deleteNode).mockResolvedValue(false);

      const actions = createNodeActions({
        store: mockStore,
        owner: 'test-plugin',
        deletionLog: mockDeletionLog,
      });

      const result = await actions.deleteNode('test-1', { cascade: true });

      expect(deleteNodeModule.deleteNode).toHaveBeenCalledWith('test-1', {
        store: mockStore,
        deletionLog: mockDeletionLog,
        cascade: true,
      });
      expect(result).toBe(false);
    });
  });

  describe('extendNode', () => {
    it('delegates to extendNode with store', async () => {
      const mockNode = {
        id: 'test-1',
        internal: { type: 'TestType' },
        extra: 'data',
      };
      vi.mocked(extendNodeModule.extendNode).mockResolvedValue(
        mockNode as never
      );

      const actions = createNodeActions({
        store: mockStore,
        owner: 'test-plugin',
      });

      const data = { extra: 'data' };
      const result = await actions.extendNode('test-1', data);

      expect(extendNodeModule.extendNode).toHaveBeenCalledWith('test-1', data, {
        store: mockStore,
      });
      expect(result).toBe(mockNode);
    });

    it('passes additional options to extendNode', async () => {
      const mockNode = { id: 'test-1', internal: { type: 'TestType' } };
      vi.mocked(extendNodeModule.extendNode).mockResolvedValue(
        mockNode as never
      );

      const actions = createNodeActions({
        store: mockStore,
        owner: 'test-plugin',
      });

      const data = { extra: 'data' };
      await actions.extendNode('test-1', data, { schema: {} } as never);

      expect(extendNodeModule.extendNode).toHaveBeenCalledWith('test-1', data, {
        store: mockStore,
        schema: {},
      });
    });
  });

  describe('getNode', () => {
    it('delegates to getNode with store', () => {
      const mockNode = { id: 'test-1', internal: { type: 'TestType' } };
      vi.mocked(queriesModule.getNode).mockReturnValue(mockNode as never);

      const actions = createNodeActions({
        store: mockStore,
        owner: 'test-plugin',
      });

      const result = actions.getNode('test-1');

      expect(queriesModule.getNode).toHaveBeenCalledWith('test-1', mockStore);
      expect(result).toBe(mockNode);
    });

    it('returns undefined when node not found', () => {
      vi.mocked(queriesModule.getNode).mockReturnValue(undefined);

      const actions = createNodeActions({
        store: mockStore,
        owner: 'test-plugin',
      });

      const result = actions.getNode('non-existent');

      expect(result).toBeUndefined();
    });
  });

  describe('getNodes', () => {
    it('delegates to getNodes with store', () => {
      const mockNodes = [
        { id: 'test-1', internal: { type: 'TestType' } },
        { id: 'test-2', internal: { type: 'TestType' } },
      ];
      vi.mocked(queriesModule.getNodes).mockReturnValue(mockNodes as never);

      const actions = createNodeActions({
        store: mockStore,
        owner: 'test-plugin',
      });

      const result = actions.getNodes();

      expect(queriesModule.getNodes).toHaveBeenCalledWith(mockStore, undefined);
      expect(result).toBe(mockNodes);
    });

    it('passes predicate to getNodes', () => {
      const mockNodes = [{ id: 'test-1', internal: { type: 'TestType' } }];
      vi.mocked(queriesModule.getNodes).mockReturnValue(mockNodes as never);

      const actions = createNodeActions({
        store: mockStore,
        owner: 'test-plugin',
      });

      const predicate = (node: Node) => node.internal.id === 'test-1';
      const result = actions.getNodes(predicate);

      expect(queriesModule.getNodes).toHaveBeenCalledWith(mockStore, predicate);
      expect(result).toBe(mockNodes);
    });
  });

  describe('getNodesByType', () => {
    it('delegates to getNodesByType with store', () => {
      const mockNodes = [{ id: 'test-1', internal: { type: 'TestType' } }];
      vi.mocked(queriesModule.getNodesByType).mockReturnValue(
        mockNodes as never
      );

      const actions = createNodeActions({
        store: mockStore,
        owner: 'test-plugin',
      });

      const result = actions.getNodesByType('TestType');

      expect(queriesModule.getNodesByType).toHaveBeenCalledWith(
        'TestType',
        mockStore,
        undefined
      );
      expect(result).toBe(mockNodes);
    });

    it('passes predicate to getNodesByType', () => {
      const mockNodes = [{ id: 'test-1', internal: { type: 'TestType' } }];
      vi.mocked(queriesModule.getNodesByType).mockReturnValue(
        mockNodes as never
      );

      const actions = createNodeActions({
        store: mockStore,
        owner: 'test-plugin',
      });

      const predicate = (node: Node) => node.internal.id === 'test-1';
      const result = actions.getNodesByType('TestType', predicate);

      expect(queriesModule.getNodesByType).toHaveBeenCalledWith(
        'TestType',
        mockStore,
        predicate
      );
      expect(result).toBe(mockNodes);
    });
  });
});
