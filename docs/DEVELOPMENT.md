# Development Guide

This guide covers the development workflow, architecture decisions, and best practices for contributing to the Universal Data Layer project.

## Prerequisites

- Node.js 18+ (20.x recommended)
- npm 10.x
- Git

## Getting Started

### Initial Setup

1. Clone the repository:

```bash
git clone https://github.com/dawidurbanski/universal-data-layer.git
cd universal-data-layer
```

2. Install dependencies:

```bash
npm install
```

3. Build all packages:

```bash
npm run build
```

## Development Workflow

### Available Scripts

From the root directory, you can run:

#### Build Commands

- `npm run build` - Build all packages in the correct order
- `npm run dev` - Start development mode with hot-reload for all packages
- `npm run start` - Start the production server

#### Quality Checks

- `npm run lint` - Run all linting checks:
  - Prettier formatting check
  - ESLint quality check
  - TypeScript type checking
- `npm run fix` - Auto-fix formatting and linting issues

#### Turbo Commands

- `npm run turbo` - Direct access to Turborepo CLI

### Package-Specific Development

Each package has its own npm scripts that can be run from the package directory:

```bash
cd packages/core
npm run dev    # Start development mode for this package
npm run build  # Build this package
npm run lint   # Run linting for this package
npm run fix    # Fix issues in this package
```

## Project Architecture

### Monorepo Structure

```
universal-data-layer/
├── packages/              # All packages
│   ├── core/             # Core library
│   │   ├── src/          # Source code
│   │   ├── dist/         # Built output
│   │   ├── bin/          # CLI scripts
│   │   └── package.json
│   └── contentful/       # Contentful plugin
│       ├── src/
│       └── package.json
├── docs/                 # Documentation
├── eslint.config.js      # Shared ESLint config
├── .prettierrc.json      # Shared Prettier config
├── turbo.json           # Turborepo configuration
└── package.json         # Root package configuration
```

### Technology Stack

- **Build System**: Turborepo for efficient monorepo builds
- **Language**: TypeScript for type safety
- **Package Manager**: npm with workspaces
- **Code Quality**:
  - ESLint 9 with flat config
  - Prettier for formatting
  - TypeScript for type checking
- **Git Hooks**: Husky with lint-staged

## Code Quality Standards

### Linting and Formatting

All packages share the root configuration files:

- `eslint.config.js` - ESLint flat config with TypeScript support
- `.prettierrc.json` - Prettier formatting rules

#### ESLint Configuration

The project uses ESLint 9's flat config format with:

- TypeScript plugin and parser
- Node.js globals support
- Prettier integration to avoid conflicts
- Custom rules for unused variables

#### Prettier Configuration

```json
{
  "trailingComma": "es5",
  "tabWidth": 2,
  "semi": true,
  "singleQuote": true
}
```

### Pre-commit Hooks

Husky is configured to run lint-staged on commit, which:

1. Formats staged files with Prettier
2. Ensures no linting errors before commit

### TypeScript Configuration

Each package extends the root `tsconfig.json` for consistency:

- Target: ES2022
- Module: ESNext with Node module resolution
- Strict mode enabled
- Source maps for debugging

## Creating a New Package

1. Create the package directory:

```bash
mkdir packages/my-plugin
cd packages/my-plugin
```

2. Initialize the package:

```bash
npm init -y
```

3. Update `package.json`:

```json
{
  "name": "@universal-data-layer/my-plugin",
  "version": "0.0.1",
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "dev": "tsc-watch",
    "lint": "npm run lint:formatting && npm run lint:quality && npm run lint:types",
    "lint:formatting": "prettier --check .",
    "lint:quality": "eslint . --config ../../eslint.config.js",
    "lint:types": "tsc --noEmit",
    "fix": "npm run fix:formatting && npm run fix:quality",
    "fix:formatting": "prettier --write .",
    "fix:quality": "eslint . --fix --config ../../eslint.config.js"
  }
}
```

4. Create `tsconfig.json`:

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "**/*.test.ts", "**/*.spec.ts"]
}
```

5. Create the source directory and initial file:

```bash
mkdir src
echo "export const MyPlugin = { name: 'my-plugin' };" > src/index.ts
```

6. Run install from the root to link the workspace:

```bash
cd ../..
npm install
```

## Testing

_(Testing framework to be implemented)_

Currently, code quality is ensured through:

- TypeScript type checking
- ESLint static analysis
- Manual testing with GraphiQL

## Debugging

### Development Server

The core package runs a GraphQL server with GraphiQL interface:

1. Start the dev server:

```bash
npm run dev
```

2. Open GraphiQL: http://localhost:4000/graphiql

3. Test queries:

```graphql
{
  version
}
```

### TypeScript Source Maps

Source maps are enabled for debugging. Use your IDE's debugger or Node.js inspector:

```bash
node --inspect dist/index.js
```

## Common Issues

### ESLint Errors

If you encounter ESLint configuration errors:

1. Ensure you're using ESLint 9.x
2. Check that the flat config is properly referenced
3. Run `npm run fix` to auto-fix issues

### TypeScript Errors

For TypeScript compilation errors:

1. Check that all packages extend the root tsconfig
2. Ensure proper module resolution
3. Run `npm run lint:types` to see specific errors

### Turbo Cache Issues

If builds seem stale:

```bash
# Clear Turbo cache
rm -rf .turbo
npm run build
```

## Best Practices

1. **Always run linting before committing**:

   ```bash
   npm run lint
   ```

2. **Use the shared configurations**: Don't create package-specific ESLint or Prettier configs

3. **Keep packages focused**: Each package should have a single, clear responsibility

4. **Document your code**: Add JSDoc comments for public APIs

5. **Follow semantic versioning**: Update package versions appropriately

6. **Test your changes**: Ensure all packages build and lint successfully

## Resources

- [Turborepo Documentation](https://turbo.build/repo/docs)
- [ESLint Flat Config](https://eslint.org/docs/latest/use/configure/configuration-files-new)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [npm Workspaces](https://docs.npmjs.com/cli/v9/using-npm/workspaces)

## Questions?

Open an issue on [GitHub](https://github.com/dawidurbanski/universal-data-layer/issues) for questions or problems.
