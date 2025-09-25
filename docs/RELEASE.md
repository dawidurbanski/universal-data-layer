# Release Process

This document describes the automated release process for the Universal Data Layer monorepo.

## Overview

The project uses:

- **Semantic Versioning** for version numbering
- **Conventional Commits** for commit messages
- **Changesets** for tracking changes and generating changelogs
- **GitHub Actions** for automated CI/CD
- **Turbo** for orchestrating monorepo tasks

All packages in the monorepo are versioned together and released simultaneously.

## Automated Release Flow

### 1. Development Workflow

When working on features or fixes:

1. Create a feature branch from `main`
2. Make your changes following conventional commit format
3. Add a changeset describing your changes:
   ```bash
   npm run changeset
   ```
4. Commit the changeset file along with your changes
5. Push your branch and create a pull request

### 2. Conventional Commit Format

All commits must follow the conventional commit format:

```
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

**Types:**

- `feat`: New feature (MINOR version bump)
- `fix`: Bug fix (PATCH version bump)
- `docs`: Documentation only changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code changes that neither fix bugs nor add features
- `perf`: Performance improvements
- `test`: Adding or updating tests
- `build`: Changes to build system or dependencies
- `ci`: Changes to CI configuration
- `chore`: Other changes that don't modify src or test files
- `revert`: Reverts a previous commit

**Scopes:**

- `core`: Core package changes
- `contentful`: Contentful plugin changes
- `shopify`: Shopify plugin changes (future)
- `okendo`: Okendo plugin changes (future)
- `cache`: Caching system changes
- `types`: TypeScript type definitions
- `docs`: Documentation changes
- `deps`: Dependency updates
- `release`: Release-related changes
- `config`: Configuration changes

**Breaking Changes:**
Add `BREAKING CHANGE:` in the commit body or footer to trigger a MAJOR version bump.

### 3. Pull Request Requirements

Before merging to `main`, pull requests must:

- ✅ Pass all CI checks (linting, type checking, tests)
- ✅ Meet 90% code coverage threshold
- ✅ Include at least one changeset file
- ✅ Have all commits following conventional commit format
- ✅ Be reviewed and approved

### 4. Automatic Release Process

When a PR is merged to `main`:

1. **CI Pipeline** runs automatically:
   - Runs tests across Node.js versions (18.x, 20.x, 22.x)
   - Checks code coverage (90% threshold)
   - Runs linting and type checking

2. **Release Pipeline** triggers:
   - Builds all packages
   - Runs tests with coverage
   - Creates a Release PR or publishes to npm

3. **Version Bumping**:
   - If unreleased changesets exist, the action creates a "Version Packages" PR
   - This PR updates package versions and changelogs
   - Merging this PR triggers the actual npm publish

4. **Publishing**:
   - All packages are published to npm
   - GitHub releases are created automatically
   - Changelogs are updated with links to commits and PRs

## Manual Commands

### Adding a Changeset

When you've made changes that should be released:

```bash
npm run changeset
```

Follow the prompts to:

1. Select which packages have changed
2. Choose the version bump type (patch/minor/major)
3. Write a summary of the changes

### Running Tests Locally

```bash
# Run all tests
npm run test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch
```

### Building Packages

```bash
# Build all packages
npm run build

# Build specific package
cd packages/core && npm run build
```

### Type Checking

```bash
npm run typecheck
```

### Linting

```bash
# Check for linting issues
npm run lint

# Auto-fix linting issues
npm run fix
```

## Pre-release Versions

While not currently used, the system supports pre-release versions:

1. Create a pre-release branch (e.g., `next`, `beta`, `alpha`)
2. Configure changesets to use pre-release mode
3. Version packages with pre-release tags
4. Publish to npm with appropriate dist-tags

## GitHub Secrets Required

For the automated release to work, configure these secrets in GitHub:

- `NPM_TOKEN`: npm automation token for publishing packages
  - Generate at: https://www.npmjs.com/settings/{username}/tokens
  - Select "Automation" type
  - Add to GitHub repository secrets

## Troubleshooting

### Tests Failing in CI

- Ensure all tests pass locally: `npm run test`
- Check coverage meets 90% threshold: `npm run test:coverage`
- Verify no linting errors: `npm run lint`

### Changeset Validation Failed

- Every PR must include a changeset: `npm run changeset`
- Exception: PRs that only update documentation or dev dependencies

### Commit Message Rejected

- Commits must follow conventional format
- Run `git log --oneline` to see examples
- Use `git commit --amend` to fix the last commit message

### Release Not Triggering

- Check that the Version Packages PR was merged
- Verify NPM_TOKEN is correctly configured in GitHub secrets
- Check GitHub Actions logs for errors

## Version Strategy

All packages in the monorepo are versioned together:

- When any package changes, all packages get a version bump
- This ensures compatibility across the ecosystem
- Simplifies dependency management for users

## Rollback Process

If a release has issues:

1. Revert the problematic commit(s) on `main`
2. Create a changeset describing the fix
3. Merge to trigger a new release
4. Consider using `npm deprecate` for the problematic version

## Questions or Issues?

- Check GitHub Actions logs for detailed error messages
- Review the `.changeset/config.json` for configuration
- Open an issue in the repository for help
