---
'@universal-data-layer/codegen-typed-queries': minor
'universal-data-layer': minor
'@universal-data-layer/plugin-source-contentful': minor
---

### New Package: `@universal-data-layer/codegen-typed-queries`

Introduces a codegen extension that generates fully typed query functions from GraphQL files.

**Features:**

- Automatic TypedDocumentNode generation from `.graphql` files
- Generates typed wrapper functions with proper input/output types
- Supports configurable query file patterns and output locations
- Integrates with the new codegen extension system
- Comprehensive test coverage

**Usage:**

```typescript
// udl.config.ts
import { defineConfig } from 'universal-data-layer';

export const { config } = defineConfig({
  plugins: ['@universal-data-layer/plugin-source-contentful'],
  codegen: {
    output: './generated',
    extensions: ['@universal-data-layer/codegen-typed-queries'],
  },
});
```

### Core Enhancements (`universal-data-layer`)

**Codegen Extension System:**

- New pluggable extension architecture for codegen pipeline
- Extensions can hook into schema generation and add custom output
- `CodegenExtension` interface for creating custom extensions
- Extensions receive full schema context and can generate additional files

**TypedDocumentNode Support:**

- `query()` function now supports `TypedDocumentNode` for full type inference
- Automatic input/output type inference from document types
- Backwards compatible with string queries

**Pluggable Reference System:**

- New `ReferenceRegistry` for managing entity references
- Configurable reference resolvers per content type
- Supports custom ID extraction and type mapping
- Field-level reference configuration via `FieldLinkMap`

**Error Handling Improvements:**

- `query()` now returns error tuples `[data, error]` instead of throwing
- Graceful error handling with typed error responses
- Better developer experience with predictable error patterns

**Additional Changes:**

- NVM environment setup in husky hooks for consistent Node.js versions
- MSW integration for mocking API calls in development
- Enhanced GraphQL handler with improved type safety

### Contentful Plugin Updates (`@universal-data-layer/plugin-source-contentful`)

- Integration with the new pluggable reference system
- `FieldLinkMap` support for configuring reference resolution
- Improved reference handling for linked entries and assets

### Next.js Example

- Complete Next.js 15 example application demonstrating UDL usage
- Product listing and detail pages with typed queries
- MSW mocks for local development without Contentful credentials
- Image slider component with variant selection
- Tailwind CSS styling
