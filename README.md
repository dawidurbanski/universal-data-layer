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
│   └── contentful/          # Contentful plugin (in development)
├── docs/                    # Documentation
│   ├── API.md               # API design specifications
│   └── PROBLEM_STATEMENT.md # Problem we're solving
└── package.json             # Root package with workspace configuration
```

## Quick Start

### Installation

```bash
# Clone the repository
git clone https://github.com/dawidurbanski/universal-data-layer.git
cd universal-data-layer

# Install dependencies
npm install

# Build all packages
npm run build

# Start development mode
npm run dev
```

### Available Commands

From the root directory:

- `npm run build` - Build all packages
- `npm run dev` - Start development mode with hot-reload
- `npm run lint` - Run linting checks across all packages
- `npm run fix` - Auto-fix linting and formatting issues
- `npm run start` - Start the production server

## Development

This monorepo uses:

- **Turborepo** for build orchestration
- **TypeScript** for type safety
- **ESLint** with flat config for code quality
- **Prettier** for code formatting
- **Husky** for git hooks

All packages share the root ESLint and Prettier configurations for consistency.

### Running Tests

```bash
npm run lint  # Run all linting checks
npm run fix   # Fix formatting and linting issues
```

## Packages

### [@universal-data-layer/core](./packages/core)

_(In Development)_ -The core package providing the GraphQL server and plugin architecture.

### [@universal-data-layer/contentful](./packages/contentful)

_(In Development)_ - Plugin for integrating Contentful CMS data.

## Documentation

- [Development Guide](./docs/DEVELOPMENT.md) - Setup and development workflow
- [API Design](./docs/API.md) - Detailed API specifications
- [Problem Statement](./docs/PROBLEM_STATEMENT.md) - The problems we're solving
- [Core Package Docs](./packages/core/README.md) - Core package documentation
- [Contributing Guidelines](./CONTRIBUTING.md) - How to contribute

## Contributing

This project is in early development. Contributions and feedback are welcome! Please see our [Contributing Guidelines](./CONTRIBUTING.md) for details.

## License

MIT
