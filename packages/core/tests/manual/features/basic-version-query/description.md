# GraphQL Server Test

This test verifies that the Universal Data Layer's GraphQL server is running and can respond to queries.

## What This Tests

- **Server Connectivity**: Confirms the UDL server is accessible on `http://localhost:4000`
- **GraphQL Endpoint**: Validates the `/graphql` endpoint is functional
- **Version Query**: Executes a simple GraphQL query to fetch the server version

## Expected Behavior

When you click "Fetch version", the application will:

1. Send a POST request to `http://localhost:4000/graphql`
2. Send a GraphQL query: `{ version }` in request body
3. Display the response with the UDL version number

## Troubleshooting

Ensure your local GraphQL server is running on port `4000`. If your application selects a different port because `4000` is unavailable, this test may not work as expected.

## How It Works

The test makes a standard GraphQL HTTP request:

```javascript
fetch('http://localhost:4000/graphql', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ query: '{ version }' }),
});
```

This is the same request you could make with curl:

```bash
curl http://localhost:4000/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"{ version }"}'
```
