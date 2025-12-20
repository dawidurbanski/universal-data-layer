# universal-data-layer

## 1.0.5

### Patch Changes

- [`61e1ddd`](https://github.com/dawidurbanski/universal-data-layer/commit/61e1ddd3fc1b824435653f2abc137c43629b276c) Thanks [@dawidurbanski](https://github.com/dawidurbanski)! - Fix config loading errors when importing from universal-data-layer in udl.config.ts:
  - Add default export condition to package.json exports field (fixes ERR_PACKAGE_PATH_NOT_EXPORTED)
  - Remove top-level await from graphql handler using lazy initialization (fixes ERR_REQUIRE_ASYNC_MODULE)

## 1.0.4

### Patch Changes

- [`b8d64cf`](https://github.com/dawidurbanski/universal-data-layer/commit/b8d64cf2229cb460245321d56ba56e1a61ec0587) Thanks [@dawidurbanski](https://github.com/dawidurbanski)! - Fix ERR_PACKAGE_PATH_NOT_EXPORTED error when loading udl.config.ts by adding default export condition to package.json exports field

## 1.0.3

### Patch Changes

- [`245733b`](https://github.com/dawidurbanski/universal-data-layer/commit/245733b48669522c20a5fbc484b2f7a5f88b8eb0) Thanks [@dawidurbanski](https://github.com/dawidurbanski)! - Fix msw import error when running UDL in consuming projects

  Changed msw imports to be dynamic so the package is only loaded when mocks are actually needed. This prevents the "Cannot find package 'msw'" error when running `universal-data-layer` as a dependency, since msw is a devDependency and not installed in consuming projects.

## 1.0.2

### Patch Changes

- [`32b8769`](https://github.com/dawidurbanski/universal-data-layer/commit/32b8769e938db4cd9bba147e133ceb56b080ebb4) Thanks [@dawidurbanski](https://github.com/dawidurbanski)! - Fix manual-tests package dependency version

## 1.0.1

### Patch Changes

- [`5399e18`](https://github.com/dawidurbanski/universal-data-layer/commit/5399e18ec55e8f588159ee276ca8ce321218d210) Thanks [@dawidurbanski](https://github.com/dawidurbanski)! - Exclude test files from npm package distribution

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

- [#41](https://github.com/dawidurbanski/universal-data-layer/pull/41) [`edb82e0`](https://github.com/dawidurbanski/universal-data-layer/commit/edb82e0b71a2939cd73e5781c4a20f6b8d61bb5d) Thanks [@dawidurbanski](https://github.com/dawidurbanski)! - Implement node creation and manipulation API
  - Add Node and NodeInternal type definitions
  - Implement NodeStore with Map-based storage
  - Add utility functions for content digest and node ID generation
  - Implement createNode function for node management
  - Implement deleteNode function for node removal
  - Add node query functions (getNode, getNodes, getNodesByType)
  - Implement extendNode function for node manipulation
  - Integrate node API with plugin system via sourceNodes hook
  - Add automatic GraphQL schema generation from nodes
  - Add comprehensive unit and integration tests
  - Add manual test feature with demo plugins

### Patch Changes

- [#40](https://github.com/dawidurbanski/universal-data-layer/pull/40) [`6a928ff`](https://github.com/dawidurbanski/universal-data-layer/commit/6a928ff5ec09162186c35f0d417c2768ccf21f1c) Thanks [@dawidurbanski](https://github.com/dawidurbanski)! - Manual testing setup integrated into current dev mode

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

- [#42](https://github.com/dawidurbanski/universal-data-layer/pull/42) [`e1ce532`](https://github.com/dawidurbanski/universal-data-layer/commit/e1ce532e8bd6d195b40376d364670260e093152f) Thanks [@dawidurbanski](https://github.com/dawidurbanski)! - Types and codegen features added.

## 0.1.0

### Minor Changes

- [#15](https://github.com/dawidurbanski/universal-data-layer/pull/15) [`3cd0ded`](https://github.com/dawidurbanski/universal-data-layer/commit/3cd0ded2d3a8517d49215a7e760c2f6a78de6ce6) Thanks [@dawidurbanski](https://github.com/dawidurbanski)! - feat: Add comprehensive release system with semantic versioning
  - Configure changesets for coordinated versioning and changelog generation
  - Set up conventional commits with commitlint for automated versioning
  - Add GitHub Actions CI/CD pipeline with matrix testing (Node 18.x, 20.x, 22.x)
  - Configure vitest with 90% coverage threshold
  - Add automated npm publishing on merge to main
  - Update documentation with release procedures
  - Configure Turbo pipeline for test and release tasks
  - Add test infrastructure to all packages
