# Pull Request Guidelines

This document outlines the requirements and standards for submitting pull requests to the Universal Data Layer project. Following these guidelines ensures consistent quality and helps maintain the project's high standards.

## Prerequisites

Before creating a pull request, ensure you have:

1. **Read the [Contributing Guide](../CONTRIBUTING.md)** - Familiarize yourself with our development process and code style
2. **Created or referenced an issue** - All PRs should be linked to an existing issue for tracking
3. **Tested your changes locally** - Run the full test suite and ensure everything passes

## PR Requirements Checklist

Every pull request MUST meet the following requirements to be considered for merging:

### ✅ Code Quality

- [ ] **All tests pass**: Run `npm run test` and ensure 100% pass rate
- [ ] **Type checking passes**: Run `npm run typecheck` with no errors
- [ ] **Linting passes**: Run `npm run lint` with no errors
- [ ] **Code formatting applied**: Run `npm run fix` to auto-format code

### ✅ Testing

- [ ] **Existing tests still pass**: Your changes don't break any existing functionality
- [ ] **New tests added**: If you've added new features or fixed bugs, include appropriate tests
  - Unit tests for new functions/methods
  - Integration tests for new features
  - Edge cases are covered
- [ ] **Test coverage maintained**: Ensure coverage remains at or above 90%
  - Run `npm run test:coverage` to check coverage

### ✅ Changesets

- [ ] **Changeset file created**: Every PR that changes functionality requires a changeset
  - Run `npm run changeset` and follow the prompts
  - Choose the appropriate change type (major/minor/patch)
  - Write a clear, concise summary of your changes
  - See [Release Documentation](./RELEASE.md) for more details

### ✅ Documentation

- [ ] **Code documented**: Add JSDoc comments for public APIs
- [ ] **README updated**: Update relevant README files if adding new features
- [ ] **API documentation updated**: Update docs/API.md for API changes

## Commit Message Format

All commits must follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

### Types

- `feat`: New feature (MINOR version bump)
- `fix`: Bug fix (PATCH version bump)
- `docs`: Documentation only changes
- `style`: Code style changes (formatting, missing semi-colons, etc.)
- `refactor`: Code refactoring without changing functionality
- `perf`: Performance improvements
- `test`: Adding or updating tests
- `build`: Changes to build system or dependencies
- `ci`: CI/CD configuration changes
- `chore`: Other changes that don't modify src or test files
- `revert`: Reverts a previous commit

### Scopes

- `core`: Core library changes
- `contentful`: Contentful plugin changes
- `shopify`: Shopify plugin changes
- `okendo`: Okendo plugin changes
- `cache`: Caching layer changes
- `types`: TypeScript type definitions
- `docs`: Documentation changes
- `deps`: Dependency updates
- `release`: Release-related changes
- `config`: Configuration changes

### Examples

```bash
feat(core): add plugin discovery mechanism
fix(contentful): resolve caching issue with preview mode
docs(api): update GraphQL schema documentation
test(shopify): add webhook handler unit tests
chore(deps): update typescript to v5.0
```

## PR Title Format

Your PR title should be clear and descriptive, following this format:

```
<type>(<scope>): <brief description>
```

Examples:

- `feat(core): implement batch data fetching`
- `fix(cache): resolve memory leak in LRU cache`
- `docs: add PR guidelines and template`

## PR Description Template

When creating your PR, use the provided template (automatically loaded) and ensure you:

1. **Describe the changes**: Clear explanation of what and why
2. **Link related issues**: Use keywords like "Fixes #123" or "Closes #456"
3. **List breaking changes**: If any, clearly document them
4. **Provide testing instructions**: How reviewers can test your changes

## Quality Gates

All PRs must pass automated quality gates:

1. **CI/CD Pipeline**: All GitHub Actions workflows must pass
2. **Code Quality Checks**: ESLint, Prettier, and TypeScript checks
3. **Test Suite**: Full test suite with coverage requirements
4. **Commit Validation**: Commits follow conventional format (enforced by Husky)

## Review Process

1. **Automated Checks**: Wait for all CI checks to pass
2. **Code Review**: At least one maintainer must review and approve
3. **Address Feedback**: Respond to and resolve all review comments
4. **Keep Updated**: Rebase or merge main branch if conflicts arise
5. **Final Approval**: Maintainer will merge once all requirements are met

## Best Practices

### Do's ✅

- Keep PRs focused and small when possible
- Write clear, descriptive commit messages
- Update documentation alongside code changes
- Test your changes thoroughly
- Respond promptly to review feedback
- Use draft PRs for work in progress

### Don'ts ❌

- Don't mix unrelated changes in one PR
- Don't skip tests or documentation
- Don't ignore failing CI checks
- Don't commit directly to main branch
- Don't merge without approval
- Don't include sensitive information (API keys, secrets)

## Common Issues and Solutions

### Failing Tests

- Run `npm run test` locally before pushing
- Check test output for specific failures
- Ensure all new code has appropriate test coverage

### Linting Errors

- Run `npm run fix` to auto-fix most issues
- Manually fix any remaining errors shown by `npm run lint`

### Type Errors

- Run `npm run typecheck` to identify TypeScript issues
- Ensure all types are properly defined
- Avoid using `any` type unless absolutely necessary

### Changeset Issues

- Run `npm run changeset` if you haven't created one
- Choose the correct version bump type
- Write a user-friendly change description

## Need Help?

If you're stuck or have questions:

1. Check the [Contributing Guide](../CONTRIBUTING.md)
2. Review the [Development Documentation](./DEVELOPMENT.md)
3. Open a discussion in GitHub Discussions
4. Ask for help in your PR comments
5. Contact the maintainers

## Summary

Following these guidelines ensures that your contributions can be reviewed and merged efficiently. Remember:

1. **Quality over speed** - Take time to do things right
2. **Test thoroughly** - Prevent regressions and ensure reliability
3. **Document clearly** - Help others understand your changes
4. **Communicate openly** - Ask questions when unsure

Thank you for contributing to the Universal Data Layer project!
