# @udl/plugin-source-contentful

Contentful source plugin for Universal Data Layer. Automatically sources all content types, entries, and assets from a Contentful space.

## Installation

```bash
npm install @udl/plugin-source-contentful
```

## Configuration

Add the plugin to your UDL configuration:

```typescript
// udl.config.ts
import { defineConfig } from 'universal-data-layer';

export default defineConfig({
  plugins: [
    {
      resolve: '@udl/plugin-source-contentful',
      options: {
        spaceId: process.env.CONTENTFUL_SPACE_ID,
        accessToken: process.env.CONTENTFUL_ACCESS_TOKEN,
      },
    },
  ],
});
```

## Options

| Option              | Type                           | Default                | Description                                                |
| ------------------- | ------------------------------ | ---------------------- | ---------------------------------------------------------- |
| `spaceId`           | `string`                       | **required**           | Your Contentful space ID                                   |
| `accessToken`       | `string`                       | **required**           | Contentful Delivery API access token                       |
| `host`              | `string`                       | `'cdn.contentful.com'` | API host. Use `'preview.contentful.com'` for draft content |
| `environment`       | `string`                       | `'master'`             | Contentful environment                                     |
| `nodePrefix`        | `string`                       | `'Contentful'`         | Prefix for generated node type names                       |
| `locales`           | `string[]`                     | all locales            | Specific locales to fetch                                  |
| `downloadAssets`    | `boolean`                      | `false`                | Whether to download assets locally (not yet implemented)   |
| `contentTypeFilter` | `(ct: ContentType) => boolean` | -                      | Filter which content types to source                       |
| `useNameForId`      | `boolean`                      | `true`                 | Use content type name (vs ID) for node type names          |
| `forceFullSync`     | `boolean`                      | `false`                | Force full sync, ignoring stored sync token                |
| `syncTokenStorage`  | `SyncTokenStorage`             | file-based             | Custom storage for sync tokens                             |

## Generated Node Types

The plugin generates node types based on your Contentful content types:

- **Entries**: `{nodePrefix}{ContentTypeName}` (e.g., `ContentfulBlogPost`, `ContentfulAuthor`)
- **Assets**: `{nodePrefix}Asset` (e.g., `ContentfulAsset`)

Each node includes:

- `contentfulId` - Original Contentful sys.id (indexed for lookups)
- `sys` - Contentful system metadata (createdAt, updatedAt, revision, etc.)
- All content type fields with transformed values

## Sync API

The plugin uses Contentful's Sync API for efficient incremental updates:

1. **Initial sync**: Fetches all entries and assets
2. **Delta sync**: Only fetches changes since the last sync

Sync tokens are stored in `.udl-cache/contentful-sync-tokens.json` by default. You can provide custom storage:

```typescript
{
  resolve: '@udl/plugin-source-contentful',
  options: {
    spaceId: '...',
    accessToken: '...',
    syncTokenStorage: {
      async getSyncToken(key) {
        // Return stored token or null
      },
      async setSyncToken(key, token) {
        // Store the token
      },
      async clearSyncToken(key) {
        // Clear the token (optional)
      },
    },
  },
}
```

## Preview Mode

To fetch draft/unpublished content, use the Preview API:

```typescript
{
  resolve: '@udl/plugin-source-contentful',
  options: {
    spaceId: process.env.CONTENTFUL_SPACE_ID,
    accessToken: process.env.CONTENTFUL_PREVIEW_TOKEN,
    host: 'preview.contentful.com',
  },
}
```

## Multiple Spaces

Use `nodePrefix` to source from multiple Contentful spaces:

```typescript
export default defineConfig({
  plugins: [
    {
      resolve: '@udl/plugin-source-contentful',
      options: {
        spaceId: process.env.CMS_SPACE_ID,
        accessToken: process.env.CMS_ACCESS_TOKEN,
        nodePrefix: 'CMS',
      },
    },
    {
      resolve: '@udl/plugin-source-contentful',
      options: {
        spaceId: process.env.CRM_SPACE_ID,
        accessToken: process.env.CRM_ACCESS_TOKEN,
        nodePrefix: 'CRM',
      },
    },
  ],
});
```

This generates separate node types: `CMSBlogPost`, `CRMCustomer`, etc.

## Content Type Filtering

Filter which content types to source:

```typescript
{
  resolve: '@udl/plugin-source-contentful',
  options: {
    spaceId: '...',
    accessToken: '...',
    contentTypeFilter: (contentType) => {
      // Only source 'blogPost' and 'author' content types
      return ['blogPost', 'author'].includes(contentType.sys.id);
    },
  },
}
```

## References

Linked entries and assets are stored as references with their Contentful ID:

```typescript
{
  __contentfulRef: true,
  contentfulId: 'abc123',
  linkType: 'Entry' | 'Asset',
}
```

Use the `contentfulId` index to resolve references at query time.

## Rich Text

Rich text fields are stored with the raw JSON structure and extracted references:

```typescript
{
  raw: { /* Contentful rich text document */ },
  references: [
    { __contentfulRef: true, contentfulId: '...', linkType: 'Entry' },
    { __contentfulRef: true, contentfulId: '...', linkType: 'Asset' },
  ],
}
```

## Error Handling

The plugin exports error classes for specific error handling:

```typescript
import {
  ContentfulConfigError,
  ContentfulApiError,
  ContentfulSyncError,
  isRateLimitError,
  isAuthError,
} from '@udl/plugin-source-contentful';

try {
  // ...
} catch (error) {
  if (isRateLimitError(error)) {
    // Handle rate limiting
  }
  if (isAuthError(error)) {
    // Handle authentication errors
  }
}
```

## License

MIT
