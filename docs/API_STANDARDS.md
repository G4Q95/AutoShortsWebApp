# Auto Shorts Web App - API Standards

## API Response Format

All API responses follow a standardized format to ensure consistency and make client-side handling more predictable.

### Success Response Format

```json
{
  "success": true,
  "message": "OK",
  "data": {
    // The actual response payload varies by endpoint
  },
  "timestamp": "2023-03-12T10:30:45.123Z"
}
```

The standard success response includes:

| Field | Type | Description |
|-------|------|-------------|
| `success` | boolean | Always `true` for successful responses |
| `message` | string | A descriptive message (e.g., "OK", "Created", "No Content") |
| `data` | object | The actual response payload, which varies by endpoint |
| `timestamp` | string | ISO 8601 formatted timestamp of when the response was generated |

### Error Response Format

```json
{
  "success": false,
  "message": "The error message describing what went wrong",
  "error": {
    "status_code": 400,
    "error_code": "validation_error",
    "details": [
      {
        "loc": ["body", "field_name"],
        "msg": "Field-specific error message",
        "type": "value_error"
      }
    ]
  },
  "timestamp": "2023-03-12T10:30:45.123Z"
}
```

The standard error response includes:

| Field | Type | Description |
|-------|------|-------------|
| `success` | boolean | Always `false` for error responses |
| `message` | string | A human-readable error message |
| `error` | object | Details about the error |
| `error.status_code` | number | HTTP status code |
| `error.error_code` | string | A machine-readable error code (see Error Codes section) |
| `error.details` | array | Optional array of detailed error information |
| `timestamp` | string | ISO 8601 formatted timestamp of when the error occurred |

## Frontend API Client

The frontend uses a standardized API client located in `web/frontend/src/lib/api-client.ts` to interact with the backend. This client provides:

- Consistent error handling
- Request timeouts
- Response formatting
- Development logging
- API health monitoring

### Basic Usage

```typescript
import { fetchAPI } from '../lib/api-client';

// Example: Fetch data from an endpoint
const response = await fetchAPI('/api/v1/some-endpoint');
if (response.error) {
  // Handle error
  console.error('Error:', response.error.message);
} else {
  // Use the data
  const data = response.data;
}
```

### Response Types

All API responses are wrapped in the `ApiResponse<T>` type:

```typescript
interface ApiResponse<T> {
  data: T;
  error?: ApiError;
  timing: {
    start: number;
    end: number;
    duration: number;
  };
  connectionInfo: {
    success: boolean;
    server: string;
    status: number;
    statusText: string;
  };
}
```

## Backend API Implementation

The backend implements the standardized API response format using middleware that intercepts and formats all responses. This ensures consistency without requiring each endpoint to explicitly format its responses.

### Middleware

The `ApiResponseMiddleware` in `web/backend/app/core/middleware.py` automatically:

1. Wraps successful responses in the standard format
2. Formats error responses using the standard error format
3. Passes through binary or streaming responses unchanged
4. Excludes documentation endpoints from standardization

### Error Handling

Backend errors are handled using custom exception classes defined in `web/backend/app/core/errors.py`. These exceptions are automatically caught and formatted into the standard error response.

Example of creating an error response in backend code:

```python
from app.core.errors import ValidationError

# Raise a standardized error
raise ValidationError(
    message="Invalid input parameters",
    details=[
        {
            "loc": ["body", "url"],
            "msg": "Invalid URL format",
            "type": "value_error.url"
        }
    ]
)
```

## Error Codes

The system uses standardized error codes to provide more specific information about errors. These codes are defined in `ErrorCodes` in `web/backend/app/core/errors.py`.

### Resource Errors

| Error Code | Description | HTTP Status |
|------------|-------------|-------------|
| `resource_not_found` | The requested resource does not exist | 404 |
| `resource_already_exists` | Resource creation failed because it already exists | 409 |
| `resource_conflict` | Operation failed due to a conflict with the current state of the resource | 409 |

### Validation Errors

| Error Code | Description | HTTP Status |
|------------|-------------|-------------|
| `validation_error` | Input validation failed | 422 |
| `invalid_parameters` | The provided parameters are invalid | 400 |
| `missing_parameters` | Required parameters are missing | 400 |

