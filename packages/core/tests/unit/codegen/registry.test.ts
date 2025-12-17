import { describe, it, expect, beforeEach } from 'vitest';
import { SchemaRegistry, defaultRegistry } from '@/codegen/registry.js';
import type {
  ContentTypeDefinition,
  FieldDefinition,
} from '@/codegen/types/schema.js';

describe('SchemaRegistry', () => {
  let registry: SchemaRegistry;

  beforeEach(() => {
    registry = new SchemaRegistry();
  });

  describe('register', () => {
    it('should register a new content type', () => {
      const def: ContentTypeDefinition = {
        name: 'Product',
        fields: [{ name: 'title', type: 'string', required: true }],
      };

      registry.register(def);

      expect(registry.get('Product')).toEqual(def);
    });

    it('should replace an existing content type with the same name', () => {
      const original: ContentTypeDefinition = {
        name: 'Product',
        fields: [{ name: 'title', type: 'string', required: true }],
      };
      const replacement: ContentTypeDefinition = {
        name: 'Product',
        fields: [{ name: 'name', type: 'string', required: false }],
      };

      registry.register(original);
      registry.register(replacement);

      expect(registry.get('Product')).toEqual(replacement);
      expect(registry.size()).toBe(1);
    });

    it('should create a copy of the definition', () => {
      const def: ContentTypeDefinition = {
        name: 'Product',
        fields: [{ name: 'title', type: 'string', required: true }],
      };

      registry.register(def);
      def.name = 'Modified';

      expect(registry.get('Product')?.name).toBe('Product');
    });
  });

  describe('registerAll', () => {
    it('should register multiple content types at once', () => {
      const defs: ContentTypeDefinition[] = [
        {
          name: 'Product',
          fields: [{ name: 'title', type: 'string', required: true }],
        },
        {
          name: 'Category',
          fields: [{ name: 'name', type: 'string', required: true }],
        },
      ];

      registry.registerAll(defs);

      expect(registry.size()).toBe(2);
      expect(registry.has('Product')).toBe(true);
      expect(registry.has('Category')).toBe(true);
    });

    it('should handle empty array', () => {
      registry.registerAll([]);
      expect(registry.size()).toBe(0);
    });
  });

  describe('extend', () => {
    it('should add new fields to an existing type', () => {
      registry.register({
        name: 'Product',
        fields: [{ name: 'title', type: 'string', required: true }],
      });

      const newFields: FieldDefinition[] = [
        { name: 'price', type: 'number', required: true },
      ];

      registry.extend('Product', newFields);

      const result = registry.get('Product');
      expect(result?.fields).toHaveLength(2);
      expect(result?.fields.find((f) => f.name === 'title')).toBeDefined();
      expect(result?.fields.find((f) => f.name === 'price')).toBeDefined();
    });

    it('should overwrite existing fields with the same name', () => {
      registry.register({
        name: 'Product',
        fields: [{ name: 'title', type: 'string', required: true }],
      });

      const newFields: FieldDefinition[] = [
        {
          name: 'title',
          type: 'string',
          required: false,
          description: 'Updated',
        },
      ];

      registry.extend('Product', newFields);

      const result = registry.get('Product');
      expect(result?.fields).toHaveLength(1);
      expect(result?.fields[0]?.required).toBe(false);
      expect(result?.fields[0]?.description).toBe('Updated');
    });

    it('should throw error when extending non-existent type', () => {
      expect(() => {
        registry.extend('NonExistent', [
          { name: 'field', type: 'string', required: true },
        ]);
      }).toThrow(
        "Cannot extend type 'NonExistent': type not found in registry"
      );
    });

    it('should preserve other properties when extending', () => {
      registry.register({
        name: 'Product',
        description: 'A product type',
        fields: [{ name: 'title', type: 'string', required: true }],
        indexes: ['slug'],
        owner: 'test-plugin',
      });

      registry.extend('Product', [
        { name: 'price', type: 'number', required: true },
      ]);

      const result = registry.get('Product');
      expect(result?.description).toBe('A product type');
      expect(result?.indexes).toEqual(['slug']);
      expect(result?.owner).toBe('test-plugin');
    });
  });

  describe('addIndexes', () => {
    it('should add indexes to an existing type', () => {
      registry.register({
        name: 'Product',
        fields: [{ name: 'title', type: 'string', required: true }],
      });

      registry.addIndexes('Product', ['slug', 'sku']);

      const result = registry.get('Product');
      expect(result?.indexes).toEqual(['slug', 'sku']);
    });

    it('should merge with existing indexes', () => {
      registry.register({
        name: 'Product',
        fields: [{ name: 'title', type: 'string', required: true }],
        indexes: ['slug'],
      });

      registry.addIndexes('Product', ['sku', 'slug']);

      const result = registry.get('Product');
      expect(result?.indexes).toContain('slug');
      expect(result?.indexes).toContain('sku');
      expect(result?.indexes).toHaveLength(2);
    });

    it('should handle type with no existing indexes', () => {
      registry.register({
        name: 'Product',
        fields: [{ name: 'title', type: 'string', required: true }],
      });

      registry.addIndexes('Product', ['slug']);

      const result = registry.get('Product');
      expect(result?.indexes).toEqual(['slug']);
    });

    it('should throw error when adding indexes to non-existent type', () => {
      expect(() => {
        registry.addIndexes('NonExistent', ['slug']);
      }).toThrow(
        "Cannot add indexes to type 'NonExistent': type not found in registry"
      );
    });
  });

  describe('get', () => {
    it('should return undefined for non-existent type', () => {
      expect(registry.get('NonExistent')).toBeUndefined();
    });

    it('should return the content type definition', () => {
      const def: ContentTypeDefinition = {
        name: 'Product',
        fields: [{ name: 'title', type: 'string', required: true }],
      };
      registry.register(def);

      expect(registry.get('Product')).toEqual(def);
    });
  });

  describe('has', () => {
    it('should return false for non-existent type', () => {
      expect(registry.has('NonExistent')).toBe(false);
    });

    it('should return true for registered type', () => {
      registry.register({
        name: 'Product',
        fields: [],
      });

      expect(registry.has('Product')).toBe(true);
    });
  });

  describe('getAll', () => {
    it('should return empty array when registry is empty', () => {
      expect(registry.getAll()).toEqual([]);
    });

    it('should return all registered content types', () => {
      registry.register({ name: 'Product', fields: [] });
      registry.register({ name: 'Category', fields: [] });

      const all = registry.getAll();
      expect(all).toHaveLength(2);
      expect(all.map((t) => t.name)).toContain('Product');
      expect(all.map((t) => t.name)).toContain('Category');
    });
  });

  describe('getNames', () => {
    it('should return empty array when registry is empty', () => {
      expect(registry.getNames()).toEqual([]);
    });

    it('should return all registered type names', () => {
      registry.register({ name: 'Product', fields: [] });
      registry.register({ name: 'Category', fields: [] });

      const names = registry.getNames();
      expect(names).toHaveLength(2);
      expect(names).toContain('Product');
      expect(names).toContain('Category');
    });
  });

  describe('size', () => {
    it('should return 0 for empty registry', () => {
      expect(registry.size()).toBe(0);
    });

    it('should return the number of registered types', () => {
      registry.register({ name: 'Product', fields: [] });
      registry.register({ name: 'Category', fields: [] });

      expect(registry.size()).toBe(2);
    });
  });

  describe('remove', () => {
    it('should return false when removing non-existent type', () => {
      expect(registry.remove('NonExistent')).toBe(false);
    });

    it('should remove a registered type and return true', () => {
      registry.register({ name: 'Product', fields: [] });

      expect(registry.remove('Product')).toBe(true);
      expect(registry.has('Product')).toBe(false);
    });
  });

  describe('clear', () => {
    it('should remove all registered types', () => {
      registry.register({ name: 'Product', fields: [] });
      registry.register({ name: 'Category', fields: [] });

      registry.clear();

      expect(registry.size()).toBe(0);
      expect(registry.getAll()).toEqual([]);
    });

    it('should handle clearing an empty registry', () => {
      registry.clear();
      expect(registry.size()).toBe(0);
    });
  });

  describe('createContext', () => {
    it('should create a context with registerType function', () => {
      const context = registry.createContext();

      context.registerType({ name: 'Product', fields: [] });

      expect(registry.has('Product')).toBe(true);
    });

    it('should create a context with extendType function', () => {
      registry.register({ name: 'Product', fields: [] });
      const context = registry.createContext();

      context.extendType('Product', [
        { name: 'price', type: 'number', required: true },
      ]);

      expect(registry.get('Product')?.fields).toHaveLength(1);
    });

    it('should create a context with getType function', () => {
      registry.register({ name: 'Product', fields: [] });
      const context = registry.createContext();

      expect(context.getType('Product')).toBeDefined();
      expect(context.getType('NonExistent')).toBeUndefined();
    });

    it('should create a context with getAllTypes function', () => {
      registry.register({ name: 'Product', fields: [] });
      registry.register({ name: 'Category', fields: [] });
      const context = registry.createContext();

      expect(context.getAllTypes()).toHaveLength(2);
    });

    it('should include options when provided', () => {
      const options = { apiKey: 'secret', environment: 'test' };
      const context = registry.createContext(options);

      expect(context.options).toEqual(options);
    });

    it('should have undefined options when not provided', () => {
      const context = registry.createContext();

      expect(context.options).toBeUndefined();
    });
  });

  describe('merge (instance method)', () => {
    it('should merge another registry into this one', () => {
      registry.register({ name: 'Product', fields: [] });

      const other = new SchemaRegistry();
      other.register({ name: 'Category', fields: [] });

      registry.merge(other);

      expect(registry.size()).toBe(2);
      expect(registry.has('Product')).toBe(true);
      expect(registry.has('Category')).toBe(true);
    });

    it('should overwrite types with the same name', () => {
      registry.register({
        name: 'Product',
        fields: [{ name: 'title', type: 'string', required: true }],
      });

      const other = new SchemaRegistry();
      other.register({
        name: 'Product',
        fields: [{ name: 'name', type: 'string', required: false }],
      });

      registry.merge(other);

      expect(registry.size()).toBe(1);
      expect(registry.get('Product')?.fields[0]?.name).toBe('name');
    });

    it('should handle merging an empty registry', () => {
      registry.register({ name: 'Product', fields: [] });

      const other = new SchemaRegistry();
      registry.merge(other);

      expect(registry.size()).toBe(1);
    });
  });

  describe('SchemaRegistry.merge (static method)', () => {
    it('should create a new registry by merging multiple registries', () => {
      const reg1 = new SchemaRegistry();
      reg1.register({ name: 'Product', fields: [] });

      const reg2 = new SchemaRegistry();
      reg2.register({ name: 'Category', fields: [] });

      const reg3 = new SchemaRegistry();
      reg3.register({ name: 'Tag', fields: [] });

      const merged = SchemaRegistry.merge(reg1, reg2, reg3);

      expect(merged.size()).toBe(3);
      expect(merged.has('Product')).toBe(true);
      expect(merged.has('Category')).toBe(true);
      expect(merged.has('Tag')).toBe(true);
    });

    it('should give precedence to later registries for same-named types', () => {
      const reg1 = new SchemaRegistry();
      reg1.register({
        name: 'Product',
        fields: [{ name: 'v1', type: 'string', required: true }],
      });

      const reg2 = new SchemaRegistry();
      reg2.register({
        name: 'Product',
        fields: [{ name: 'v2', type: 'string', required: true }],
      });

      const merged = SchemaRegistry.merge(reg1, reg2);

      expect(merged.get('Product')?.fields[0]?.name).toBe('v2');
    });

    it('should return empty registry when no registries provided', () => {
      const merged = SchemaRegistry.merge();
      expect(merged.size()).toBe(0);
    });

    it('should not modify the original registries', () => {
      const reg1 = new SchemaRegistry();
      reg1.register({ name: 'Product', fields: [] });

      const reg2 = new SchemaRegistry();
      reg2.register({ name: 'Category', fields: [] });

      const merged = SchemaRegistry.merge(reg1, reg2);
      merged.register({ name: 'NewType', fields: [] });

      expect(reg1.has('NewType')).toBe(false);
      expect(reg2.has('NewType')).toBe(false);
    });
  });

  describe('defaultRegistry', () => {
    it('should be an instance of SchemaRegistry', () => {
      expect(defaultRegistry).toBeInstanceOf(SchemaRegistry);
    });
  });
});
