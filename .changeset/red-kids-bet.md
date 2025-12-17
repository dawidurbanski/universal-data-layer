---
'@universal-data-layer/plugin-source-contentful': patch
'universal-data-layer': patch
'@universal-data-layer/manual-tests': patch
---

### New Contentful Source Plugin (`@universal-data-layer/plugin-source-contentful`)

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
