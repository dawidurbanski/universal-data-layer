import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { gql, query, createQuery, udl } from '@/query.js';
import { print } from 'graphql';

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock config
vi.mock('@/config.js', () => ({
  getConfig: () => ({
    endpoint: 'http://localhost:4000/graphql',
    staticPath: '.udl',
  }),
}));

describe('query utilities', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('gql', () => {
    it('should parse a simple query', () => {
      const doc = gql`
        query {
          allProducts {
            name
          }
        }
      `;

      expect(doc.kind).toBe('Document');
      expect(doc.definitions).toHaveLength(1);
      expect(doc.definitions[0]?.kind).toBe('OperationDefinition');
    });

    it('should handle interpolated values', () => {
      const typeName = 'Products';
      const doc = gql`
        query {
          all${typeName} {
            name
          }
        }
      `;

      const queryString = print(doc);
      expect(queryString).toContain('allProducts');
    });

    it('should parse queries with fragments', () => {
      const doc = gql`
        query {
          product {
            ... on ContentfulProduct {
              name
            }
          }
        }
      `;

      expect(doc.kind).toBe('Document');
    });
  });

  describe('query', () => {
    it('should execute a query and return [null, data] tuple on success', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            data: {
              allProducts: [{ name: 'Product 1' }, { name: 'Product 2' }],
            },
          }),
      });

      const [error, result] = await query(gql`
        {
          allProducts {
            name
          }
        }
      `);

      // Should return null error and unwrapped data
      expect(error).toBeNull();
      expect(result).toEqual([{ name: 'Product 1' }, { name: 'Product 2' }]);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should add __typename to queries', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            data: { product: { name: 'Test' } },
          }),
      });

      await query(gql`
        {
          product {
            name
          }
        }
      `);

      const [, options] = mockFetch.mock.calls[0]!;
      const body = JSON.parse(options.body as string);

      // Should contain __typename in the query
      expect(body.query).toContain('__typename');
    });

    it('should unwrap single-item queries', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            data: {
              contentfulProduct: {
                name: 'Test Product',
                price: 99.99,
              },
            },
          }),
      });

      const [error, result] = await query<{ name: string; price: number }>(gql`
        {
          contentfulProduct(contentfulId: "abc123") {
            name
            price
          }
        }
      `);

      // Should unwrap the contentfulProduct key
      expect(error).toBeNull();
      expect(result).toEqual({
        name: 'Test Product',
        price: 99.99,
      });
    });

    it('should unwrap allXXX queries to return array', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            data: {
              allContentfulProducts: [
                { name: 'Product 1' },
                { name: 'Product 2' },
              ],
            },
          }),
      });

      const [error, result] = await query(gql`
        {
          allContentfulProducts {
            name
          }
        }
      `);

      // Should unwrap allContentfulProducts to return just the array
      expect(error).toBeNull();
      expect(result).toEqual([{ name: 'Product 1' }, { name: 'Product 2' }]);
    });

    it('should resolve refs from normalized responses', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            data: {
              product: {
                name: 'Test',
                variant: { $ref: 'Variant:v1' },
              },
            },
            $entities: {
              'Variant:v1': {
                name: 'Red',
                color: '#ff0000',
              },
            },
          }),
      });

      const [error, result] = await query<{
        name: string;
        variant: { name: string; color: string };
      }>(gql`
        {
          product {
            name
            variant {
              name
              color
            }
          }
        }
      `);

      // Should resolve refs
      expect(error).toBeNull();
      expect(result).toEqual({
        name: 'Test',
        variant: {
          name: 'Red',
          color: '#ff0000',
        },
      });
    });

    it('should pass variables to the query', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            data: { product: { name: 'Test' } },
          }),
      });

      await query(
        gql`
          query GetProduct($id: String!) {
            product(id: $id) {
              name
            }
          }
        `,
        { variables: { id: 'abc123' } }
      );

      const [, options] = mockFetch.mock.calls[0]!;
      const body = JSON.parse(options.body as string);

      expect(body.variables).toEqual({ id: 'abc123' });
    });

    it('should return [error, null] on HTTP errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      const [error, data] = await query(gql`
        {
          product {
            name
          }
        }
      `);

      expect(data).toBeNull();
      expect(error).toEqual({
        message: 'GraphQL request failed: Internal Server Error',
        type: 'network',
        status: 500,
      });
    });

    it('should return [error, null] on GraphQL errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            errors: [{ message: 'Field not found' }],
          }),
      });

      const [error, data] = await query(gql`
        {
          product {
            name
          }
        }
      `);

      expect(data).toBeNull();
      expect(error).toEqual({
        message: 'GraphQL error: Field not found',
        type: 'graphql',
        graphqlErrors: [{ message: 'Field not found' }],
      });
    });

    it('should accept string queries', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            data: { product: { name: 'Test' } },
          }),
      });

      const [error, result] = await query<{ name: string }>(
        '{ product { name } }'
      );

      expect(error).toBeNull();
      expect(result).toEqual({ name: 'Test' });
    });

    it('should use custom endpoint when provided', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            data: { product: { name: 'Test' } },
          }),
      });

      await query(
        gql`
          {
            product {
              name
            }
          }
        `,
        { endpoint: 'http://custom.api/graphql' }
      );

      const [url] = mockFetch.mock.calls[0]!;
      expect(url).toBe('http://custom.api/graphql');
    });

    it('should return data as-is when rootField is not found in data', async () => {
      // When the data doesn't contain the expected rootField key, it should return data as-is
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            data: { differentField: { name: 'Test' } },
          }),
      });

      const [error, result] = await query(gql`
        {
          product {
            name
          }
        }
      `);

      // rootField is 'product' but data has 'differentField', so data is returned as-is
      expect(error).toBeNull();
      expect(result).toEqual({ differentField: { name: 'Test' } });
    });

    it('should return [error, null] when fetch throws an Error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network failure'));

      const [error, data] = await query(gql`
        {
          product {
            name
          }
        }
      `);

      expect(data).toBeNull();
      expect(error).toEqual({
        message: 'Network failure',
        type: 'unknown',
      });
    });

    it('should return [error, null] with "Unknown error" when fetch throws non-Error', async () => {
      mockFetch.mockRejectedValueOnce('string error');

      const [error, data] = await query(gql`
        {
          product {
            name
          }
        }
      `);

      expect(data).toBeNull();
      expect(error).toEqual({
        message: 'Unknown error',
        type: 'unknown',
      });
    });
  });

  describe('createQuery', () => {
    it('should create a query function bound to an endpoint', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            data: { product: { name: 'Test' } },
          }),
      });

      const customQuery = createQuery('http://custom.api/graphql');
      await customQuery(gql`
        {
          product {
            name
          }
        }
      `);

      const [url] = mockFetch.mock.calls[0]!;
      expect(url).toBe('http://custom.api/graphql');
    });
  });

  describe('udl object', () => {
    it('should export query function', () => {
      expect(udl.query).toBe(query);
    });

    it('should export gql function', () => {
      expect(udl.gql).toBe(gql);
    });

    it('should export createQuery function', () => {
      expect(udl.createQuery).toBe(createQuery);
    });
  });
});
