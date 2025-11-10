# Contributing to Cozzy E-commerce API

Thank you for your interest in contributing to Cozzy E-commerce API! This document provides guidelines and instructions for contributing.

## 📋 Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Coding Standards](#coding-standards)
- [Testing Guidelines](#testing-guidelines)
- [Commit Guidelines](#commit-guidelines)
- [Pull Request Process](#pull-request-process)

## 🤝 Code of Conduct

- Be respectful and inclusive
- Welcome newcomers and help them learn
- Focus on constructive feedback
- Respect different viewpoints and experiences

## 🚀 Getting Started

1. **Fork the repository**

2. **Clone your fork**

```bash
git clone https://github.com/BronzonTech-Cloud/cozzy-api.git
cd cozzy-api
```

3. **Install dependencies**

```bash
npm install
# or
bun install
```

4. **Set up environment variables**

Copy `.env.example` to `.env` and fill in the required values:

```bash
cp .env.example .env
```

5. **Set up the database**

```bash
npm run prisma:migrate
npm run seed
```

6. **Run tests**

```bash
npm run test
```

## 💻 Development Workflow

1. **Create a branch**

```bash
git checkout -b feature/your-feature-name
# or
git checkout -b fix/your-bug-fix
```

2. **Make your changes**

- Write clean, maintainable code
- Follow the coding standards
- Add tests for new features
- Update documentation as needed

3. **Test your changes**

```bash
# Run linting
npm run lint

# Run tests
npm run test

# Check formatting
npm run format
```

4. **Commit your changes**

Follow the [commit guidelines](#commit-guidelines) below.

5. **Push to your fork**

```bash
git push origin feature/your-feature-name
```

6. **Open a Pull Request**

Create a pull request from your fork to the main repository.

## 📝 Coding Standards

### TypeScript

- Use TypeScript for all new code
- Avoid `any` types - use proper types or `unknown`
- Use interfaces for object shapes
- Use type aliases for complex types
- Follow the existing code style

### Code Style

- Use ESLint and Prettier (configured in the project)
- Run `npm run format` before committing
- Follow the existing code structure and patterns
- Write self-documenting code with clear variable names

### File Structure

- Follow the existing module structure
- Place related files in the same directory
- Use descriptive file names
- Export only what's necessary

### Example Structure

```
src/modules/feature-name/
├── feature-name.controller.ts
├── feature-name.routes.ts
├── feature-name.schema.ts
└── index.ts (optional)
```

## 🧪 Testing Guidelines

### Writing Tests

- Write tests for all new features
- Write tests for bug fixes
- Maintain or improve test coverage
- Use descriptive test names
- Follow the existing test patterns

### Test Structure

```typescript
describe('Feature Name', () => {
  describe('GET /api/v1/feature', () => {
    it('should do something', async () => {
      // Arrange
      // Act
      // Assert
    });
  });
});
```

### Running Tests

```bash
# Run all tests
npm run test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test
```

### Coverage Requirements

- Maintain at least 78% statement coverage
- Maintain at least 66% branch coverage
- Maintain at least 84% function coverage

## 📦 Commit Guidelines

### Commit Message Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

### Examples

```
feat(auth): add refresh token endpoint

Add POST /api/v1/auth/refresh endpoint to allow users to refresh their access tokens.

Closes #123
```

```
fix(products): handle invalid product ID

Fix 500 error when invalid product ID is provided. Now returns 404.

Fixes #456
```

## 🔄 Pull Request Process

### Before Submitting

- [ ] Code follows the project's coding standards
- [ ] All tests pass (`npm run test`)
- [ ] Linting passes (`npm run lint`)
- [ ] Code is formatted (`npm run format`)
- [ ] Documentation is updated
- [ ] Commit messages follow the guidelines

### PR Description Template

```markdown
## Description

Brief description of changes

## Type of Change

- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing

- [ ] Tests added/updated
- [ ] All tests pass
- [ ] Manual testing completed

## Checklist

- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Comments added for complex code
- [ ] Documentation updated
- [ ] No new warnings generated
```

### Review Process

1. Maintainers will review your PR
2. Address any feedback or requested changes
3. Once approved, your PR will be merged
4. Thank you for contributing! 🎉

## 🐛 Reporting Bugs

### Before Reporting

- Check if the bug has already been reported
- Verify it's not a configuration issue
- Try to reproduce the bug

### Bug Report Template

```markdown
**Describe the bug**
A clear description of what the bug is.

**To Reproduce**
Steps to reproduce the behavior:

1. Go to '...'
2. Click on '....'
3. See error

**Expected behavior**
What you expected to happen.

**Environment:**

- OS: [e.g., Ubuntu 22.04]
- Node version: [e.g., 18.17.0]
- Database: [e.g., PostgreSQL 16]

**Additional context**
Any other relevant information.
```

## 💡 Suggesting Features

### Feature Request Template

```markdown
**Is your feature request related to a problem?**
A clear description of the problem.

**Describe the solution you'd like**
What you want to happen.

**Describe alternatives you've considered**
Alternative solutions or features.

**Additional context**
Any other relevant information.
```

## 📚 Resources

- [TypeScript Documentation](https://www.typescriptlang.org/docs/)
- [Express.js Guide](https://expressjs.com/en/guide/routing.html)
- [Prisma Documentation](https://www.prisma.io/docs)
- [Vitest Documentation](https://vitest.dev/)

## ❓ Questions?

If you have questions, feel free to:

- Open an issue for discussion
- Check existing issues and PRs
- Review the documentation

Thank you for contributing to Cozzy E-commerce API! 🚀
