# Auto Shorts Web App - Code Quality Guidelines

This document outlines the code quality tools, configuration, and best practices used in the Auto Shorts Web App project.

## Automated Code Formatting and Linting

### What Is It?

**Code Formatting** automatically restructures code to follow consistent style rules without changing its behavior. It ensures that all code in the project maintains the same visual style regardless of who wrote it.

**Linting** analyzes source code to flag programming errors, bugs, stylistic errors, and suspicious constructs. It helps catch problems early in development.

### Benefits for Our Project

1. **Code Consistency**: Maintains uniform style across the codebase
2. **Error Prevention**: Catches potential bugs before they reach production
3. **Best Practices**: Enforces industry standards and best practices
4. **Performance Optimization**: Identifies inefficient code patterns
5. **Developer Efficiency**: Reduces time spent on manual code reviews
6. **Onboarding**: Helps new developers understand our coding standards quickly

## Frontend Tools (Next.js/React)

### ESLint

ESLint is a static code analysis tool for identifying problematic patterns in JavaScript/TypeScript code.

**Configuration**: `.eslintrc.json` in the `web/frontend` directory

**Running Locally**:
```bash
cd web/frontend
npm run lint        # Check for issues
npm run lint:fix    # Automatically fix issues where possible
```

**Common Rules**:
- No unused variables
- No console logs in production
- Proper React Hooks usage
- Accessible JSX patterns
- Import order

### Prettier

Prettier is an opinionated code formatter that enforces a consistent style.

**Configuration**: `.prettierrc` in the `web/frontend` directory

**Running Locally**:
```bash
cd web/frontend
npm run format       # Format all files
npm run format:check # Check if files are formatted correctly
```

**Key Settings**:
- Single quotes
- No semicolons
- 2 space indentation
- 80 character line length
- Trailing commas in multi-line objects

### Integration with VS Code

1. Install the ESLint and Prettier extensions
2. Enable "Format on Save" in VS Code settings
3. Set Prettier as the default formatter

```json
// VS Code settings.json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  }
}
```

## Backend Tools (FastAPI/Python)

### Black

Black is an uncompromising Python code formatter that takes a "one way, and only one way" approach.

**Configuration**: `pyproject.toml` in the `web/backend` directory

**Running Locally**:
```bash
cd web/backend
black .             # Format all files
black . --check     # Check if files are formatted correctly
```

### isort

isort organizes Python imports alphabetically and automatically separated into sections.

**Configuration**: Settings in `setup.cfg` in the `web/backend` directory

**Running Locally**:
```bash
cd web/backend
isort .             # Sort imports in all files
isort . --check     # Check if imports are sorted correctly
```

### Flake8

Flake8 is a wrapper around PyFlakes, pycodestyle, and McCabe complexity checker.

**Configuration**: Settings in `setup.cfg` in the `web/backend` directory

**Running Locally**:
```bash
cd web/backend
flake8 .            # Check for issues
```

**Key Rules**:
- Line length of 88 characters (matches Black)
- Complexity checks
- Style guide enforcement
- Docstring validation

### mypy

mypy is an optional static type checker for Python.

**Configuration**: Settings in `setup.cfg` in the `web/backend` directory

**Running Locally**:
```bash
cd web/backend
mypy app/           # Check types in the app directory
```

## Automated Checks with GitHub Actions

Our project uses GitHub Actions to automatically run formatting and linting checks on:
- Every push to main, feature/*, or fix/* branches
- Every pull request to main

The workflow is defined in `.github/workflows/lint.yml`.

### What Gets Checked

**Frontend**:
- ESLint rules
- Prettier formatting

**Backend**:
- isort import sorting
- Black formatting
- Flake8 linting

### Handling Failures

If the GitHub Actions workflow fails:

1. Click on the failing job in the Actions tab
2. Read the error message to understand what failed
3. Run the corresponding check locally to reproduce and fix the issue
4. Commit and push the fixed code

## Pre-commit Hooks (Optional)

To prevent committing code that doesn't meet our standards, you can set up pre-commit hooks:

1. Install pre-commit: `pip install pre-commit`
2. Set up the config file: `.pre-commit-config.yaml`
3. Install the hooks: `pre-commit install`

This will automatically run checks before each commit and prevent commits that don't meet our standards.

## Resolving Common Issues

### ESLint Errors

- **Unused variables**: Remove or use the variable
- **Missing dependencies in useEffect**: Add all referenced variables to the dependency array
- **Accessibility issues**: Follow the suggestions to make components more accessible

### Prettier Conflicts

- If Prettier and ESLint conflict, ensure you have eslint-config-prettier installed and configured

### Python Formatting Issues

- **Black conflicts with isort**: Use isort's black profile to ensure compatibility
- **Flake8 line length conflicts with Black**: Set Flake8's max-line-length to 88

## Best Practices

1. **Run Locally Before Pushing**: Run formatting and linting locally before pushing to avoid CI failures
2. **Format Entire Files**: Always format entire files, not just the lines you changed
3. **Don't Disable Rules Without Discussion**: If you need to disable a rule, discuss it with the team first
4. **Keep Configuration Files Updated**: When adding new rules or patterns, update configuration files
5. **Document Exceptions**: If you need to make an exception, document why in the code

---

By following these guidelines, we maintain high code quality and consistency throughout the Auto Shorts Web App project. 