# Contentful Source Plugin Demo

This manual test demonstrates the `@universal-data-layer/plugin-source-contentful` plugin in action.

## Prerequisites

You need a Contentful space with some content. Get your credentials from:
https://app.contentful.com/spaces/{your-space-id}/api/keys

## Setup

1. Set environment variables:

```bash
export CONTENTFUL_SPACE_ID=your_space_id
export CONTENTFUL_ACCESS_TOKEN=your_delivery_api_access_token
```

2. Configure the plugin in your test UDL config.

## Running the Demo

From the repository root:

```bash
# Start the manual test UI
npm run test:manual

# Select "plugin-source-contentful" → "contentful-demo" from the sidebar
```

## What This Demo Shows

1. **Plugin Configuration**: Example configuration code
2. **Content Type Discovery**: Introspects the GraphQL schema to find Contentful types
3. **Node Fetching**: Queries nodes of any discovered content type
4. **Features Overview**: Summary of plugin capabilities
