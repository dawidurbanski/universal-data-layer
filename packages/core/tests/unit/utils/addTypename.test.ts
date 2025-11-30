import { describe, it, expect } from 'vitest';
import { parse, print } from 'graphql';
import { addTypenameToDocument } from '@/utils/addTypename.js';

describe('addTypenameToDocument', () => {
  it('should add __typename to a simple query', () => {
    const query = parse(`
      query {
        product {
          name
        }
      }
    `);

    const result = addTypenameToDocument(query);
    const printed = print(result);

    expect(printed).toContain('__typename');
    expect(printed).toContain('name');
  });

  it('should add __typename to nested selections', () => {
    const query = parse(`
      query {
        product {
          name
          variants {
            color
            size
          }
        }
      }
    `);

    const result = addTypenameToDocument(query);
    const printed = print(result);

    // Should have __typename at root query, product, and variants levels
    const matches = printed.match(/__typename/g);
    expect(matches).toHaveLength(3);
  });

  it('should add __typename to inline fragments', () => {
    const query = parse(`
      query {
        product {
          pageSections {
            ... on ContentfulPageSectionsContent {
              name
              header
            }
          }
        }
      }
    `);

    const result = addTypenameToDocument(query);
    const printed = print(result);

    // Should have __typename at root query, product, pageSections, and inline fragment levels
    const matches = printed.match(/__typename/g);
    expect(matches).toHaveLength(4);
  });

  it('should not duplicate __typename if already present', () => {
    const query = parse(`
      query {
        product {
          __typename
          name
        }
      }
    `);

    const result = addTypenameToDocument(query);
    const printed = print(result);

    // Should have __typename at root query + one in product (not duplicated)
    const matches = printed.match(/__typename/g);
    expect(matches).toHaveLength(2);
  });

  it('should handle deeply nested structures', () => {
    const query = parse(`
      query {
        product {
          variants {
            swatch {
              color {
                rgb
              }
            }
          }
        }
      }
    `);

    const result = addTypenameToDocument(query);
    const printed = print(result);

    // root query, product, variants, swatch, color = 5 levels
    const matches = printed.match(/__typename/g);
    expect(matches).toHaveLength(5);
  });

  it('should handle queries with arguments', () => {
    const query = parse(`
      query GetProduct($id: ID!) {
        product(id: $id) {
          name
          price
        }
      }
    `);

    const result = addTypenameToDocument(query);
    const printed = print(result);

    expect(printed).toContain('__typename');
    expect(printed).toContain('product(id: $id)');
  });

  it('should handle multiple root fields', () => {
    const query = parse(`
      query {
        product {
          name
        }
        categories {
          title
        }
      }
    `);

    const result = addTypenameToDocument(query);
    const printed = print(result);

    // Root query selection + product + categories = 3 __typename
    const matches = printed.match(/__typename/g);
    expect(matches).toHaveLength(3);
  });

  it('should handle fragment spreads', () => {
    const query = parse(`
      query {
        product {
          ...ProductFields
        }
      }

      fragment ProductFields on Product {
        name
        price
      }
    `);

    const result = addTypenameToDocument(query);
    const printed = print(result);

    // root query + product selection + ProductFields fragment = 3 __typename
    const matches = printed.match(/__typename/g);
    expect(matches).toHaveLength(3);
  });
});
