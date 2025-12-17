import { describe, it, expect } from 'vitest';
import {
  inferSchemaFromResponse,
  mergeResponseInferences,
  inferSchemaFromJsonString,
} from '@/codegen/inference/from-response.js';

describe('inferSchemaFromResponse', () => {
  it('should infer schema from a simple object', () => {
    const response = {
      id: '123',
      name: 'Widget',
      price: 29.99,
      inStock: true,
    };

    const schema = inferSchemaFromResponse(response, 'Product');

    expect(schema.name).toBe('Product');
    expect(schema.fields).toHaveLength(4);

    const idField = schema.fields.find((f) => f.name === 'id');
    expect(idField?.type).toBe('string');
    expect(idField?.required).toBe(true);

    const priceField = schema.fields.find((f) => f.name === 'price');
    expect(priceField?.type).toBe('number');

    const inStockField = schema.fields.find((f) => f.name === 'inStock');
    expect(inStockField?.type).toBe('boolean');
  });

  it('should infer schema from an array of objects', () => {
    const response = [
      { id: '1', name: 'Widget', price: 29.99 },
      { id: '2', name: 'Gadget', price: 49.99, discount: 10 },
    ];

    const schema = inferSchemaFromResponse(response, 'Product');

    expect(schema.name).toBe('Product');

    // Common fields should be required
    const idField = schema.fields.find((f) => f.name === 'id');
    expect(idField?.required).toBe(true);

    const nameField = schema.fields.find((f) => f.name === 'name');
    expect(nameField?.required).toBe(true);

    // discount only in second item - should be optional
    const discountField = schema.fields.find((f) => f.name === 'discount');
    expect(discountField?.required).toBe(false);
  });

  it('should handle nested objects', () => {
    const response = {
      id: '1',
      address: {
        street: '123 Main St',
        city: 'Springfield',
        zip: 12345,
      },
    };

    const schema = inferSchemaFromResponse(response, 'User');

    const addressField = schema.fields.find((f) => f.name === 'address');
    expect(addressField?.type).toBe('object');
    expect(addressField?.objectFields).toHaveLength(3);

    const streetField = addressField?.objectFields?.find(
      (f) => f.name === 'street'
    );
    expect(streetField?.type).toBe('string');
  });

  it('should handle arrays within objects', () => {
    const response = {
      id: '1',
      tags: ['electronics', 'gadgets'],
      scores: [95, 87, 92],
    };

    const schema = inferSchemaFromResponse(response, 'Item');

    const tagsField = schema.fields.find((f) => f.name === 'tags');
    expect(tagsField?.type).toBe('array');
    expect(tagsField?.arrayItemType?.type).toBe('string');

    const scoresField = schema.fields.find((f) => f.name === 'scores');
    expect(scoresField?.type).toBe('array');
    expect(scoresField?.arrayItemType?.type).toBe('number');
  });

  it('should extract data using dataPath option', () => {
    const response = {
      status: 'ok',
      data: {
        id: '1',
        name: 'Widget',
      },
    };

    const schema = inferSchemaFromResponse(response, 'Product', {
      dataPath: 'data',
    });

    expect(schema.fields).toHaveLength(2);
    expect(schema.fields.find((f) => f.name === 'id')).toBeDefined();
    expect(schema.fields.find((f) => f.name === 'name')).toBeDefined();
    expect(schema.fields.find((f) => f.name === 'status')).toBeUndefined();
  });

  it('should handle nested dataPath', () => {
    const response = {
      response: {
        data: {
          items: [{ id: '1', name: 'Widget' }],
        },
      },
    };

    const schema = inferSchemaFromResponse(response, 'Product', {
      dataPath: 'response.data.items',
    });

    expect(schema.fields.find((f) => f.name === 'id')).toBeDefined();
    expect(schema.fields.find((f) => f.name === 'name')).toBeDefined();
  });

  it('should include description when provided', () => {
    const response = { id: '1' };

    const schema = inferSchemaFromResponse(response, 'Product', {
      description: 'A product in the catalog',
    });

    expect(schema.description).toBe('A product in the catalog');
  });

  it('should include indexes when provided', () => {
    const response = { id: '1', slug: 'widget' };

    const schema = inferSchemaFromResponse(response, 'Product', {
      indexes: ['slug'],
    });

    expect(schema.indexes).toEqual(['slug']);
  });

  it('should include owner when provided', () => {
    const response = { id: '1' };

    const schema = inferSchemaFromResponse(response, 'Product', {
      owner: 'shop-plugin',
    });

    expect(schema.owner).toBe('shop-plugin');
  });

  it('should handle empty array', () => {
    const response: unknown[] = [];

    const schema = inferSchemaFromResponse(response, 'Product');

    expect(schema.name).toBe('Product');
    expect(schema.fields).toEqual([]);
  });

  it('should handle null values in fields', () => {
    const response = {
      id: '1',
      name: 'Widget',
      description: null,
    };

    const schema = inferSchemaFromResponse(response, 'Product');

    const descField = schema.fields.find((f) => f.name === 'description');
    expect(descField?.type).toBe('null');
  });

  it('should force array treatment with isArray option', () => {
    const response = { id: '1', name: 'Widget' };

    // Without isArray, treats as single object
    const schemaAsObject = inferSchemaFromResponse(response, 'Product');
    expect(schemaAsObject.fields).toHaveLength(2);

    // With isArray: false explicitly
    const schemaExplicit = inferSchemaFromResponse(response, 'Product', {
      isArray: false,
    });
    expect(schemaExplicit.fields).toHaveLength(2);
  });

  it('should handle invalid dataPath gracefully', () => {
    const response = { data: { id: '1' } };

    const schema = inferSchemaFromResponse(response, 'Product', {
      dataPath: 'nonexistent.path',
    });

    expect(schema.fields).toEqual([]);
  });

  it('should handle primitive at dataPath', () => {
    const response = { data: 'just a string' };

    const schema = inferSchemaFromResponse(response, 'Product', {
      dataPath: 'data',
    });

    expect(schema.fields).toEqual([]);
  });

  it('should handle dataPath through null value', () => {
    const response = { data: null };

    const schema = inferSchemaFromResponse(response, 'Product', {
      dataPath: 'data.nested',
    });

    expect(schema.fields).toEqual([]);
  });

  it('should handle dataPath through primitive value', () => {
    const response = { count: 42 };

    const schema = inferSchemaFromResponse(response, 'Product', {
      dataPath: 'count.nested',
    });

    expect(schema.fields).toEqual([]);
  });

  it('should not include indexes when array is empty', () => {
    const response = { id: '1' };

    const schema = inferSchemaFromResponse(response, 'Product', {
      indexes: [],
    });

    expect(schema.indexes).toBeUndefined();
  });

  it('should handle array with non-object items', () => {
    const response = [null, 'string', 123, { id: '1' }];

    const schema = inferSchemaFromResponse(response, 'Mixed', {
      isArray: true,
    });

    // Only the object should contribute fields
    expect(schema.fields.find((f) => f.name === 'id')).toBeDefined();
  });

  it('should handle array with only non-object items', () => {
    const response = [null, 'string', 123, undefined];

    const schema = inferSchemaFromResponse(response, 'Primitives', {
      isArray: true,
    });

    // No objects to infer from - should return empty fields
    expect(schema.fields).toEqual([]);
  });

  it('should handle isArray true with non-array data', () => {
    const response = { id: '1', name: 'Widget' };

    // isArray: true but data is not an array
    const schema = inferSchemaFromResponse(response, 'Product', {
      isArray: true,
    });

    // When isArray is true but data is not actually an array,
    // the condition (shouldTreatAsArray && Array.isArray(data)) is false
    // so it falls through to the single object handling
    expect(schema.fields).toHaveLength(2);
  });

  it('should not include description when not provided', () => {
    const response = { id: '1' };

    const schema = inferSchemaFromResponse(response, 'Product');

    expect(schema.description).toBeUndefined();
  });

  it('should not include owner when not provided', () => {
    const response = { id: '1' };

    const schema = inferSchemaFromResponse(response, 'Product');

    expect(schema.owner).toBeUndefined();
  });

  it('should handle undefined value in dataPath traversal', () => {
    const response = { data: { level1: undefined } };

    const schema = inferSchemaFromResponse(response, 'Product', {
      dataPath: 'data.level1.level2',
    });

    expect(schema.fields).toEqual([]);
  });
});

