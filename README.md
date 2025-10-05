# Universal Data Layer

A **Gatsby-inspired** unified data layer for modern web applications. This project aims to provide a plugin-based, framework-agnostic solution for managing data from multiple sources with intelligent caching and optimized payloads.

> ⚠️ **Early Stage WIP**: This project is in active early development. APIs and features are subject to change.

## The Idea

Modern applications often need to fetch data from multiple sources (CMSs, e-commerce platforms, APIs) with different patterns and authentication methods. This leads to:

- Redundant code across projects
- Inconsistent caching strategies
- Performance bottlenecks from unoptimized payloads
- Complex data transformation logic scattered throughout codebases

The Universal Data Layer solves this by providing a **single, extensible interface** that sits between your application and data sources - similar to how Gatsby's data layer works, but designed to be runtime-agnostic and work with any Node.js framework.

## Project Structure

This is a monorepo managed with npm workspaces and Turborepo:

```
universal-data-layer/
├── packages/
│   ├── core/                # Core library with GraphQL server
│   └── plugins/             # Plugins
|   └── adapters/            # Framework specific adapters
├── docs/                    # Documentation
├── examples/                # Various framework apps with sourcing from data layer enabled
└── package.json             # Root package with workspace configuration
```

## Quick Start

### Run the data layer with default settings

```bash
npx universal-data-layer
```

## Sourcing data

Documentation in progress. Coming soon...

## Manual Testing

The Universal Data Layer includes a comprehensive manual testing infrastructure for interactive feature development and debugging.

### Running Manual Tests

From the root directory:

```bash
# Run all manual test scenarios
npm run manual

# Run tests for a specific package (not yet implemented)
npm run manual --package=core

# Run a specific feature test (not yet implemented)
npm run manual --package=core --feature=basic-version-query
```

### Creating Test Scenarios

Each package can have its own manual test scenarios:

1. Create a `tests/manual/features/` directory in your package
2. Create a new feature directory (e.g., `my-feature/`)
3. Add required files:
   - `index.html` - Test page layout
   - `index.ts` - Test implementation (TypeScript required)
   - `manifest.ts` - Test metadata
4. Add optional documentation:
   - `description.md` - Feature explanation
   - `reproduction.md` - Bug reproduction steps

Example structure:

```
packages/core/
└── tests/manual/
    ├── .env.example             # Example environment variables
    └── features/
        └── basic-version-query/
            ├── manifest.ts
            ├── index.html
            ├── index.ts
            └── description.md
```

### Environment Variables

Each package can have a `.env` file in its `tests/manual/` directory for API keys and configuration:

```bash
cd packages/core/tests/manual
cp .env.example .env
# Edit .env with your configuration
```

The `.env` files are gitignored for security.

## Contributing

This project is in early development. Contributions and feedback are welcome! Please see our [Contributing Guidelines](./CONTRIBUTING.md) for details.

## License

MIT
