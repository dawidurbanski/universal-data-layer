# Universal Data Layer - Core

Core package providing GraphQL server, node store, and type generation.

## Installation

```bash
npm install universal-data-layer
```

## Quick Start

### CLI

```bash
# Start server with defaults
npx universal-data-layer

# Custom port
npx universal-data-layer --port 8080

# With config
npx universal-data-layer --config ./udl.config.ts
```

### Programmatic

```typescript
import { startServer } from 'universal-data-layer';

await startServer({ port: 4000 });
```

## Server Endpoints

- **GraphQL API**: `http://localhost:4000/graphql`
- **GraphiQL IDE**: `http://localhost:4000/graphiql`

## CLI Options

| Option                | Description      | Default         |
| --------------------- | ---------------- | --------------- |
| `-p, --port <port>`   | Server port      | `4000`          |
| `-c, --config <path>` | Config file path | `udl.config.ts` |
| `-h, --help`          | Show help        | -               |

## Features

- **Node Store**: In-memory storage with O(1) indexed lookups
- **GraphQL Schema**: Auto-generated from node types
- **Type Generation**: TypeScript types + type guards from nodes
- **Plugin System**: Extensible data source architecture
- **Reference Resolution**: Cross-plugin reference handling
- **Caching**: Pluggable cache storage (file-based default)

## Configuration

```typescript
// udl.config.ts
import { defineConfig } from 'universal-data-layer';

export const { config } = defineConfig({
  port: 4000,
  plugins: ['@universal-data-layer/plugin-source-contentful'],
  codegen: {
    output: './generated',
    extensions: ['@universal-data-layer/codegen-typed-queries'],
  },
});
```

## Querying Data

```typescript
import { udl } from 'universal-data-layer/client';
import { GetAllProducts } from './generated/queries';

const result = await udl.query(GetAllProducts, {
  resolveRefs: true,
});
```

## License

MIT