describe('mergeResponseInferences', () => {
  it('should merge multiple responses', () => {
    const responses = [
      { id: '1', name: 'Widget', price: 29.99 },
      { id: '2', name: 'Gadget', price: 49.99, discount: 10 },
      { id: '3', name: 'Thing', price: 19.99 },
    ];

    const schema = mergeResponseInferences(responses, 'Product');

    expect(schema.name).toBe('Product');

    // Common fields should be required
    const idField = schema.fields.find((f) => f.name === 'id');
    expect(idField?.required).toBe(true);

    // discount only in one response - should be optional
    const discountField = schema.fields.find((f) => f.name === 'discount');
    expect(discountField?.required).toBe(false);
  });

  it('should handle empty responses array', () => {
    const schema = mergeResponseInferences([], 'Product');

    expect(schema.name).toBe('Product');
    expect(schema.fields).toEqual([]);
  });

  it('should handle single response', () => {
    const responses = [{ id: '1', name: 'Widget' }];

    const schema = mergeResponseInferences(responses, 'Product');

    expect(schema.fields).toHaveLength(2);
    expect(schema.fields.find((f) => f.name === 'id')?.required).toBe(true);
  });

  it('should detect type variations across responses', () => {
    const responses = [{ value: 'string value' }, { value: 123 }];

    const schema = mergeResponseInferences(responses, 'Data');

    // Type conflict should result in 'unknown'
    const valueField = schema.fields.find((f) => f.name === 'value');
    expect(valueField?.type).toBe('unknown');
  });

  it('should pass options through to all responses', () => {
    const responses = [
      { data: { id: '1' } },
      { data: { id: '2', extra: 'field' } },
    ];

    const schema = mergeResponseInferences(responses, 'Product', {
      dataPath: 'data',
      description: 'Test description',
      indexes: ['slug'],
      owner: 'test-owner',
    });

    expect(schema.description).toBe('Test description');
    expect(schema.indexes).toEqual(['slug']);
    expect(schema.owner).toBe('test-owner');

    // Should have inferred from data path
    expect(schema.fields.find((f) => f.name === 'id')).toBeDefined();
    expect(schema.fields.find((f) => f.name === 'extra')?.required).toBe(false);
  });

  it('should not include optional properties when not provided', () => {
    const responses: unknown[] = [];

    const schema = mergeResponseInferences(responses, 'Empty');

    expect(schema.description).toBeUndefined();
    expect(schema.indexes).toBeUndefined();
    expect(schema.owner).toBeUndefined();
  });

  it('should handle empty indexes array', () => {
    const responses: unknown[] = [];

    const schema = mergeResponseInferences(responses, 'Empty', {
      indexes: [],
    });

    expect(schema.indexes).toBeUndefined();
  });
});

