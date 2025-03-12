# Gitignore Guide for Auto Shorts Web App

This guide outlines the best practices for managing `.gitignore` in the Auto Shorts Web App project. It explains how we structure our gitignore files and the reasoning behind various exclusion patterns.

## Table of Contents

1. [Introduction to .gitignore](#introduction-to-gitignore)
2. [Project-Specific Patterns](#project-specific-patterns)
3. [Technology-Specific Patterns](#technology-specific-patterns)
4. [Environment and Secrets Management](#environment-and-secrets-management)
5. [IDE and Editor-Specific Patterns](#ide-and-editor-specific-patterns)
6. [Build and Temporary Files](#build-and-temporary-files)
7. [Test Artifacts and Coverage Reports](#test-artifacts-and-coverage-reports)
8. [Best Practices](#best-practices)
9. [Troubleshooting Common Issues](#troubleshooting-common-issues)

## Introduction to .gitignore

The `.gitignore` file tells Git which files and directories to ignore in a project. It's essential for avoiding the inclusion of:

- Large binary files that shouldn't be in version control
- Generated files that can be rebuilt
- Local configuration files that differ between developers
- Secrets and sensitive information
- Dependency directories that can be reinstalled
- Temporary files and logs

Our project uses a comprehensive `.gitignore` approach with specific sections for each component of our tech stack.

## Project-Specific Patterns

### Root-Level Patterns

```gitignore
# Project-specific files
media/processed/
uploads/
downloads/
generated-videos/
temp/
```

These patterns prevent temporary project data, user uploads, and generated content from being committed to the repository. These files:

- Can be large in size
- Change frequently
- Can be regenerated from source
- May contain user data

## Technology-Specific Patterns

### Python (Backend)

```gitignore
# Python
__pycache__/
*.py[cod]
*$py.class
*.so
.Python
build/
develop-eggs/
dist/
downloads/
eggs/
.eggs/
lib/
lib64/
parts/
sdist/
var/
wheels/
*.egg-info/
.installed.cfg
*.egg
MANIFEST
.pytest_cache/
.coverage
htmlcov/
.tox/
.nox/
```

These patterns exclude:
- Compiled Python files
- Build directories
- Package installation artifacts
- Test cache and coverage reports

### JavaScript/TypeScript (Frontend)

```gitignore
# JavaScript/TypeScript
node_modules/
.npm
.yarn
.pnp.*
.next/
out/
build/
dist/
coverage/
*.tsbuildinfo
```

These patterns exclude:
- Node module dependencies
- Next.js build directories
- TypeScript build info
- Package manager cache files

### Docker

```gitignore
# Docker
.docker/
docker-volumes/
docker-data/
```

These patterns exclude Docker-specific files and mounted volumes that shouldn't be in version control.

## Environment and Secrets Management

```gitignore
# Environment and secrets
.env
.env.local
.env.*.local
*.pem
.secrets/
```

These patterns are crucial for security:
- All `.env` files except example templates should be excluded
- SSL certificates and private keys should never be committed
- Any files containing API keys, passwords, or other secrets

We maintain an `.env.example` file that is committed to the repository as a template, but all actual environment files are excluded.

## IDE and Editor-Specific Patterns

```gitignore
# VS Code
.vscode/*
!.vscode/extensions.json
!.vscode/launch.json
!.vscode/settings.json.example

# JetBrains IDEs
.idea/
*.iml
*.iws
*.ipr

# Vim
*.swp
*.swo

# macOS
.DS_Store
```

These patterns:
- Exclude IDE configuration files that are specific to individual developers
- Selectively include shared configuration files that should be version controlled
- Exclude operating system-specific files

## Build and Temporary Files

```gitignore
# Build files
.cache/
.parcel-cache/
.webpack/
.eslintcache
.stylelintcache

# Logs
logs/
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*
```

These patterns exclude:
- Build cache directories
- Linting caches
- Log files that are generated during development and operation

## Test Artifacts and Coverage Reports

```gitignore
# Test artifacts
web/frontend/test-results/
web/frontend/playwright-report/
web/frontend/.playwright/
coverage/
.nyc_output/
```

These patterns exclude:
- Test snapshots
- Playwright test reports and screenshots
- Code coverage reports

## Best Practices

1. **Be Specific**: Prefer specific patterns over broad ones to avoid accidental exclusion
   - Good: `web/frontend/test-results/`
   - Avoid: `**/test-*/**`

2. **Use Comments**: Group related patterns and add comments to explain why files are excluded

3. **Start with Templates**: Build on established templates for common technologies:
   - [GitHub's gitignore templates](https://github.com/github/gitignore)
   - Language-specific templates (Python, Node.js)
   - Framework-specific templates (Next.js, FastAPI)

4. **Regular Maintenance**: Review and update `.gitignore` when:
   - Adding new technologies to the stack
   - Changing build processes or tooling
   - Finding new types of generated files

5. **Local Gitignore**: For personal preferences that shouldn't affect the team, use:
   - Git's global ignore file (`git config --global core.excludesfile`)
   - `.git/info/exclude` for repository-specific but uncommitted ignores

6. **Handling Previous Commits**: If sensitive files were previously committed:
   ```bash
   git filter-branch --force --index-filter "git rm --cached --ignore-unmatch path/to/file" --prune-empty --tag-name-filter cat -- --all
   ```

## Troubleshooting Common Issues

### File Still Being Tracked After Adding to .gitignore

If files are still tracked despite being in `.gitignore`:

```bash
# Remove file from Git tracking but keep it locally
git rm --cached path/to/file

# For directories
git rm -r --cached path/to/directory
```

### Checking Which Files Would Be Committed

To review what would be committed despite your `.gitignore`:

```bash
git status
```

### Debugging Gitignore Patterns

To check why a file is or isn't being ignored:

```bash
git check-ignore -v path/to/file
```

### Temporarily Including Ignored Files

To include an ignored file in a specific commit:

```bash
git add -f path/to/ignored/file
```

## Example: Complete .gitignore for Auto Shorts Web App

Below is an example of our comprehensive `.gitignore` file:

```gitignore
# Auto Shorts Web App - Gitignore

# Environment variables and secrets
.env
.env.local
.env.development.local
.env.test.local
.env.production.local
!.env.example

# Python
__pycache__/
*.py[cod]
*$py.class
.Python
env/
build/
develop-eggs/
dist/
downloads/
eggs/
.eggs/
lib/
lib64/
parts/
sdist/
var/
wheels/
*.egg-info/
.installed.cfg
*.egg

# Node.js
node_modules/
npm-debug.log*
yarn-debug.log*
yarn-error.log*
.npm
.yarn
.pnp.*

# Next.js
.next/
out/

# Testing
web/frontend/test-results/
web/frontend/playwright-report/
.coverage
htmlcov/
.tox/
.pytest_cache/

# IDE / Editors
.vscode/*
!.vscode/extensions.json
!.vscode/settings.json.example
!.vscode/launch.json
.idea/
*.swp
*.swo

# macOS
.DS_Store

# Windows
Thumbs.db
ehthumbs.db
Desktop.ini

# Application specific
media/processed/
uploads/
temp/
generated-videos/

# Docker
docker-volumes/
.docker/

# Build artifacts
build/
dist/
*.tsbuildinfo

# Logs
logs/
*.log
```

---

By following these guidelines, we ensure our repository remains clean, secure, and efficient. This approach prevents bloating with unnecessary files, avoids the accidental commitment of secrets, and improves developer experience by reducing noise in git diffs and pull requests. 