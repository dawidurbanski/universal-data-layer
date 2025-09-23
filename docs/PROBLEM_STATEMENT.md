# Problem Statement

## The Core Problem

Unlike Gatsby's unified data layer, NextJS provides no standardized approach to data fetching. Every project starts from scratch, forcing developers to repeatedly implement data fetching patterns, caching strategies, and transformation logic. While having full control can be beneficial initially, it leads to:

- **Repetitive work** that pollutes codebases with unnecessary boilerplate
- **Inconsistent patterns** across projects and teams
- **Developer time wasted** on infrastructure instead of building features
- **No learning transfer** between projects since each implements data fetching differently

## Current Architecture Pain Points

### 1. API Request Explosion

Our current setup makes **hundreds or thousands of requests** to external APIs (Contentful, Shopify) for a single page load. This happens because:

- **Contentful Query Complexity Limits**: Contentful has a theoretical maximum query complexity of ~11,000 points. Complex queries easily hit this limit, forcing us to break single logical queries into multiple smaller ones.
- **No Request Deduplication**: Each component or page section fetches data independently, leading to duplicate API calls.
- **Cascading Dependencies**: Related entities must be fetched separately (product → reviews → images), multiplying request count.

**Impact**: We're forced to use static generation because dynamic rendering would take several seconds to gather all data and compile responses.

### 2. Caching Chaos

Multiple uncoordinated caching layers create more problems than they solve:

- **NextJS Fetch Caching**: Automatically caches all fetch requests by default, but creates a 10MB limit that triggers `FALLBACK_BODY_TOO_LARGE` errors on Vercel when exceeded.
- **Contentful's CDN Cache**: All JSON responses are cached by default, requiring special headers (`ctrl+shift+r` hard refresh) to bypass for fresh data.
- **No Unified Strategy**: Each caching layer operates independently with no coordination or intelligent invalidation.

### 3. Data Transformation Mess

Current data transformation is a maintenance nightmare:

- **Custom Extractors Everywhere**: Every component type has its own series of extractor functions to flatten, clean, and rename data.
- **Scattered Logic**: Transformation happens at the route level with utilities spread across the codebase.
- **No Standardization**: Mostly "messy spread and reshape object functions" with no consistent patterns.
- **Additional API Calls**: Extractors often need to make additional API calls to resolve references that were split due to query limits.

### 4. Multi-Source Coordination Failures

When pages need data from multiple sources (Contentful + Shopify + Okendo):

- **Mixed Patterns**: Some calls use `Promise.all`, others are sequential, with no consistent approach.
- **No Unified Error Handling**: Each source handles errors independently with try-catch blocks scattered throughout.
- **Fragile Deployments**: If any single API fails, the entire build fails and the site cannot be deployed.
- **No Fallback Strategies**: No graceful degradation when a non-critical data source is unavailable.

### 5. Developer Experience Problems

Adding new data requirements is painful and error-prone:

- **Multiple File Changes**: Typically requires modifying 2-3 files just to add one data field.
- **No Visibility**: Developers have no way to know what data is already being fetched elsewhere, leading to duplicate requests.
- **No Type Safety**: Types are "a mess" with lots of duplication and confusion between what's fetched and what components expect.
- **Knowledge Silos**: Each developer implements their own patterns, creating inconsistency and making code reviews difficult.

### 6. Incremental Static Regeneration (ISR) Cost Problem

The current architecture makes ISR prohibitively expensive:

- **Cascading Revalidations**: Changing a product title that appears on 10,000 blog posts triggers revalidation of all 10,000 pages.
- **No Smart Invalidation**: Cannot selectively revalidate only the data that changed.
- **All-or-Nothing Updates**: Must choose between one large response (revalidate everything) or many small responses (complex coordination).
- **Vercel Costs**: Each revalidation incurs costs, making frequent updates financially unsustainable at scale.

## The Vision: A Unified Data Layer

### Core Concept

A local database approach where:
1. **Data is pulled into a local/edge database** via webhooks and initial sync
2. **Applications query this database** instead of external APIs directly
3. **Smart revalidation** updates only what's necessary
4. **GraphQL-like queries** let developers declare exactly what they need

### Key Benefits

1. **Single Source of Truth**: All data in one queryable location
2. **No External Limits**: No query complexity limits or response size restrictions
3. **Instant Local Development**: Local database connected via websockets to production
4. **Selective Revalidation**: Update only affected data without cascading costs
5. **Type Safety**: Generated types from data sources ensure consistency
6. **Framework Agnostic**: Core functionality separate from framework-specific adapters

### Architecture Goals

- **Development**: Local database synced via websockets with production data
- **Build Time**: Build servers query nearby data server (same Vercel region) for fast builds
- **Runtime**: ISR triggered only for actually changed data, minimizing costs
- **Webhooks**: Real-time updates from Contentful/Shopify trigger targeted refreshes

This data layer will transform how modern web applications are built, eliminating repetitive work and letting developers focus on creating great user experiences rather than wrestling with data fetching infrastructure. The initial motivation for this project came from challenges faced at Caraway, but the solution is designed to be universally applicable to any NextJS project facing similar data layer challenges.