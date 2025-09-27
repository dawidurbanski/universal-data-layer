# universal-data-layer

## 0.2.0

### Minor Changes

- [#20](https://github.com/dawidurbanski/universal-data-layer/pull/20) [`e0ff746`](https://github.com/dawidurbanski/universal-data-layer/commit/e0ff746170b3e30ab5004c68ae577b6d34777044) Thanks [@dawidurbanski](https://github.com/dawidurbanski)! - Add manual testing infrastructure with example applications
  - Add NextJS example application for integration testing
  - Create dev/start scripts for running packages alongside example frameworks
  - Add test:manual command for testing specific frameworks
  - Configure workspaces to include examples directory
  - Enhance core server with configuration loading and improved startup messages

### Patch Changes

- [#19](https://github.com/dawidurbanski/universal-data-layer/pull/19) [`aa6014e`](https://github.com/dawidurbanski/universal-data-layer/commit/aa6014eb6b06b8e30dff5989f0b261fc2d0702ed) Thanks [@dawidurbanski](https://github.com/dawidurbanski)! - docs: add comprehensive PR guidelines and template
  - Created detailed PR guidelines documentation (docs/PR_GUIDELINES.md) outlining all requirements for pull requests
  - Added GitHub PR template (.github/pull_request_template.md) with checklist for contributors
  - Updated CONTRIBUTING.md to reference the new PR guidelines
  - Established clear standards for code quality, testing, changesets, and documentation in PRs

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
