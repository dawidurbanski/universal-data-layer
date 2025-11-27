import type { Node } from './types.js';
import type { SchemaOption, InferSchema } from '@/schema-builder.js';
import type { z } from 'zod';

/**
 * Schema info stored for a node type
 */
export interface TypeSchemaInfo {
  /** Field overrides from InferSchema */
  overrides?: Record<string, z.ZodTypeAny>;
  /** Full Zod schema (if provided instead of InferSchema) */
  fullSchema?: z.ZodObject<z.ZodRawShape>;
}

/**
 * In-memory node storage using Map-based indexes
 * Provides O(1) lookups by ID and O(1) type bucket access
 *
 * @example
 * ```ts
 * const store = new NodeStore();
 *
 * // Add a node
 * store.set(myNode);
 *
 * // Get by ID
 * const node = store.get('node-123');
 *
 * // Get all nodes of a type
 * const products = store.getByType('Product');
 *
 * // Clear for testing
 * store.clear();
 * ```
 */
export class NodeStore {
  /** Primary index: node ID -> node */
  private nodes: Map<string, Node>;

  /** Secondary index: node type -> Set of node IDs */
  private typeIndex: Map<string, Set<string>>;

  /** Field indexes: nodeType -> fieldName -> fieldValue -> nodeId */
  private fieldIndexes: Map<string, Map<string, Map<unknown, string>>>;

  /** Registered indexes: nodeType -> Set of field names */
  private registeredIndexes: Map<string, Set<string>>;

  /** Schema info per type: nodeType -> TypeSchemaInfo */
  private typeSchemas: Map<string, TypeSchemaInfo>;

  constructor() {
    this.nodes = new Map();
    this.typeIndex = new Map();
    this.fieldIndexes = new Map();
    this.registeredIndexes = new Map();
    this.typeSchemas = new Map();
  }

  /**
   * Register a field to be indexed for a specific node type
   * @param nodeType - The node type to index (e.g., 'Product')
   * @param fieldName - The field name to index (e.g., 'slug')
   */
  registerIndex(nodeType: string, fieldName: string): void {
    if (!this.registeredIndexes.has(nodeType)) {
      this.registeredIndexes.set(nodeType, new Set());
    }
    this.registeredIndexes.get(nodeType)!.add(fieldName);

    // Initialize field index structure if needed
    if (!this.fieldIndexes.has(nodeType)) {
      this.fieldIndexes.set(nodeType, new Map());
    }
    if (!this.fieldIndexes.get(nodeType)!.has(fieldName)) {
      this.fieldIndexes.get(nodeType)!.set(fieldName, new Map());
    }

    // Index existing nodes of this type
    const existingNodes = this.getByType(nodeType);
    for (const node of existingNodes) {
      const fieldValue = (node as unknown as Record<string, unknown>)[
        fieldName
      ];
      if (fieldValue !== undefined && fieldValue !== null) {
        this.fieldIndexes
          .get(nodeType)!
          .get(fieldName)!
          .set(fieldValue, node.internal.id);
      }
    }
  }

  /**
   * Store or update a node
   * Maintains both primary ID index and secondary type index
   */
  set(node: Node): void {
    const nodeType = node.internal.type;
    const nodeId = node.internal.id;

    // Get existing node to clean up old field indexes
    const existingNode = this.nodes.get(nodeId);

    // Store in primary index
    this.nodes.set(nodeId, node);

    // Update type index
    if (!this.typeIndex.has(nodeType)) {
      this.typeIndex.set(nodeType, new Set());
    }
    this.typeIndex.get(nodeType)!.add(nodeId);

    // Update field indexes
    const registeredFields = this.registeredIndexes.get(nodeType);
    if (registeredFields) {
      for (const fieldName of registeredFields) {
        // Remove old field value from index if node existed
        if (existingNode) {
          const oldFieldValue = (
            existingNode as unknown as Record<string, unknown>
          )[fieldName];
          if (oldFieldValue !== undefined && oldFieldValue !== null) {
            this.fieldIndexes
              .get(nodeType)
              ?.get(fieldName)
              ?.delete(oldFieldValue);
          }
        }

        // Add new field value to index
        const newFieldValue = (node as unknown as Record<string, unknown>)[
          fieldName
        ];
        if (newFieldValue !== undefined && newFieldValue !== null) {
          this.fieldIndexes
            .get(nodeType)!
            .get(fieldName)!
            .set(newFieldValue, nodeId);
        }
      }
    }
  }

  /**
   * Get a node by ID
   * @returns The node or undefined if not found
   */
  get(id: string): Node | undefined {
    return this.nodes.get(id);
  }

