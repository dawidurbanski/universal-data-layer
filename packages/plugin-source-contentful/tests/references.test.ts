import { describe, it, expect } from 'vitest';
import {
  createReference,
  isContentfulReference,
  type ContentfulReference,
} from '@/utils/references.js';

describe('createReference', () => {
  it('creates an Entry reference', () => {
    const ref = createReference('entry-123', 'Entry');

    expect(ref).toEqual({
      __contentfulRef: true,
      contentfulId: 'entry-123',
      linkType: 'Entry',
    });
  });

  it('creates an Asset reference', () => {
    const ref = createReference('asset-456', 'Asset');

    expect(ref).toEqual({
      __contentfulRef: true,
      contentfulId: 'asset-456',
      linkType: 'Asset',
    });
  });
});

describe('isContentfulReference', () => {
  it('returns true for valid Entry reference', () => {
    const ref: ContentfulReference = {
      __contentfulRef: true,
      contentfulId: 'entry-123',
      linkType: 'Entry',
    };

    expect(isContentfulReference(ref)).toBe(true);
  });

  it('returns true for valid Asset reference', () => {
    const ref: ContentfulReference = {
      __contentfulRef: true,
      contentfulId: 'asset-456',
      linkType: 'Asset',
    };

    expect(isContentfulReference(ref)).toBe(true);
  });

  it('returns false for null', () => {
    expect(isContentfulReference(null)).toBe(false);
  });

  it('returns false for undefined', () => {
    expect(isContentfulReference(undefined)).toBe(false);
  });

  it('returns false for primitive values', () => {
    expect(isContentfulReference('string')).toBe(false);
    expect(isContentfulReference(123)).toBe(false);
    expect(isContentfulReference(true)).toBe(false);
  });

  it('returns false for plain objects without marker', () => {
    expect(
      isContentfulReference({ contentfulId: '123', linkType: 'Entry' })
    ).toBe(false);
  });

  it('returns false for objects with wrong marker value', () => {
    expect(
      isContentfulReference({
        __contentfulRef: false,
        contentfulId: '123',
        linkType: 'Entry',
      })
    ).toBe(false);
  });

  it('returns false for arrays', () => {
    expect(isContentfulReference([])).toBe(false);
  });
});
