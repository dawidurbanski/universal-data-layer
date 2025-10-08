# universal-data-layer

## 0.2.0

### Minor Changes

- [#41](https://github.com/dawidurbanski/universal-data-layer/pull/41) [`edb82e0`](https://github.com/dawidurbanski/universal-data-layer/commit/edb82e0b71a2939cd73e5781c4a20f6b8d61bb5d) Thanks [@dawidurbanski](https://github.com/dawidurbanski)! - Implement node creation and manipulation API
  - Add Node and NodeInternal type definitions
  - Implement NodeStore with Map-based storage
  - Add utility functions for content digest and node ID generation
  - Implement createNode function for node management
  - Implement deleteNode function for node removal
  - Add node query functions (getNode, getNodes, getNodesByType)
  - Implement extendNode function for node manipulation
  - Integrate node API with plugin system via sourceNodes hook
  - Add automatic GraphQL schema generation from nodes
  - Add comprehensive unit and integration tests
  - Add manual test feature with demo plugins

### Patch Changes

- [#40](https://github.com/dawidurbanski/universal-data-layer/pull/40) [`6a928ff`](https://github.com/dawidurbanski/universal-data-layer/commit/6a928ff5ec09162186c35f0d417c2768ccf21f1c) Thanks [@dawidurbanski](https://github.com/dawidurbanski)! - Manual testing setup integrated into current dev mode

## 0.1.0

### Minor Changes

- [#15](https://github.com/dawidurbanski/universal-data-layer/pull/15) [`3cd0ded`](https://github.com/dawidurbanski/universal-data-layer/commit/3cd0ded2d3a8517d49215a7e760c2f6a78de6ce6) Thanks [@dawidurbanski](https://github.com/dawidurbanski)! - feat: Add comprehensive release system with semantic versioning
  - Configure changesets for coordinated versioning and changelog generation
  - Set up conventional commits with commitlint for automated versioning
  - Add GitHub Actions CI/CD pipeline with matrix testing (Node 18.x, 20.x, 22.x)
  - Configure vitest with 90% coverage threshold
  - Add automated npm publishing on merge to main
  - Update documentation with release procedures
  - Configure Turbo pipeline for test and release tasks
  - Add test infrastructure to all packages
