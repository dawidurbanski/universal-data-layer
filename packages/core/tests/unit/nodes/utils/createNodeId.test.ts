import { describe, expect, it } from 'vitest';
import { createNodeId } from '@/nodes/utils/index.js';

describe('createNodeId', () => {
  it('creates a SHA-256 hash from string arguments', () => {
    const id = createNodeId('Product', 'shopify-123');

    expect(id).toBeTruthy();
    expect(id).toHaveLength(64); // SHA-256 produces 64 hex characters
  });

  it('creates deterministic IDs for same inputs', () => {
    const id1 = createNodeId('Product', 'shopify-123');
    const id2 = createNodeId('Product', 'shopify-123');

    expect(id1).toBe(id2);
  });

  it('creates different IDs for different inputs', () => {
    const id1 = createNodeId('Product', 'shopify-123');
    const id2 = createNodeId('Product', 'shopify-456');

    expect(id1).not.toBe(id2);
  });

  it('prevents collision with different argument splits', () => {
    // ['a', 'bc'] should produce different ID than ['ab', 'c']
    const id1 = createNodeId('a', 'bc');
    const id2 = createNodeId('ab', 'c');

    expect(id1).not.toBe(id2);
  });

  it('handles single argument', () => {
    const id = createNodeId('unique-identifier');

    expect(id).toBeTruthy();
    expect(id).toHaveLength(64);
  });

  it('handles multiple arguments', () => {
    const id = createNodeId('Product', 'shopify', '123', 'variant', 'blue');

    expect(id).toBeTruthy();
    expect(id).toHaveLength(64);
  });

  it('handles empty string', () => {
    const id = createNodeId('');

    expect(id).toBeTruthy();
    expect(id).toHaveLength(64);
  });

  it('creates consistent IDs for use cases', () => {
    // Typical plugin usage patterns
    const productId = createNodeId('Product', 'external-123');
    const reviewId = createNodeId('Review', 'product-123', 'user-456');
    const variantId = createNodeId('ProductVariant', 'product-123', 'sku-789');

    expect(productId).toHaveLength(64);
    expect(reviewId).toHaveLength(64);
    expect(variantId).toHaveLength(64);

    // All should be unique
    expect(productId).not.toBe(reviewId);
    expect(reviewId).not.toBe(variantId);
    expect(productId).not.toBe(variantId);
  });
});
