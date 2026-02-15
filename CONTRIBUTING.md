# Contributing to CoorChat

First off, thank you for considering contributing to CoorChat! It's people like you that make CoorChat such a great tool for multi-agent coordination.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Process](#development-process)
- [How to Contribute](#how-to-contribute)
- [Pull Request Process](#pull-request-process)
- [Coding Standards](#coding-standards)
- [Testing Guidelines](#testing-guidelines)
- [Documentation](#documentation)
- [Community](#community)

---

## Code of Conduct

This project and everyone participating in it is governed by our [Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code. Please report unacceptable behavior to the project maintainers.

---

## Getting Started

### Prerequisites

- Node.js 18 or higher
- npm or yarn
- Git
- Docker (optional, for testing with Redis)
- Basic understanding of TypeScript and multi-agent systems

### Setting Up Development Environment

```bash
# 1. Fork the repository on GitHub

# 2. Clone your fork
git clone https://github.com/YOUR_USERNAME/coorchat.git
cd coorchat

# 3. Add upstream remote
git remote add upstream https://github.com/stuartf303/coorchat.git

# 4. Install dependencies
cd packages/mcp-server
npm install

# 5. Build the project
npm run build

# 6. Run tests
npm test
```

---

## Development Process

CoorChat follows the **Specify workflow**:

1. **Specification** - Clearly define what you want to build
2. **Clarification** - Resolve any ambiguities in requirements
3. **Planning** - Create an implementation plan
4. **Task Generation** - Break down work into actionable tasks
5. **Implementation** - Execute the plan with tests

### Branch Strategy

- `master` - Stable production code
- `feature/*` - New features (e.g., `feature/slack-integration`)
- `bugfix/*` - Bug fixes (e.g., `bugfix/redis-connection-timeout`)
- `docs/*` - Documentation updates (e.g., `docs/update-readme`)

### Commit Message Convention

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, no logic change)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

**Examples:**
```
feat(channels): add Slack channel integration

Implement Slack channel adapter using Slack Web API with
support for real-time messaging and webhook events.

Closes #42
```

```
fix(auth): prevent timing attack in token comparison

Replace string comparison with timing-safe buffer comparison
to prevent information leakage through timing analysis.
```

---

## How to Contribute

### Reporting Bugs

Before creating bug reports, please check the [issue list](https://github.com/stuartf303/coorchat/issues) to avoid duplicates.

**When submitting a bug report, include:**

- **Clear title**: Describe the issue concisely
- **Description**: Detailed explanation of the problem
- **Steps to reproduce**: Exact steps to trigger the bug
- **Expected behavior**: What should happen
- **Actual behavior**: What actually happens
- **Environment**: OS, Node version, relevant configuration
- **Logs**: Error messages, stack traces
- **Screenshots**: If applicable

**Use the bug report template** when creating issues.

### Suggesting Enhancements

Enhancement suggestions are tracked as [GitHub issues](https://github.com/stuartf303/coorchat/issues).

**When suggesting an enhancement, include:**

- **Clear title**: Describe the enhancement
- **Use case**: Why is this needed?
- **Proposed solution**: How should it work?
- **Alternatives**: Other approaches considered
- **Implementation notes**: Technical considerations

**Use the feature request template** when creating issues.

### Your First Code Contribution

Unsure where to begin? Look for issues labeled:

- `good first issue` - Simple issues perfect for newcomers
- `help wanted` - Issues where we need community help
- `documentation` - Documentation improvements

### Working on Issues

1. **Comment on the issue** to let others know you're working on it
2. **Ask questions** if anything is unclear
3. **Reference the issue** in your commits and PR

---

## Pull Request Process

### Before Submitting

1. **Update dependencies** if you added any
2. **Update documentation** for any changed functionality
3. **Add tests** for new features or bug fixes
4. **Run tests** and ensure they all pass
5. **Run linter** and fix any issues
6. **Update CHANGELOG.md** if this is a user-facing change

### Submitting a Pull Request

1. **Create a feature branch** from `master`
   ```bash
   git checkout -b feature/my-new-feature
   ```

2. **Make your changes** with clear commits
   ```bash
   git add .
   git commit -m "feat(scope): description"
   ```

3. **Keep your branch updated**
   ```bash
   git fetch upstream
   git rebase upstream/master
   ```

4. **Push to your fork**
   ```bash
   git push origin feature/my-new-feature
   ```

5. **Create Pull Request** on GitHub
   - Fill out the PR template completely
   - Link related issues
   - Add screenshots/videos if UI changes
   - Request review from maintainers

### PR Review Process

- Maintainers will review your PR within 3-5 business days
- Address feedback by pushing new commits
- Once approved, a maintainer will merge your PR
- Your contribution will be credited in the release notes!

### PR Checklist

- [ ] Code follows our style guidelines
- [ ] Self-review completed
- [ ] Comments added for complex logic
- [ ] Documentation updated
- [ ] Tests added/updated
- [ ] All tests passing
- [ ] No new warnings introduced
- [ ] CHANGELOG.md updated (if user-facing)

---

## Coding Standards

### TypeScript Style Guide

- **Use TypeScript** for all new code
- **Enable strict mode** (`strict: true` in tsconfig.json)
- **Prefer interfaces** over types for object shapes
- **Use explicit return types** for public APIs
- **Avoid `any`** - use `unknown` if type is truly unknown
- **Use modern ES6+** features (arrow functions, destructuring, async/await)

### Code Formatting

We use **Prettier** for consistent formatting:

```bash
# Format code
npm run format

# Check formatting
npm run format:check
```

**Prettier configuration:**
- 2 spaces for indentation
- Single quotes
- Semicolons required
- Trailing commas (ES5)
- Line length: 100 characters

### Linting

We use **ESLint** with TypeScript rules:

```bash
# Lint code
npm run lint

# Auto-fix issues
npm run lint:fix
```

### File Structure

```
src/
├── agents/       # Agent registry, roles, capabilities
├── channels/     # Channel implementations (Discord, Redis, SignalR)
├── cli/          # Command-line interface
├── config/       # Configuration, token generation
├── github/       # GitHub integration
├── logging/      # Structured logging
├── protocol/     # Message protocol, validation
└── tasks/        # Task queue, dependencies, conflicts
```

### Naming Conventions

- **Files**: `kebab-case.ts` (e.g., `agent-registry.ts`)
- **Classes**: `PascalCase` (e.g., `AgentRegistry`)
- **Functions**: `camelCase` (e.g., `registerAgent`)
- **Constants**: `UPPER_SNAKE_CASE` (e.g., `MAX_RETRIES`)
- **Interfaces**: `PascalCase` (e.g., `ChannelConfig`)
- **Types**: `PascalCase` (e.g., `MessageType`)

---

## Testing Guidelines

### Test Structure

We use **Vitest** for testing:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('FeatureName', () => {
  beforeEach(() => {
    // Setup
  });

  afterEach(() => {
    // Cleanup
  });

  it('should do something specific', () => {
    // Arrange
    const input = 'test';

    // Act
    const result = processInput(input);

    // Assert
    expect(result).toBe('expected');
  });
});
```

### Test Coverage

- **Aim for 80%+** code coverage
- **Required for**: New features, bug fixes
- **Test files**: Place in `tests/` directory
- **Naming**: `*.test.ts` or `*.spec.ts`

### Running Tests

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run in watch mode
npm test -- --watch

# Run specific test file
npm test -- path/to/test.test.ts
```

### Integration Tests

- Test real interactions between components
- Use test containers for external dependencies (Redis, etc.)
- Clean up resources in `afterEach`

### What to Test

✅ **Do test:**
- Public APIs and interfaces
- Edge cases and error conditions
- Integration points
- Security-critical code
- Complex business logic

❌ **Don't test:**
- Third-party library internals
- Trivial getters/setters
- Framework code

---

## Documentation

### Code Documentation

Use **JSDoc** for public APIs:

```typescript
/**
 * Register a new agent with the coordination system.
 *
 * @param agent - The agent to register
 * @returns The registered agent with assigned ID
 * @throws {Error} If agent validation fails
 *
 * @example
 * ```typescript
 * const agent = await registry.registerAgent({
 *   role: 'developer',
 *   capabilities: ['typescript', 'testing']
 * });
 * ```
 */
export async function registerAgent(agent: Agent): Promise<Agent> {
  // Implementation
}
```

### README Updates

When adding features:

1. Update feature list in README.md
2. Add usage examples
3. Update architecture diagram if structure changes

### Changelog

Update `CHANGELOG.md` for user-facing changes:

```markdown
## [Unreleased]

### Added
- New Slack channel integration (#42)

### Fixed
- Token comparison timing attack vulnerability (#51)

### Changed
- Improved error messages in CLI (#48)
```

---

## Community

### Getting Help

- **Documentation**: Start with [README](README.md), [INSTALL](INSTALL.md), [CLI docs](packages/mcp-server/CLI.md)
- **Discussions**: Ask questions in [GitHub Discussions](https://github.com/stuartf303/coorchat/discussions)
- **Issues**: Search [existing issues](https://github.com/stuartf303/coorchat/issues)

### Staying Updated

- **Watch** the repository for notifications
- **Star** the repository to show support
- **Follow** release notes for updates

### Recognition

Contributors are recognized in:
- Release notes
- README acknowledgments
- Git commit history

---

## License

By contributing to CoorChat, you agree that your contributions will be licensed under the MIT License.

---

## Questions?

Feel free to:
- Open a [Discussion](https://github.com/stuartf303/coorchat/discussions)
- Comment on relevant [Issues](https://github.com/stuartf303/coorchat/issues)
- Reach out to maintainers

**Thank you for contributing to CoorChat! 🎉**
