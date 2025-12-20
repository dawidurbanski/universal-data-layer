# @universal-data-layer/codegen-typed-queries

## 1.0.3

### Patch Changes

- Updated dependencies [[`245733b`](https://github.com/dawidurbanski/universal-data-layer/commit/245733b48669522c20a5fbc484b2f7a5f88b8eb0)]:
  - universal-data-layer@1.0.3

## 1.0.2

### Patch Changes

- Updated dependencies [[`32b8769`](https://github.com/dawidurbanski/universal-data-layer/commit/32b8769e938db4cd9bba147e133ceb56b080ebb4)]:
  - universal-data-layer@1.0.2

## 1.0.1

### Patch Changes

- [`5399e18`](https://github.com/dawidurbanski/universal-data-layer/commit/5399e18ec55e8f588159ee276ca8ce321218d210) Thanks [@dawidurbanski](https://github.com/dawidurbanski)! - Exclude test files from npm package distribution

- Updated dependencies [[`5399e18`](https://github.com/dawidurbanski/universal-data-layer/commit/5399e18ec55e8f588159ee276ca8ce321218d210)]:
  - universal-data-layer@1.0.1

## 1.0.0

### Minor Changes

- [#45](https://github.com/dawidurbanski/universal-data-layer/pull/45) [`6df6943`](https://github.com/dawidurbanski/universal-data-layer/commit/6df69438d06205b6f3e2cfc4a9a4c4a74efbf86c) Thanks [@dawidurbanski](https://github.com/dawidurbanski)! - ### New Package: `@universal-data-layer/codegen-typed-queries`

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

### Patch Changes

- Updated dependencies [[`6df6943`](https://github.com/dawidurbanski/universal-data-layer/commit/6df69438d06205b6f3e2cfc4a9a4c4a74efbf86c), [`6a928ff`](https://github.com/dawidurbanski/universal-data-layer/commit/6a928ff5ec09162186c35f0d417c2768ccf21f1c), [`edb82e0`](https://github.com/dawidurbanski/universal-data-layer/commit/edb82e0b71a2939cd73e5781c4a20f6b8d61bb5d), [`e02b3e0`](https://github.com/dawidurbanski/universal-data-layer/commit/e02b3e0cee85bc48c946ce77d6d937dc8a43501d), [`e1ce532`](https://github.com/dawidurbanski/universal-data-layer/commit/e1ce532e8bd6d195b40376d364670260e093152f)]:
  - universal-data-layer@1.0.0
