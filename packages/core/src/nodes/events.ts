import { EventEmitter } from 'node:events';
import type { Node } from './types.js';

/**
 * Event types emitted when nodes change.
 */
export type NodeChangeEventType =
  | 'node:created'
  | 'node:updated'
  | 'node:deleted';

/**
 * Event payload for node change events.
 */
export interface NodeChangeEvent {
  /** Type of change that occurred */
  type: NodeChangeEventType;
  /** ID of the affected node (internal.id) */
  nodeId: string;
  /** Type of the affected node (internal.type) */
  nodeType: string;
  /** Full node data. Null for deleted events. */
  node: Node | null;
  /** ISO 8601 timestamp of when the event occurred */
  timestamp: string;
}

/**
 * Typed event emitter for node changes.
 */
export interface NodeEventEmitter {
  on(
    event: NodeChangeEventType,
    listener: (data: NodeChangeEvent) => void
  ): this;
  off(
    event: NodeChangeEventType,
    listener: (data: NodeChangeEvent) => void
  ): this;
  once(
    event: NodeChangeEventType,
    listener: (data: NodeChangeEvent) => void
  ): this;
  emit(event: NodeChangeEventType, data: NodeChangeEvent): boolean;
  removeAllListeners(event?: NodeChangeEventType): this;
}

/**
 * Internal event emitter instance.
 */
const emitter = new EventEmitter() as NodeEventEmitter;

/**
 * Singleton event emitter for node changes.
 * Subscribe to node:created, node:updated, node:deleted events.
 *
 * @example
 * ```typescript
 * import { nodeEvents } from 'universal-data-layer';
 *
 * nodeEvents.on('node:created', (event) => {
 *   console.log(`Node created: ${event.nodeId}`);
 * });
 * ```
 */
export const nodeEvents: NodeEventEmitter = emitter;

/**
 * Emit a node change event.
 * Called internally by node actions (createNode, deleteNode, extendNode).
 *
 * @internal
 */
export function emitNodeChange(event: NodeChangeEvent): void {
  emitter.emit(event.type, event);
}
