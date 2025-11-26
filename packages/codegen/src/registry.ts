/**
 * Schema Registry - Central store for content type definitions
 *
 * The registry collects content type definitions from various sources:
 * - Plugin `registerTypes` hooks
 * - Node store inference
 * - GraphQL introspection
 * - REST API response inference
 *
 * It provides utilities for managing, merging, and extending type definitions.
 */

import type { ContentTypeDefinition, FieldDefinition } from '@/types/schema.js';

/**
 * Context provided to plugin registerTypes hooks
 */
export interface RegisterTypesContext {
  /**
   * Register a new content type definition.
   * If a type with the same name exists, it will be replaced.
   */
  registerType(def: ContentTypeDefinition): void;

  /**
   * Extend an existing content type with additional fields.
   * Fields with the same name will be overwritten.
   * Throws if the type doesn't exist.
   */
  extendType(typeName: string, fields: FieldDefinition[]): void;

  /**
   * Get a registered content type definition by name.
   */
  getType(name: string): ContentTypeDefinition | undefined;

  /**
   * Get all registered content type definitions.
   */
  getAllTypes(): ContentTypeDefinition[];

  /**
   * Plugin-specific options passed from configuration.
   */
  options: Record<string, unknown> | undefined;
}

/**
 * Central registry for managing content type definitions.
 *
 * @example
 * ```ts
 * const registry = new SchemaRegistry();
 *
 * // Register a type
 * registry.register({
 *   name: 'Product',
 *   fields: [
 *     { name: 'name', type: 'string', required: true },
 *     { name: 'price', type: 'number', required: true },
 *   ],
 *   indexes: ['slug'],
 * });
 *
 * // Extend a type
 * registry.extend('Product', [
 *   { name: 'category', type: 'string', required: false },
 * ]);
 *
 * // Get all types for code generation
 * const types = registry.getAll();
 * ```
 */
export class SchemaRegistry {
  private contentTypes: Map<string, ContentTypeDefinition>;

  constructor() {
    this.contentTypes = new Map();
  }

  /**
   * Register a content type definition.
   * If a type with the same name exists, it will be replaced.
   */
  register(def: ContentTypeDefinition): void {
    this.contentTypes.set(def.name, { ...def });
  }

  /**
   * Register multiple content type definitions at once.
   */
  registerAll(defs: ContentTypeDefinition[]): void {
    for (const def of defs) {
      this.register(def);
    }
  }

  /**
   * Extend an existing content type with additional fields.
   * Fields with the same name will be overwritten by the new definition.
   *
   * @throws Error if the type doesn't exist
   */
  extend(typeName: string, fields: FieldDefinition[]): void {
    const existing = this.contentTypes.get(typeName);
    if (!existing) {
      throw new Error(
        `Cannot extend type '${typeName}': type not found in registry`
      );
    }

    // Create a map of existing fields for easy lookup
    const fieldMap = new Map<string, FieldDefinition>();
    for (const field of existing.fields) {
      fieldMap.set(field.name, field);
    }

    // Add/override with new fields
    for (const field of fields) {
      fieldMap.set(field.name, field);
    }

    // Update the content type with merged fields
    this.contentTypes.set(typeName, {
      ...existing,
      fields: Array.from(fieldMap.values()),
    });
  }

  /**
   * Add indexes to an existing content type.
   *
   * @throws Error if the type doesn't exist
   */
  addIndexes(typeName: string, indexes: string[]): void {
    const existing = this.contentTypes.get(typeName);
    if (!existing) {
      throw new Error(
        `Cannot add indexes to type '${typeName}': type not found in registry`
      );
    }

    const existingIndexes = new Set(existing.indexes || []);
    for (const index of indexes) {
      existingIndexes.add(index);
    }

    this.contentTypes.set(typeName, {
      ...existing,
      indexes: Array.from(existingIndexes),
    });
  }

  /**
   * Get a content type definition by name.
   */
  get(name: string): ContentTypeDefinition | undefined {
    return this.contentTypes.get(name);
  }

  /**
   * Check if a content type is registered.
   */
  has(name: string): boolean {
    return this.contentTypes.has(name);
  }

  /**
   * Get all registered content type definitions.
   */
  getAll(): ContentTypeDefinition[] {
    return Array.from(this.contentTypes.values());
  }

  /**
   * Get all registered content type names.
   */
  getNames(): string[] {
    return Array.from(this.contentTypes.keys());
  }

  /**
   * Get the number of registered content types.
   */
  size(): number {
    return this.contentTypes.size;
  }

  /**
   * Remove a content type from the registry.
   */
  remove(name: string): boolean {
    return this.contentTypes.delete(name);
  }

  /**
   * Clear all registered content types.
   */
  clear(): void {
    this.contentTypes.clear();
  }

  /**
   * Create a RegisterTypesContext for use in plugin hooks.
   */
  createContext(options?: Record<string, unknown>): RegisterTypesContext {
    return {
      registerType: (def) => this.register(def),
      extendType: (typeName, fields) => this.extend(typeName, fields),
      getType: (name) => this.get(name),
      getAllTypes: () => this.getAll(),
      options,
    };
  }

  /**
   * Merge another registry into this one.
   * Types from the other registry will overwrite types with the same name.
   */
  merge(other: SchemaRegistry): void {
    for (const def of other.getAll()) {
      this.register(def);
    }
  }

  /**
   * Create a new registry by merging multiple registries.
   * Later registries take precedence for types with the same name.
   */
  static merge(...registries: SchemaRegistry[]): SchemaRegistry {
    const merged = new SchemaRegistry();
    for (const registry of registries) {
      merged.merge(registry);
    }
    return merged;
  }
}

/**
 * Default global registry instance.
 * Can be used for simple cases where a single registry is sufficient.
 */
export const defaultRegistry = new SchemaRegistry();
