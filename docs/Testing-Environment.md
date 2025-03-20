# Testing Environment Configuration

## Running Tests

When running Playwright tests for the Auto Shorts Web App, it's important to follow these guidelines to ensure consistent test results.

### Host Machine Testing (Recommended)

Run tests from your host machine, not from inside Docker containers:

```bash
# From the host machine
cd web/frontend && NEXT_PUBLIC_API_URL=http://localhost:8000 NEXT_PUBLIC_MOCK_AUDIO=true npm test
```

This approach allows the test to properly connect to the Docker services via the published ports:
- Frontend: localhost:3000
- Backend: localhost:8000
- Browser-tools-server: localhost:3025

### Known Issues

Running tests from inside the Docker container may result in connectivity issues between containers:

```
Error fetching stored audio: {status_code: 503, message: Could not connect to the backend server. Please ensure the server is running.}
Failed to load resource: net::ERR_CONNECTION_REFUSED
API Error: TypeError: Failed to fetch
```

This occurs because the container network configuration requires special handling for internal test networking that is outside the scope of the standard Docker Compose setup.

### Test Configuration

For consistent testing, always use these environment variables:

- `NEXT_PUBLIC_MOCK_AUDIO=true` - Uses mock audio to avoid consuming API credits
- `NEXT_PUBLIC_API_URL=http://localhost:8000` - Ensures tests connect to the correct backend endpoint
- `NEXT_PUBLIC_TESTING_MODE=true` - Enables additional test hooks for Playwright

### Running Tests with Real API

When testing with real API calls, use:

```bash
cd web/frontend && NEXT_PUBLIC_MOCK_AUDIO=false npm test
```

**Warning:** This will consume real API credits. 