  /**
   * Get a node by an indexed field value
   * @param nodeType - The node type to search
   * @param fieldName - The indexed field name
   * @param fieldValue - The field value to match
   * @returns The node or undefined if not found
   */
  getByField(
    nodeType: string,
    fieldName: string,
    fieldValue: unknown
  ): Node | undefined {
    const nodeId = this.fieldIndexes
      .get(nodeType)
      ?.get(fieldName)
      ?.get(fieldValue);
    return nodeId ? this.nodes.get(nodeId) : undefined;
  }

  /**
   * Get all registered index field names for a node type
   * @param nodeType - The node type
   * @returns Array of registered field names
   */
  getRegisteredIndexes(nodeType: string): string[] {
    return Array.from(this.registeredIndexes.get(nodeType) || []);
  }

  /**
   * Get all nodes of a specific type
   * @returns Array of nodes (empty array if type not found)
   */
  getByType(type: string): Node[] {
    const ids = this.typeIndex.get(type);
    if (!ids) {
      return [];
    }

    const result: Node[] = [];
    for (const id of ids) {
      const node = this.nodes.get(id);
      if (node) {
        result.push(node);
      }
    }
    return result;
  }

  /**
   * Get all nodes in the store
   * @returns Array of all nodes
   */
  getAll(): Node[] {
    return Array.from(this.nodes.values());
  }

  /**
   * Get all registered node types
   * @returns Array of type names
   */
  getTypes(): string[] {
    return Array.from(this.typeIndex.keys());
  }

  /**
   * Get count of nodes by type
   * @returns Number of nodes of the specified type
   */
  countByType(type: string): number {
    return this.typeIndex.get(type)?.size ?? 0;
  }

  /**
   * Delete a node by ID
   * Removes from both primary and type indexes
   * @returns true if node was deleted, false if it didn't exist
   */
  delete(id: string): boolean {
    const node = this.nodes.get(id);
    if (!node) {
      return false;
    }

    const nodeType = node.internal.type;

    // Remove from type index
    const typeSet = this.typeIndex.get(nodeType);
    if (typeSet) {
      typeSet.delete(id);
      // Clean up empty type sets
      if (typeSet.size === 0) {
        this.typeIndex.delete(nodeType);
      }
    }

    // Remove from field indexes
    const registeredFields = this.registeredIndexes.get(nodeType);
    if (registeredFields) {
      for (const fieldName of registeredFields) {
        const fieldValue = (node as unknown as Record<string, unknown>)[
          fieldName
        ];
        if (fieldValue !== undefined && fieldValue !== null) {
          this.fieldIndexes.get(nodeType)?.get(fieldName)?.delete(fieldValue);
        }
      }
    }

    // Remove from primary index
    this.nodes.delete(id);
    return true;
  }

  /**
   * Check if a node exists
   */
  has(id: string): boolean {
    return this.nodes.has(id);
  }

  /**
   * Get total number of nodes
   */
  size(): number {
    return this.nodes.size;
  }

  /**
   * Set schema info for a node type.
   * First schema for a type wins (subsequent calls are ignored).
   *
   * @param nodeType - The node type name
   * @param schema - SchemaOption (InferSchema or ZodObject)
   */
  setTypeSchema(nodeType: string, schema: SchemaOption): void {
    // First schema for a type wins
    if (this.typeSchemas.has(nodeType)) {
      return;
    }

    // Check if it's an InferSchema (has getOverrides method)
    if (
      schema &&
      typeof schema === 'object' &&
      'getOverrides' in schema &&
      typeof schema.getOverrides === 'function'
    ) {
      const inferSchema = schema as InferSchema;
      if (inferSchema.hasOverrides()) {
        this.typeSchemas.set(nodeType, {
          overrides: inferSchema.getOverrides(),
        });
      }
    } else if (schema && typeof schema === 'object' && '_def' in schema) {
      // It's a ZodObject (has _def property)
      this.typeSchemas.set(nodeType, {
        fullSchema: schema as z.ZodObject<z.ZodRawShape>,
      });
    }
  }

  /**
   * Get schema info for a node type.
   *
   * @param nodeType - The node type name
   * @returns TypeSchemaInfo or undefined if not set
   */
  getTypeSchema(nodeType: string): TypeSchemaInfo | undefined {
    return this.typeSchemas.get(nodeType);
  }

  /**
   * Check if a node type has schema info.
   *
   * @param nodeType - The node type name
   */
  hasTypeSchema(nodeType: string): boolean {
    return this.typeSchemas.has(nodeType);
  }

  /**
   * Clear all nodes (useful for testing)
   */
  clear(): void {
    this.nodes.clear();
    this.typeIndex.clear();
    this.fieldIndexes.clear();
    this.registeredIndexes.clear();
    this.typeSchemas.clear();
  }
}
