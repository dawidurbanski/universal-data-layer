# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Initial monorepo setup with npm workspaces and Turborepo
- Core package (`@universal-data-layer/core`) with:
  - GraphQL server implementation
  - CLI interface for easy deployment
  - GraphiQL development interface
  - TypeScript support
  - Basic configuration loading system
- Contentful package (`@universal-data-layer/contentful`) scaffold
- ESLint 9 flat config with TypeScript support
- Prettier formatting configuration
- Husky pre-commit hooks with lint-staged
- Comprehensive documentation:
  - Development guide
  - Contributing guidelines
  - API design documentation
  - Problem statement

### Changed

- Migrated from ESLint legacy config to flat config format
- Updated build system to use Turborepo for efficient builds

### Fixed

- TypeScript configuration for proper module resolution
- ESLint configuration for Node.js globals support

## [0.0.1] - 2024-09-23

### Added

- Initial project structure
- Basic README with project vision
- MIT License
