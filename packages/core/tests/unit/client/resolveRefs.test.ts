import { describe, it, expect } from 'vitest';
import { resolveRefs } from '@/client/resolveRefs.js';

describe('resolveRefs', () => {
  it('returns data unchanged when no $entities', () => {
    const response = {
      data: { name: 'test', count: 42 },
    };

    const result = resolveRefs(response);

    expect(result).toEqual({ name: 'test', count: 42 });
  });

  it('returns data unchanged when $entities is empty', () => {
    const response = {
      data: { name: 'test' },
      $entities: {},
    };

    const result = resolveRefs(response);

    expect(result).toEqual({ name: 'test' });
  });

  it('resolves a single ref', () => {
    const response = {
      data: {
        product: { $ref: 'Product:p1' },
      },
      $entities: {
        'Product:p1': { name: 'Test Product', price: 100 },
      },
    };

    const result = resolveRefs(response);

    expect(result).toEqual({
      product: { name: 'Test Product', price: 100 },
    });
  });

  it('resolves nested refs', () => {
    const response = {
      data: {
        product: { $ref: 'Product:p1' },
      },
      $entities: {
        'Product:p1': {
          name: 'Test Product',
          swatch: { $ref: 'Swatch:s1' },
        },
        'Swatch:s1': { color: '#ff0000' },
      },
    };

    const result = resolveRefs(response);

    expect(result).toEqual({
      product: {
        name: 'Test Product',
        swatch: { color: '#ff0000' },
      },
    });
  });

  it('resolves arrays of refs', () => {
    const response = {
      data: {
        products: [
          { $ref: 'Product:p1' },
          { $ref: 'Product:p2' },
          { $ref: 'Product:p3' },
        ],
      },
      $entities: {
        'Product:p1': { name: 'Product 1' },
        'Product:p2': { name: 'Product 2' },
        'Product:p3': { name: 'Product 3' },
      },
    };

    const result = resolveRefs(response);

    expect(result).toEqual({
      products: [
        { name: 'Product 1' },
        { name: 'Product 2' },
        { name: 'Product 3' },
      ],
    });
  });

  it('resolves deeply nested structures', () => {
    const response = {
      data: {
        page: { $ref: 'Page:pg1' },
      },
      $entities: {
        'Page:pg1': {
          title: 'Home',
          sections: [{ $ref: 'Section:s1' }],
        },
        'Section:s1': {
          type: 'hero',
          blocks: [{ $ref: 'Block:b1' }, { $ref: 'Block:b2' }],
        },
        'Block:b1': { content: 'Hello' },
        'Block:b2': { content: 'World' },
      },
    };

    const result = resolveRefs(response);

    expect(result).toEqual({
      page: {
        title: 'Home',
        sections: [
          {
            type: 'hero',
            blocks: [{ content: 'Hello' }, { content: 'World' }],
          },
        ],
      },
    });
  });

  it('returns null for missing refs', () => {
    const response = {
      data: {
        product: { $ref: 'Product:missing' },
      },
      $entities: {},
    };

    const result = resolveRefs(response);

    expect(result).toEqual({
      product: null,
    });
  });

  it('handles mixed refs and primitives', () => {
    const response = {
      data: {
        title: 'My Page',
        product: { $ref: 'Product:p1' },
        tags: ['a', 'b', 'c'],
        count: 42,
      },
      $entities: {
        'Product:p1': { name: 'Test' },
      },
    };

    const result = resolveRefs(response);

    expect(result).toEqual({
      title: 'My Page',
      product: { name: 'Test' },
      tags: ['a', 'b', 'c'],
      count: 42,
    });
  });

  it('handles circular refs without infinite loop', () => {
    const response = {
      data: {
        node: { $ref: 'Node:n1' },
      },
      $entities: {
        'Node:n1': {
          name: 'Node 1',
          child: { $ref: 'Node:n2' },
        },
        'Node:n2': {
          name: 'Node 2',
          parent: { $ref: 'Node:n1' }, // Circular reference back to n1
        },
      },
    };

    // Should not throw or hang
    const result = resolveRefs(response) as unknown as {
      node: { name: string; child: { name: string; parent: unknown } };
    };

    // The first resolution of n1 goes through
    // When n2.parent references n1 again, it returns the entity as-is (not re-resolved)
    expect(result.node.name).toBe('Node 1');
    expect(result.node.child.name).toBe('Node 2');
    // The circular reference should be resolved but not re-processed
    expect(result.node.child.parent).toBeDefined();
  });

  it('handles self-referential entities', () => {
    const response = {
      data: {
        category: { $ref: 'Category:c1' },
      },
      $entities: {
        'Category:c1': {
          name: 'Root',
          parent: { $ref: 'Category:c1' }, // Self-reference
        },
      },
    };

    // Should not throw or hang
    const result = resolveRefs(response) as unknown as {
      category: { name: string; parent: unknown };
    };

    expect(result.category.name).toBe('Root');
    // Self-reference should be present but not infinitely resolved
    expect(result.category.parent).toBeDefined();
  });

  it('deduplicates entities when same ref appears multiple times', () => {
    const response = {
      data: {
        products: [{ $ref: 'Product:p1' }, { $ref: 'Product:p2' }],
      },
      $entities: {
        'Product:p1': { name: 'Product 1', swatch: { $ref: 'Swatch:s1' } },
        'Product:p2': { name: 'Product 2', swatch: { $ref: 'Swatch:s1' } }, // Same swatch
        'Swatch:s1': { color: 'red' },
      },
    };

    const result = resolveRefs(response) as unknown as {
      products: Array<{ swatch: { color: string } }>;
    };

    expect(result.products[0]?.swatch.color).toBe('red');
    expect(result.products[1]?.swatch.color).toBe('red');
  });

  it('preserves primitives and nulls', () => {
    const response = {
      data: {
        string: 'hello',
        number: 123,
        float: 3.14,
        boolean: true,
        nullVal: null,
        array: [1, 2, 3],
      },
      $entities: {},
    };

    const result = resolveRefs(response);

    expect(result).toEqual({
      string: 'hello',
      number: 123,
      float: 3.14,
      boolean: true,
      nullVal: null,
      array: [1, 2, 3],
    });
  });

  it('handles empty data', () => {
    const response = {
      data: null,
      $entities: {},
    };

    const result = resolveRefs(response);

    expect(result).toBe(null);
  });
});
