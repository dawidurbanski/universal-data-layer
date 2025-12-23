# @universal-data-layer/plugin-source-contentful

## 2.0.0

### Patch Changes

- [#70](https://github.com/dawidurbanski/universal-data-layer/pull/70) [`0ea71da`](https://github.com/dawidurbanski/universal-data-layer/commit/0ea71da18234161ce8a09fdefcbae8731d7dba8c) Thanks [@dawidurbanski](https://github.com/dawidurbanski)! - # Add `updateStrategy` config option for sync-based source plugins

  Plugins can now specify how incremental updates from webhooks should be handled:
  - `'webhook'` (default): Process webhook payload directly via `registerWebhookHandler` or the default CRUD handler
  - `'sync'`: Treat webhooks as notifications only and re-run `sourceNodes` to fetch changes via the plugin's sync API

  This enables plugins with native sync APIs (like Contentful) to reuse their existing `sourceNodes` logic for incremental updates, eliminating the need to maintain separate webhook transformation code.

  ## Usage

  ```typescript
  // For sources with sync APIs (like Contentful)
  export const config = defineConfig({
    name: 'my-source-plugin',
    updateStrategy: 'sync',
  });
  ```

  When webhooks arrive for a plugin with `updateStrategy: 'sync'`:
  1. Webhooks are batched as usual (debounced)
  2. After the batch, `sourceNodes` is called once per affected plugin
  3. The plugin's delta sync fetches only changed data
  4. Cache is saved after sync completes

  The Contentful plugin now uses `updateStrategy: 'sync'` by default, leveraging the Contentful Sync API for efficient incremental updates.

- Updated dependencies [[`dfc7d90`](https://github.com/dawidurbanski/universal-data-layer/commit/dfc7d9054b761b951995dc5ceba467c2aa560d1a), [`6430a55`](https://github.com/dawidurbanski/universal-data-layer/commit/6430a55a4f1054fd0397f8ec1e21cf6a4e359e81), [`b376bed`](https://github.com/dawidurbanski/universal-data-layer/commit/b376bed4ad8398de74dcbc4fa05a960412f820af), [`5ff7110`](https://github.com/dawidurbanski/universal-data-layer/commit/5ff7110e4e80e0c6d84d7924b078200e69d07949), [`5ff7110`](https://github.com/dawidurbanski/universal-data-layer/commit/5ff7110e4e80e0c6d84d7924b078200e69d07949), [`2e01999`](https://github.com/dawidurbanski/universal-data-layer/commit/2e0199904518814cd899385ec29dbf8b002cb06b), [`aba060e`](https://github.com/dawidurbanski/universal-data-layer/commit/aba060e79217bd4c2bca8b8a56c7835296c74c02), [`8ec4f2b`](https://github.com/dawidurbanski/universal-data-layer/commit/8ec4f2b4f20825e597c52f1420b7f61a63264d02), [`5ff7110`](https://github.com/dawidurbanski/universal-data-layer/commit/5ff7110e4e80e0c6d84d7924b078200e69d07949), [`6ffae50`](https://github.com/dawidurbanski/universal-data-layer/commit/6ffae500b103c2a59b68c79bff01d11ac6fce5ef), [`051192e`](https://github.com/dawidurbanski/universal-data-layer/commit/051192e17361e0cb9661ce86ee46f938d88b96b6), [`6fe6408`](https://github.com/dawidurbanski/universal-data-layer/commit/6fe6408bca8f0924670c989318a3564b52257660), [`2e01999`](https://github.com/dawidurbanski/universal-data-layer/commit/2e0199904518814cd899385ec29dbf8b002cb06b), [`0ea71da`](https://github.com/dawidurbanski/universal-data-layer/commit/0ea71da18234161ce8a09fdefcbae8731d7dba8c), [`5920046`](https://github.com/dawidurbanski/universal-data-layer/commit/59200465efa9600155f8047157a674303912d547), [`2e01999`](https://github.com/dawidurbanski/universal-data-layer/commit/2e0199904518814cd899385ec29dbf8b002cb06b)]:
  - universal-data-layer@2.0.0

## 1.0.6

### Patch Changes

- Updated dependencies [[`4ea4d39`](https://github.com/dawidurbanski/universal-data-layer/commit/4ea4d39fecfe5304d6d830ed0d9fc20ea35fafdf)]:
  - universal-data-layer@1.0.6

## 1.0.5

### Patch Changes

- Updated dependencies [[`61e1ddd`](https://github.com/dawidurbanski/universal-data-layer/commit/61e1ddd3fc1b824435653f2abc137c43629b276c)]:
  - universal-data-layer@1.0.5

## 1.0.4

### Patch Changes

- Updated dependencies [[`b8d64cf`](https://github.com/dawidurbanski/universal-data-layer/commit/b8d64cf2229cb460245321d56ba56e1a61ec0587)]:
  - universal-data-layer@1.0.4

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