### Authentication Errors

| Error Code | Description | HTTP Status |
|------------|-------------|-------------|
| `authentication_required` | Authentication is required to access this resource | 401 |
| `authentication_failed` | Authentication credentials are invalid | 401 |
| `authentication_expired` | Authentication has expired | 401 |
| `invalid_authentication` | Authentication is invalid | 401 |

### Authorization Errors

| Error Code | Description | HTTP Status |
|------------|-------------|-------------|
| `permission_denied` | User does not have permission to perform the action | 403 |
| `access_forbidden` | Access to the resource is forbidden | 403 |

### Action Errors

| Error Code | Description | HTTP Status |
|------------|-------------|-------------|
| `action_failed` | The requested action failed | 400 |
| `action_limit_reached` | Usage limit for this action has been reached | 429 |
| `action_not_allowed` | The requested action is not allowed | 403 |

### Integration Errors

| Error Code | Description | HTTP Status |
|------------|-------------|-------------|
| `integration_error` | Error with an integrated service | 500 |
| `api_error` | Error communicating with an external API | 500 |
| `external_service_error` | External service error | 500 |

### Database Errors

| Error Code | Description | HTTP Status |
|------------|-------------|-------------|
| `database_error` | General database error | 500 |
| `database_connection_error` | Database connection error | 500 |
| `database_query_error` | Database query error | 500 |

### Media Processing Errors

| Error Code | Description | HTTP Status |
|------------|-------------|-------------|
| `media_processing_error` | Error processing media | 500 |
| `media_not_supported` | Media format is not supported | 400 |
| `media_too_large` | Media size exceeds the allowed limit | 400 |

### Content Errors

| Error Code | Description | HTTP Status |
|------------|-------------|-------------|
| `content_extraction_error` | Error extracting content from URL | 500 |
| `content_not_found` | Content not found at the specified URL | 404 |
| `content_processing_error` | Error processing content | 500 |

### System Errors

| Error Code | Description | HTTP Status |
|------------|-------------|-------------|
| `system_error` | General system error | 500 |
| `internal_server_error` | Internal server error | 500 |
| `service_unavailable` | Service is temporarily unavailable | 503 |
| `timeout_error` | Operation timed out | 504 |
| `rate_limit_exceeded` | Rate limit has been exceeded | 429 |

## Common Frontend Error Handling Patterns

The frontend uses the `formatApiError` function from `web/frontend/src/lib/error-utils.ts` to convert API errors into a standardized format for display to users.

### Example of Error Handling in React Components

```typescript
import { useCallback, useState } from 'react';
import { extractContent } from '../lib/api-client';
import { formatApiError } from '../lib/error-utils';

const ContentExtractor = () => {
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    
    try {
      const response = await extractContent(url);
      
      if (response.error) {
        const formattedError = formatApiError(response);
        setError(formattedError.message);
      } else {
        // Process successful response
      }
    } catch (err) {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [url]);
  
  return (
    <form onSubmit={handleSubmit}>
      {/* Form UI */}
      {error && <div className="error-message">{error}</div>}
    </form>
  );
};
```

## API Status Codes

The API uses standard HTTP status codes to indicate the success or failure of requests:

| Status Code | Description |
|-------------|-------------|
| 200 | OK - The request was successful |
| 201 | Created - A new resource was successfully created |
| 204 | No Content - The request was successful but there is no content to return |
| 400 | Bad Request - The request was malformed or invalid |
| 401 | Unauthorized - Authentication is required or failed |
| 403 | Forbidden - The authenticated user does not have permission to access the resource |
| 404 | Not Found - The requested resource does not exist |
| 409 | Conflict - The request could not be completed due to a conflict with the current state of the resource |
| 422 | Unprocessable Entity - The request was well-formed but semantically invalid |
| 429 | Too Many Requests - The user has sent too many requests in a given amount of time |
| 500 | Internal Server Error - An unexpected error occurred on the server |
| 503 | Service Unavailable - The service is temporarily unavailable |
| 504 | Gateway Timeout - The server did not receive a timely response from an upstream server | 