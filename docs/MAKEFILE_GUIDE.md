# Makefile Guide for Auto Shorts Web App

This document explains how to use the Makefile to streamline development tasks in the Auto Shorts Web App project.

## What is a Makefile?

A Makefile is a configuration file that defines a set of tasks to be executed using the `make` command. It simplifies complex commands into short, memorable aliases, making development workflows more efficient and consistent.

## Prerequisites

- Make sure you have `make` installed on your system:
  - **macOS**: Comes pre-installed or install with Homebrew: `brew install make`
  - **Linux**: Install with your package manager (e.g., `apt install make` on Ubuntu)
  - **Windows**: Install via WSL or [chocolatey](https://chocolatey.org/): `choco install make`

## Getting Started

To see all available commands:

```bash
make help
```

This will display a list of all commands with their descriptions.

## Command Categories

### Docker Management

| Command | Description |
|---------|-------------|
| `make up` | Start all Docker containers |
| `make up-build` | Start all Docker containers with a rebuild |
| `make down` | Stop all Docker containers |
| `make restart` | Restart all Docker containers |
| `make logs` | View Docker container logs |
| `make logs-frontend` | View frontend container logs |
| `make logs-backend` | View backend container logs |

### Development

| Command | Description |
|---------|-------------|
| `make install` | Install all dependencies (frontend, backend, pre-commit) |
| `make frontend` | Start the frontend development server |
| `make backend` | Start the backend development server |
| `make browser-tools` | Start the browser tools server |
| `make start-all` | Start all services without Docker |

### Testing

| Command | Description |
|---------|-------------|
| `make test` | Run all Playwright tests |
| `make test-debug` | Run tests in debug mode |
| `make test-report` | Show the last test report |

### Code Quality

| Command | Description |
|---------|-------------|
| `make format` | Format all code using the formatter script |
| `make lint` | Lint frontend and backend code |
| `make lint-fix` | Fix linting issues where possible |

### Building

| Command | Description |
|---------|-------------|
| `make build-frontend` | Build the frontend for production |
| `make build-backend` | Check backend build |
| `make build` | Build the entire application |

### Utilities

| Command | Description |
|---------|-------------|
| `make clean` | Clean up temporary files and caches |
| `make env-setup` | Set up environment files from examples |
| `make check-env` | Check environment configuration |
| `make reset-db` | Reset the development database |
| `make dev-setup` | Complete development environment setup |

## Common Workflows

### Initial Project Setup

```bash
make dev-setup
```

This command:
1. Sets up environment files from examples
2. Installs all dependencies
3. Sets up pre-commit hooks

### Daily Development

Start the application with Docker:

```bash
make up
```

Or start services individually:

```bash
make frontend  # Terminal 1
make backend   # Terminal 2
make browser-tools  # Terminal 3
```

### Before Committing Code

```bash
make format
make lint
make test
```

### Cleaning Up

```bash
make clean
make down
```

## Extending the Makefile

To add new commands, edit the `Makefile` and follow the existing pattern:

```makefile
.PHONY: your-command
your-command: ## Your command description
	$(call log,Doing something...)
	@your-command-here
	$(call success,Done!)
```

Remember to:
1. Add `.PHONY` to avoid conflicts with files
2. Add a description after `##` to make it appear in `make help`
3. Use the helper functions (`log`, `success`, `warn`, `error`) for consistent output

## Troubleshooting

### Command Not Found

If you see an error like `make: command not found`, make sure you have installed `make` correctly.

### Recipe Failed

If a command fails with an error message, check:
1. That all prerequisites (like Docker, npm, etc.) are installed
2. Your environment files are properly configured
3. The services it depends on are running

If you need to see more details about what's happening, you can add the `V=1` flag:

```bash
make V=1 your-command
```

This will show the full command being executed.

## Best Practices

1. **Always use `make help`** to discover available commands
2. **Run `make check-env`** after changing environment files
3. **Use `make lint` and `make format`** before committing code
4. **Check `make test`** after making changes to ensure tests pass 