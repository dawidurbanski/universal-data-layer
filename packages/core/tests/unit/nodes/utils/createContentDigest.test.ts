import { describe, expect, it } from 'vitest';
import { createContentDigest } from '@/nodes/utils/index.js';

describe('createContentDigest', () => {
  it('creates a SHA-256 hash from object data', () => {
    const data = { name: 'Product', price: 100 };
    const digest = createContentDigest(data);

    expect(digest).toBeTruthy();
    expect(digest).toHaveLength(64); // SHA-256 produces 64 hex characters
  });

  it('creates deterministic hashes for identical data', () => {
    const data1 = { name: 'Product', price: 100 };
    const data2 = { name: 'Product', price: 100 };

    const digest1 = createContentDigest(data1);
    const digest2 = createContentDigest(data2);

    expect(digest1).toBe(digest2);
  });

  it('creates different hashes for different data', () => {
    const data1 = { name: 'Product', price: 100 };
    const data2 = { name: 'Product', price: 200 };

    const digest1 = createContentDigest(data1);
    const digest2 = createContentDigest(data2);

    expect(digest1).not.toBe(digest2);
  });

  it('creates deterministic hashes regardless of key order', () => {
    const data1 = { price: 100, name: 'Product' };
    const data2 = { name: 'Product', price: 100 };

    const digest1 = createContentDigest(data1);
    const digest2 = createContentDigest(data2);

    expect(digest1).toBe(digest2);
  });

  it('handles nested objects', () => {
    const data = {
      name: 'Product',
      details: {
        price: 100,
        category: 'electronics',
      },
    };

    const digest = createContentDigest(data);

    expect(digest).toBeTruthy();
    expect(digest).toHaveLength(64);
  });

  it('handles arrays', () => {
    const data = { items: [1, 2, 3], name: 'List' };
    const digest = createContentDigest(data);

    expect(digest).toBeTruthy();
    expect(digest).toHaveLength(64);
  });

  it('handles primitive values', () => {
    const stringDigest = createContentDigest('test string');
    const numberDigest = createContentDigest(123);
    const boolDigest = createContentDigest(true);

    expect(stringDigest).toHaveLength(64);
    expect(numberDigest).toHaveLength(64);
    expect(boolDigest).toHaveLength(64);
    expect(stringDigest).not.toBe(numberDigest);
  });

  it('handles null and undefined', () => {
    const nullDigest = createContentDigest(null);
    const undefinedDigest = createContentDigest(undefined);

    expect(nullDigest).toHaveLength(64);
    expect(undefinedDigest).toHaveLength(64);
  });
});