describe('inferSchemaFromJsonString', () => {
  it('should parse and infer from JSON string', () => {
    const json = '{"id": "1", "name": "Widget", "price": 29.99}';

    const schema = inferSchemaFromJsonString(json, 'Product');

    expect(schema.name).toBe('Product');
    expect(schema.fields).toHaveLength(3);
    expect(schema.fields.find((f) => f.name === 'id')?.type).toBe('string');
    expect(schema.fields.find((f) => f.name === 'price')?.type).toBe('number');
  });

  it('should handle JSON array', () => {
    const json = '[{"id": "1"}, {"id": "2", "extra": true}]';

    const schema = inferSchemaFromJsonString(json, 'Item');

    expect(schema.fields.find((f) => f.name === 'id')?.required).toBe(true);
    expect(schema.fields.find((f) => f.name === 'extra')?.required).toBe(false);
  });

  it('should handle invalid JSON gracefully', () => {
    const invalidJson = 'not valid json {{{';

    const schema = inferSchemaFromJsonString(invalidJson, 'Product');

    expect(schema.name).toBe('Product');
    expect(schema.fields).toEqual([]);
  });

  it('should pass options through', () => {
    const json = '{"data": {"id": "1"}}';

    const schema = inferSchemaFromJsonString(json, 'Product', {
      dataPath: 'data',
      description: 'From JSON',
    });

    expect(schema.description).toBe('From JSON');
    expect(schema.fields.find((f) => f.name === 'id')).toBeDefined();
  });

  it('should preserve all options on parse error', () => {
    const invalidJson = 'not valid json';

    const schema = inferSchemaFromJsonString(invalidJson, 'Product', {
      description: 'Test desc',
      indexes: ['slug'],
      owner: 'test-owner',
    });

    expect(schema.name).toBe('Product');
    expect(schema.fields).toEqual([]);
    expect(schema.description).toBe('Test desc');
    expect(schema.indexes).toEqual(['slug']);
    expect(schema.owner).toBe('test-owner');
  });

  it('should not include options when not provided on parse error', () => {
    const invalidJson = 'not valid';

    const schema = inferSchemaFromJsonString(invalidJson, 'Test');

    expect(schema.description).toBeUndefined();
    expect(schema.indexes).toBeUndefined();
    expect(schema.owner).toBeUndefined();
  });

  it('should handle empty indexes array on parse error', () => {
    const invalidJson = '{bad json';

    const schema = inferSchemaFromJsonString(invalidJson, 'Product', {
      indexes: [],
    });

    expect(schema.indexes).toBeUndefined();
  });
});
