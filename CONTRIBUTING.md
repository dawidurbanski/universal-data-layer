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

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Ensure all tests pass (`npm run lint`)
5. Commit your changes with clear messages
6. Push to your fork
7. Open a Pull Request

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

Follow conventional commit format:

- `feat:` New features
- `fix:` Bug fixes
- `docs:` Documentation changes
- `style:` Code style changes (formatting, etc.)
- `refactor:` Code refactoring
- `test:` Test additions or changes
- `chore:` Build process or auxiliary tool changes

Examples:

```
feat: add Shopify plugin support
fix: resolve caching issue in core package
docs: update API documentation
```

### Testing

Before submitting a PR:

1. Ensure all packages build: `npm run build`
2. Run linting: `npm run lint`
3. Test your changes manually
4. Add tests for new functionality (when test framework is implemented)

### Pull Request Process

1. Update documentation for any API changes
2. Ensure your PR description clearly describes the problem and solution
3. Link any related issues
4. Request review from maintainers
5. Be responsive to feedback
6. Squash commits if requested

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
