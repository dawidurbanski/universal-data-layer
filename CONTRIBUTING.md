# Contributing to Universal Data Layer

Thank you for your interest in contributing to the Universal Data Layer project! This document provides guidelines and instructions for contributing.

## Code of Conduct

By participating in this project, you agree to abide by our code of conduct: be respectful, inclusive, and constructive in all interactions.

## How Can I Contribute?

### Reporting Bugs

Before creating bug reports, please check existing issues to avoid duplicates. When creating a bug report, include:

- A clear and descriptive title
- Steps to reproduce the issue
- Expected vs actual behavior
- Your environment (Node version, OS, etc.)
- Any relevant logs or error messages

### Suggesting Features

Feature requests are welcome! Please provide:

- A clear use case for the feature
- How it aligns with the project's goals
- Any implementation ideas you might have
- Examples from other projects (if applicable)

### Pull Requests

Please read our [Pull Request Guidelines](./docs/PR_GUIDELINES.md) for detailed requirements and standards.

Quick overview:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Ensure all tests pass (`npm run test`)
5. Run linting and type checks (`npm run lint` and `npm run typecheck`)
6. Add a changeset (`npm run changeset`)
7. Commit your changes with [Conventional Commits](https://www.conventionalcommits.org/)
8. Push to your fork
9. Open a Pull Request using our template

## Development Setup

See the [Development Guide](./docs/DEVELOPMENT.md) for detailed setup instructions.

Quick start:

```bash
git clone https://github.com/dawidurbanski/universal-data-layer.git
cd universal-data-layer
npm install
npm run build
npm run dev
```

## Development Process

### Before You Start Coding

1. Check if an issue exists for your planned work
2. If not, create one to discuss the change
3. Wait for maintainer feedback before starting major work

### Code Style

This project uses automated tooling to ensure code quality:

- **Prettier** for code formatting
- **ESLint** for code quality
- **TypeScript** for type safety

Run these before committing:

```bash
npm run lint  # Check for issues
npm run fix   # Auto-fix issues
```

### Commit Messages

This project uses [Conventional Commits](https://www.conventionalcommits.org/) for automated versioning and changelog generation.

**Format:** `<type>(<scope>): <description>`

**Types:**

- `feat:` New features (triggers MINOR version bump)
- `fix:` Bug fixes (triggers PATCH version bump)
- `docs:` Documentation changes
- `style:` Code style changes (formatting, etc.)
- `refactor:` Code refactoring
- `perf:` Performance improvements
- `test:` Test additions or changes
- `build:` Build system changes
- `ci:` CI configuration changes
- `chore:` Other changes
- `revert:` Revert previous commits

**Scopes:** `core`, `contentful`, `shopify`, `okendo`, `cache`, `types`, `docs`, `deps`, `release`, `config`

**Breaking Changes:** Add `BREAKING CHANGE:` in the commit body for MAJOR version bumps.

Examples:

```
feat(core): add plugin discovery mechanism
fix(contentful): resolve caching issue with preview mode
docs(api): update GraphQL schema documentation
feat(shopify): add webhook handling support

BREAKING CHANGE: Plugin interface now requires version property
```

### Testing

Before submitting a PR:

1. Ensure all packages build: `npm run build`
2. Run linting: `npm run lint`
3. Run type checking: `npm run typecheck`
4. Run tests with coverage: `npm run test:coverage`
5. Ensure coverage meets 90% threshold
6. Add tests for new functionality

### Pull Request Process

Please follow our comprehensive [Pull Request Guidelines](./docs/PR_GUIDELINES.md) which cover all requirements in detail.

Key steps:

1. Add a changeset for your changes: `npm run changeset`
2. Update documentation for any API changes
3. Ensure your PR description clearly describes the problem and solution
4. Link any related issues
5. Ensure all CI checks pass (tests, linting, type checking)
6. Use the PR template to confirm all requirements are met
7. Request review from maintainers
8. Be responsive to feedback

**Note:** Every PR that changes functionality must include a changeset. The changeset will be used to generate changelogs and determine version bumps.

## Project Structure

```
universal-data-layer/
├── packages/          # Package workspaces
│   ├── core/         # Core library
│   └── contentful/   # Contentful plugin
├── docs/             # Documentation
└── package.json      # Root configuration
```

### Working with Packages

Each package is independent but shares configuration:

```bash
# Work on a specific package
cd packages/core
npm run dev

# Or from root, affecting all packages
npm run build
npm run lint
```

## Release Process

This project uses automated releases with semantic versioning. When your PR is merged to `main`:

1. CI/CD pipeline runs tests and checks
2. If changesets exist, a "Version Packages" PR is created automatically
3. Merging the Version PR triggers npm publishing
4. All packages are versioned and released together

For detailed information, see the [Release Documentation](./docs/RELEASE.md).

## Adding a New Data Source Plugin

1. Create a new package in `packages/`
2. Follow the plugin interface (to be documented)
3. Add documentation in the package README
4. Update the main README with your plugin

Example structure:

```
packages/my-plugin/
├── src/
│   └── index.ts
├── package.json
├── tsconfig.json
└── README.md
```

## Documentation

- Update relevant documentation with your changes
- Add JSDoc comments for public APIs
- Include examples in documentation
- Keep README files up to date

## Questions?

Feel free to:

- Open an issue for questions
- Start a discussion in GitHub Discussions
- Contact maintainers directly

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

## Recognition

Contributors will be recognized in:

- The project README
- Release notes for their contributions
- GitHub's contributor graph

Thank you for contributing to Universal Data Layer!
