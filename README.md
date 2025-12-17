# Universal Data Layer

A **Gatsby-inspired** unified data layer for modern web applications. Plugin-based, framework-agnostic solution for managing data from multiple sources with intelligent caching and typed queries.

## Quick Start

```bash
# Start the data layer server
npx universal-data-layer

# With config file
npx universal-data-layer --config ./udl.config.ts
```

Server endpoints:

- GraphQL API: `http://localhost:4000/graphql`
- GraphiQL IDE: `http://localhost:4000/graphiql`

## Project Structure

```
universal-data-layer/
├── packages/
│   ├── core/                     # Core library with GraphQL server
│   ├── plugin-source-contentful/ # Contentful source plugin
│   └── codegen-typed-queries/    # TypedDocumentNode codegen extension
├── examples/
│   └── nextjs/                   # Next.js integration example
├── tests/
│   └── manual/                   # Vite-based test harness
└── docs/                         # Documentation site
```

## Configuration

```typescript
// udl.config.ts
import { defineConfig } from 'universal-data-layer';

export const { config } = defineConfig({
  port: 4000,
  plugins: [
    {
      name: '@udl/plugin-source-contentful',
      options: {
        spaceId: process.env.CONTENTFUL_SPACE_ID,
        accessToken: process.env.CONTENTFUL_ACCESS_TOKEN,
      },
    },
  ],
  codegen: {
    output: './generated',
    extensions: ['@udl/codegen-typed-queries'],
  },
});
```

## Packages

| Package                         | Description                              |
| ------------------------------- | ---------------------------------------- |
| `universal-data-layer`          | Core GraphQL server, node store, codegen |
| `@udl/plugin-source-contentful` | Contentful CMS integration with Sync API |
| `@udl/codegen-typed-queries`    | TypedDocumentNode query generation       |

## Development

```bash
npm run dev          # Start dev server
npm run build        # Build all packages
npm run test         # Run tests
npm run lint         # Lint check
npm run typecheck    # Type check
```

## Manual Testing

```bash
npm run manual       # Launch Vite test harness
```

Create test scenarios in `packages/*/tests/manual/features/`.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

## License

MIT
