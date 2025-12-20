# @universal-data-layer/plugin-source-contentful

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

- [#43](https://github.com/dawidurbanski/universal-data-layer/pull/43) [`e02b3e0`](https://github.com/dawidurbanski/universal-data-layer/commit/e02b3e0cee85bc48c946ce77d6d937dc8a43501d) Thanks [@dawidurbanski](https://github.com/dawidurbanski)! - ### New Contentful Source Plugin (`@universal-data-layer/plugin-source-contentful`)

  Introduces the first official source plugin for the Universal Data Layer, enabling seamless integration with Contentful CMS.

  **Features:**
  - Full Contentful Sync API support with incremental sync for efficient data updates
  - Automatic GraphQL schema generation from Contentful content types
  - Rich text field support with proper typing
  - Asset handling with optional local download capabilities
  - Reference resolution for linked entries and assets
  - Configurable locale support (default: `en-US`)
  - Content type filtering to include/exclude specific types
  - Multiple environment support (master, staging, etc.)
  - Preview API support for draft content
  - Pluggable sync token storage (file-based storage included by default)
  - Comprehensive error handling with typed errors (`ContentfulApiError`, `ContentfulSyncError`, etc.)

  **Configuration options:**
  - `spaceId` / `accessToken` - Contentful credentials
  - `host` - API host (defaults to CDN, can use preview API)
  - `environment` - Contentful environment
  - `nodePrefix` - Prefix for generated GraphQL types
  - `locale` - Locale for field value extraction
  - `downloadAssets` - Enable local asset caching (not implemented yet)
  - `contentTypeFilter` - Filter function for content types
  - `forceFullSync` - Force full re-sync ignoring stored tokens

  ### Core Enhancements (`universal-data-layer`)

  **File-based cache storage:**
  - New `FileCacheStorage` class for persisting node data to disk
  - Versioned cache format with automatic invalidation on version mismatch
  - Handles circular references safely during serialization

  **Environment variable loading:**
  - Automatic `.env` file loading with priority order support
  - Supports `.env.local`, `.env.{NODE_ENV}.local`, `.env.{NODE_ENV}`, and `.env`
  - Configurable override behavior for existing variables

  **Query utilities:**
  - `gql` tagged template literal for GraphQL queries
  - `query()` function with automatic `__typename` injection
  - Reference resolution with `resolveRefs` for denormalized responses
  - `addTypenameToDocument` utility for AST manipulation

  **Additional improvements:**
  - Enhanced GraphQL handler with improved normalization
  - New `resolveRefs` client utility for entity resolution
  - Comprehensive test coverage for query utilities and typename injection

- Updated dependencies [[`6df6943`](https://github.com/dawidurbanski/universal-data-layer/commit/6df69438d06205b6f3e2cfc4a9a4c4a74efbf86c), [`6a928ff`](https://github.com/dawidurbanski/universal-data-layer/commit/6a928ff5ec09162186c35f0d417c2768ccf21f1c), [`edb82e0`](https://github.com/dawidurbanski/universal-data-layer/commit/edb82e0b71a2939cd73e5781c4a20f6b8d61bb5d), [`e02b3e0`](https://github.com/dawidurbanski/universal-data-layer/commit/e02b3e0cee85bc48c946ce77d6d937dc8a43501d), [`e1ce532`](https://github.com/dawidurbanski/universal-data-layer/commit/e1ce532e8bd6d195b40376d364670260e093152f)]:
  - universal-data-layer@1.0.0
