# @universal-data-layer/codegen-typed-queries

> **Beta**: This package is experimental and may change without notice.

TypedDocumentNode query generation extension for [Universal Data Layer](https://github.com/your-org/universal-data-layer).

## Overview

This extension generates TypeScript types for your GraphQL queries with full type inference. When you use `udl.query()` with a generated query, the result and variables are automatically typed.

## Installation

```bash
npm install @universal-data-layer/codegen-typed-queries
```

## Usage

Add the extension to your UDL config:

```typescript
// udl.config.ts
import { defineConfig } from 'universal-data-layer';

export const config = defineConfig({
  plugins: ['@universal-data-layer/plugin-source-contentful'],
  codegen: {
    output: './generated',
    extensions: ['@universal-data-layer/codegen-typed-queries'],
  },
});
```

Create `.graphql` files with your queries:

```graphql
# app/queries/products.graphql
query GetAllProducts {
  allContentfulProducts {
    name
    slug
    price
  }
}
```

After running the UDL server (which triggers codegen), import and use the generated queries:

```typescript
import { udl } from 'universal-data-layer/client';
import { GetAllProducts } from '@/generated/queries';

// Fully typed! result.allContentfulProducts is typed correctly
const result = await udl.query(GetAllProducts);
```

## How It Works

1. **Discovery**: Scans your project for `.graphql` and `.gql` files
2. **Parsing**: Parses GraphQL operations and extracts type information
3. **Generation**: Creates TypedDocumentNode exports with precise result and variable types
4. **Integration**: Output is placed in `<output>/queries/index.ts` and re-exported from the main generated index

## Features

- Automatic query file discovery
- Precise result types based on selection sets
- Variable types inferred from operation definitions
- Union and interface type support
- Works with UDL's GraphQL schema

## Limitations

- Fragments are not yet fully supported
- Custom scalars default to `unknown` type
- Only named operations are supported (anonymous queries are skipped)

## Alternative: graphql-codegen

If you need more advanced features, you can use [GraphQL Code Generator](https://the-guild.dev/graphql/codegen) instead:

```bash
npm install @graphql-codegen/cli @graphql-codegen/typescript @graphql-codegen/typescript-operations @graphql-codegen/typed-document-node
```

```yaml
# codegen.yml
schema: http://localhost:4000/graphql
documents: 'app/**/*.graphql'
generates:
  ./generated/operations.ts:
    plugins:
      - typescript
      - typescript-operations
      - typed-document-node
```

## License

MIT
