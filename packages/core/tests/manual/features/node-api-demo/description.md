# Node API Demo

This manual test demonstrates the Universal Data Layer's Node API through three example plugins that showcase the complete data transformation pipeline at build time.

## What This Tests

This demo illustrates the **sourceNodes** lifecycle hook and how plugins can:

1. **Source data** - Create nodes from external data sources
2. **Extend nodes** - Add computed fields to nodes created by other plugins
3. **Filter data** - Remove or curate nodes based on business logic

## The Three Plugins

### Plugin 1: Data Source (product-source)

**Purpose**: Creates product nodes from static data

- Sources 5 sample products from an in-memory array
- Demonstrates `createNode` action
- Shows proper use of `createNodeId` for deterministic IDs
- Uses `createContentDigest` for change detection

**Example Node Structure**:

```typescript
{
  id: "deterministic-hash",
  internal: {
    type: "Product",
    owner: "product-source",
    contentDigest: "content-hash"
  },
  name: "Wireless Headphones",
  price: 299.99,
  category: "electronics"
}
```

### Plugin 2: Node Extension (product-enrichment)

**Purpose**: Enriches product nodes with computed fields

- Queries all Product nodes using `getNodesByType`
- Adds `priceCategory` field based on price ranges
- Calculates `discountedPrice` (20% off)
- Sets `inStock` based on category
- Demonstrates `extendNode` action

**Added Fields**:

- `priceCategory`: 'budget' | 'affordable' | 'premium' | 'luxury'
- `discountedPrice`: number
- `inStock`: boolean
- `enrichedAt`: ISO timestamp

### Plugin 3: Node Curation (product-curator)

**Purpose**: Filters the product catalog

- Removes discontinued products
- Demonstrates `deleteNode` action
- Shows how plugins can curate data from upstream sources

## Plugin Execution Order

Plugins execute in the order they're loaded:

```
1. product-source     → Creates 5 products
2. product-enrichment → Adds computed fields to all 5
3. product-curator    → Removes discontinued items
```

**Final Result**: 4 enriched, curated product nodes ready for GraphQL queries

## Data Transformation Pipeline

```
Initial State (empty store)
    ↓
Plugin 1: Source Data
    → 5 Product nodes created
    ↓
Plugin 2: Extend Nodes
    → Each product gets priceCategory, discountedPrice, inStock
    ↓
Plugin 3: Filter Nodes
    → 1 discontinued product removed
    ↓
Final State
    → 4 enriched Product nodes remain
```

## Node Structure

All nodes follow this structure:

**Required Fields**:

- `id`: Unique identifier (string)
- `parent`: Parent node ID or undefined
- `children`: Array of child node IDs or undefined
- `internal.type`: GraphQL type name (e.g., "Product")
- `internal.owner`: Plugin that created the node
- `internal.contentDigest`: Hash for change detection
- `internal.createdAt`: Timestamp
- `internal.modifiedAt`: Timestamp

**Custom Fields**:
Any additional fields you add become queryable via GraphQL

## Key Concepts

### Static Build-Time Sourcing

Unlike traditional databases that query at runtime, the Node API sources and transforms data at **build time**:

- Plugins run once during the build process
- All data is pulled, transformed, and stored in the node store
- GraphQL queries run against this pre-built data set
- Faster queries, no database calls at runtime

### Deterministic Node IDs

Using `createNodeId('Product', externalId)` ensures:

- Same input always produces same ID
- Enables incremental builds
- Supports cache invalidation
- Stable across distributed systems

### Plugin Composition

Plugins can build on each other:

- One plugin sources raw data
- Another adds computed fields
- A third filters or transforms
- Order matters!

## Expected Behavior

When you click "Load Plugins & Source Nodes":

1. The three plugins load in sequence
2. Console shows each plugin's activity
3. Node visualization displays:
   - Total node count
   - Nodes grouped by type
   - Each node's owner and fields
4. GraphQL query section allows testing queries against the final node set

## Try These GraphQL Queries

```graphql
# Get all products
{
  allProducts {
    nodes {
      name
      price
      priceCategory
      inStock
    }
  }
}

# Get only affordable products
{
  allProducts(filter: { priceCategory: { eq: "affordable" } }) {
    nodes {
      name
      price
      discountedPrice
    }
  }
}

# Get in-stock products
{
  allProducts(filter: { inStock: { eq: true } }) {
    nodes {
      name
      category
    }
  }
}
```

## Related Documentation

- [Plugin System](../../../../../../docs/PLUGINS.md)
- [Node API Reference](../../../../../README.md#node-api)
- [GraphQL Schema Generation](../../../../../../docs/GRAPHQL.md)
