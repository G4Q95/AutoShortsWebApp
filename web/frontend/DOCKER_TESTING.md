# Docker Testing Guide

This guide explains how to run Playwright tests in the Docker environment. Running tests in Docker ensures consistent behavior across different environments and prevents issues with port conflicts.

## Prerequisites

- Docker and docker-compose installed
- Project containers running (`docker-compose up -d`)

## Critical Docker Configuration

### API URL Configuration

The most important part of testing in Docker is using the correct API URL. Tests must use the Docker container name instead of localhost:

```
NEXT_PUBLIC_API_URL=http://backend:8000
```

NOT ❌:
```
NEXT_PUBLIC_API_URL=http://localhost:8000
```

This is because each Docker container has its own network namespace, and "localhost" refers to the container itself, not the host machine. The `run-tests.sh` script automatically sets this environment variable correctly.

## Running Tests

We provide a simple helper script to run tests with the correct Docker settings. You can use it in two ways:

### 1. Run all tests

```bash
docker-compose exec frontend bash -c "./run-tests.sh"
```

### 2. Run specific tests by pattern

```bash
docker-compose exec frontend bash -c "./run-tests.sh 'Home page loads correctly'"
```

Or another example:

```bash
docker-compose exec frontend bash -c "./run-tests.sh 'Project creation'"
```

## Viewing Test Results

### HTML Report

To view the visual test report, run:

```bash
docker-compose exec frontend npx playwright show-report
```

This will start a server on port 9323 that you can access in your browser at: http://localhost:9323

### Test Artifacts

Test screenshots, videos, and logs are saved in the `test-results` directory inside the container. You can view them with:

```bash
docker-compose exec frontend ls -la test-results/
```

Or copy a specific file from the container:

```bash
docker cp autoshortswebapp-frontend-1:/app/test-results/my-screenshot.png ./
```

## Troubleshooting

### Timeouts

If tests are failing with timeout errors, you might need to:

1. Check the `playwright.config.ts` file for appropriate timeout settings
2. Check the timeout constants in `core-functionality.spec.ts`
3. Make sure Docker networking is correctly configured (the API URL should point to `http://backend:8000`)
4. Verify that all services are running with `docker-compose ps`

### Network Issues

If tests fail due to network issues:

1. Ensure the `NEXT_PUBLIC_API_URL` in the test environment is set to `http://backend:8000`
2. Check that the backend service is accessible from the frontend container:
   ```bash
   docker-compose exec frontend curl -I http://backend:8000/health
   ```

### Viewing Logs

To view logs from the containers:

```bash
docker-compose logs -f frontend
docker-compose logs -f backend
docker-compose logs -f browser-tools
```

### Restarting Services

If you need to restart services:

```bash
docker-compose restart frontend
docker-compose restart backend
docker-compose restart browser-tools
```

Or restart everything:

```bash
docker-compose down
docker-compose up -d
```

## Cleaning Up

To clean up all test artifacts:

```bash
docker-compose exec frontend rm -rf test-results/*
```

## Advanced: Debugging with Visual Studio Code

If you need to debug tests interactively:

1. Install the [Docker extension](https://marketplace.visualstudio.com/items?itemName=ms-azuretools.vscode-docker) for VS Code
2. Attach to the running frontend container:
   - Click the Docker icon in the VS Code sidebar
   - Right-click on the running frontend container
   - Select "Attach Shell"
3. Once connected to the container, you can run:
   ```bash
   PWDEBUG=1 npx playwright test tests/e2e/core-functionality.spec.ts
   ```
   This will open the Playwright inspector for interactive debugging. 