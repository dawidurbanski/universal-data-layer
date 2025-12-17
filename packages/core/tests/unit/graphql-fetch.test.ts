import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { graphqlFetch } from '@/graphql-fetch.js';

// Mock the config module
vi.mock('@/config.js', () => ({
  getConfig: vi.fn(() => ({
    endpoint: 'http://localhost:4000/graphql',
  })),
}));

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('graphqlFetch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should successfully fetch data from GraphQL endpoint', async () => {
    const mockData = { allTodos: [{ id: '1', title: 'Test' }] };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: mockData }),
    });

    const result = await graphqlFetch<{
      allTodos: Array<{ id: string; title: string }>;
    }>('{ allTodos { id title } }');

    expect(result).toEqual(mockData);
    expect(mockFetch).toHaveBeenCalledWith('http://localhost:4000/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: '{ allTodos { id title } }',
        variables: undefined,
      }),
    });
  });

  it('should send variables when provided', async () => {
    const mockData = { todo: { id: '1', title: 'Test' } };
    const variables = { id: '1' };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: mockData }),
    });

    const result = await graphqlFetch<{ todo: { id: string; title: string } }>(
      'query GetTodo($id: ID!) { todo(id: $id) { id title } }',
      variables
    );

    expect(result).toEqual(mockData);
    expect(mockFetch).toHaveBeenCalledWith('http://localhost:4000/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: 'query GetTodo($id: ID!) { todo(id: $id) { id title } }',
        variables: { id: '1' },
      }),
    });
  });

  it('should throw error when response is not ok', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      statusText: 'Internal Server Error',
    });

    await expect(graphqlFetch('{ allTodos { id } }')).rejects.toThrow(
      'GraphQL request failed: Internal Server Error'
    );
  });

  it('should throw error when GraphQL returns errors', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        errors: [
          {
            message: 'Field "invalid" not found',
            locations: [{ line: 1, column: 3 }],
          },
        ],
      }),
    });

    await expect(graphqlFetch('{ invalid }')).rejects.toThrow(
      'GraphQL error: Field "invalid" not found'
    );
  });

  it('should throw error when no data is returned', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    });

    await expect(graphqlFetch('{ allTodos { id } }')).rejects.toThrow(
      'No data returned from GraphQL query'
    );
  });

  it('should throw error when data is null', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: null }),
    });

    await expect(graphqlFetch('{ allTodos { id } }')).rejects.toThrow(
      'No data returned from GraphQL query'
    );
  });

  it('should handle empty errors array without throwing', async () => {
    const mockData = { allTodos: [] };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: mockData, errors: [] }),
    });

    const result = await graphqlFetch('{ allTodos { id } }');

    expect(result).toEqual(mockData);
  });

  it('should handle multiple GraphQL errors and throw the first one', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        errors: [{ message: 'First error' }, { message: 'Second error' }],
      }),
    });

    await expect(graphqlFetch('{ invalid }')).rejects.toThrow(
      'GraphQL error: First error'
    );
  });
});
