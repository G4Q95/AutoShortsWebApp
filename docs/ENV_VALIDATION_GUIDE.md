# Environment Variable Validation Guide for Auto Shorts Web App

This guide outlines the environment variable validation system implemented in the Auto Shorts Web App project. It explains how validation works, which variables are required, and how to troubleshoot configuration issues.

## Table of Contents

1. [Introduction to Environment Variable Validation](#introduction-to-environment-variable-validation)
2. [Required Environment Variables](#required-environment-variables)
3. [Backend Validation Implementation](#backend-validation-implementation)
4. [Frontend Validation Implementation](#frontend-validation-implementation)
5. [Error Messages and Troubleshooting](#error-messages-and-troubleshooting)
6. [Development vs. Production Considerations](#development-vs-production-considerations)
7. [Extending the Validation System](#extending-the-validation-system)
8. [Best Practices](#best-practices)

## Introduction to Environment Variable Validation

Environment variable validation is a critical safeguard in our application that ensures all necessary configuration is in place before the application starts. This prevents runtime errors that might occur deep in the application logic due to missing or invalid configuration.

Our validation system:
- Checks for the presence of required variables
- Validates the format of critical variables
- Provides clear error messages when validation fails
- Sets sensible defaults for optional variables in development environments

## Required Environment Variables

### Backend (Python/FastAPI)

#### Required for All Environments
- `MONGODB_URI`: MongoDB connection string
- `NEXT_PUBLIC_API_URL`: URL for the frontend to reach the backend API

#### Required for Production
- `CLOUDFLARE_ACCOUNT_ID`: For R2 storage integration
- `CLOUDFLARE_ACCESS_KEY_ID`: For R2 storage authentication
- `CLOUDFLARE_SECRET_ACCESS_KEY`: For R2 storage authentication
- `CLOUDFLARE_R2_BUCKET`: Target bucket for media storage

#### Recommended (Optional in Development)
- `OPENAI_API_KEY`: For AI features
- `ELEVENLABS_API_KEY`: For voice generation

### Frontend (Next.js)

#### Required for All Environments
- `NEXT_PUBLIC_API_URL`: URL for the frontend to reach the backend API

#### Required for Production
- `NEXT_PUBLIC_SITE_URL`: The public-facing URL of the frontend

#### Recommended (Optional in Development)
- `NEXT_PUBLIC_GOOGLE_ANALYTICS_ID`: For analytics

## Backend Validation Implementation

The backend validation is implemented in `app/core/env_validator.py` and follows these steps:

1. **Define Required Variables**:
```python
# Define required environment variables with their descriptions
REQUIRED_VARS = {
    "MONGODB_URI": "MongoDB connection string",
}

# Define optional but recommended variables
RECOMMENDED_VARS = {
    "OPENAI_API_KEY": "OpenAI API key for text rewriting",
    "ELEVENLABS_API_KEY": "ElevenLabs API key for voice generation",
    "CLOUDFLARE_R2_ENDPOINT": "Cloudflare R2 endpoint for storage",
    "CLOUDFLARE_R2_ACCESS_KEY_ID": "Cloudflare R2 access key ID",
    "CLOUDFLARE_R2_SECRET_ACCESS_KEY": "Cloudflare R2 secret access key",
}
```

2. **Check Presence**:
```python
def validate_environment_variables(exit_on_failure: bool = True) -> Tuple[bool, List[str]]:
    """
    Validate that all required environment variables are set.
    
    Args:
        exit_on_failure: Whether to exit the application if validation fails
        
    Returns:
        Tuple containing:
        - Boolean indicating if validation passed
        - List of missing variable names
    """
    missing_vars = []
    
    # Check required variables
    for var_name, description in REQUIRED_VARS.items():
        if not os.getenv(var_name):
            missing_vars.append(var_name)
            logger.error(f"Missing required environment variable: {var_name} - {description}")
    
    # Check recommended variables and log warnings
    for var_name, description in RECOMMENDED_VARS.items():
        if not os.getenv(var_name):
            logger.warning(f"Missing recommended environment variable: {var_name} - {description}")
    
    # If any required variables are missing, either exit or return failure
    if missing_vars and exit_on_failure:
        logger.critical("Application startup failed due to missing required environment variables")
        print("\n===== ENVIRONMENT VALIDATION FAILED =====")
        print("The following required environment variables are missing:")
        for var_name in missing_vars:
            print(f"  - {var_name}: {REQUIRED_VARS[var_name]}")
        print("\nPlease add these variables to your .env file or environment.")
        print("See .env.example for reference.")
        print("==========================================\n")
        sys.exit(1)
    
    return len(missing_vars) == 0, missing_vars
```

3. **Format Validation**:
```python
def validate_mongodb_uri(uri: Optional[str]) -> bool:
    """
    Validate MongoDB URI format.
    
    Args:
        uri: MongoDB URI string to validate
        
    Returns:
        True if valid, False otherwise
    """
    if not uri:
        return False
    
    # Basic format validation - should start with mongodb:// or mongodb+srv://
    if not (uri.startswith("mongodb://") or uri.startswith("mongodb+srv://")):
        logger.error("Invalid MongoDB URI format. Must start with mongodb:// or mongodb+srv://")
        return False
    
    return True
```

4. **Environment Status Display**:
```python
def print_env_status() -> None:
    """
    Print the status of environment variables for debugging.
    Hides sensitive information.
    """
    print("\n===== ENVIRONMENT VARIABLE STATUS =====")
    
    all_vars = {**REQUIRED_VARS, **RECOMMENDED_VARS}
    for var_name, description in all_vars.items():
        value = os.getenv(var_name)
        if value:
            # Mask sensitive values
            if any(sensitive_term in var_name.lower() for sensitive_term in ["key", "secret", "password", "token"]):
                display_value = f"{value[:3]}...{value[-3:]}" if len(value) > 10 else "***"
            else:
                display_value = value
            
            status = "✅ SET"
        else:
            display_value = "NOT SET"
            status = "❌ MISSING" if var_name in REQUIRED_VARS else "⚠️ RECOMMENDED"
        
        print(f"{status}: {var_name} - {display_value}")
    
    print("=======================================\n")
```

## Frontend Validation Implementation

Frontend validation is implemented in `src/lib/env-validator.ts` and a React component:

1. **Define Required Variables**:
```typescript
// Define required environment variables with descriptions
const REQUIRED_VARS = {
  'NEXT_PUBLIC_API_URL': 'Backend API URL for requests',
};

// Define optional but recommended variables
const RECOMMENDED_VARS = {
  // Add optional variables if needed
};
```

2. **Validation Function**:
```typescript
export const validateEnvironmentVariables = () => {
  const missingVars: string[] = [];
  
  // Check required variables
  Object.entries(REQUIRED_VARS).forEach(([varName, description]) => {
    if (!process.env[varName]) {
      missingVars.push(varName);
      console.error(`Missing required environment variable: ${varName} - ${description}`);
    }
  });
  
  // Check recommended variables
  Object.entries(RECOMMENDED_VARS).forEach(([varName, description]) => {
    if (!process.env[varName]) {
      console.warn(`Missing recommended environment variable: ${varName} - ${description}`);
    }
  });
  
  // If any required variables are missing, display a clear error
  if (missingVars.length > 0) {
    console.error('===== ENVIRONMENT VALIDATION FAILED =====');
    console.error('The following required environment variables are missing:');
    missingVars.forEach(varName => {
      console.error(`  - ${varName}: ${REQUIRED_VARS[varName]}`);
    });
    console.error('\nPlease add these variables to your .env.local file or environment.');
    console.error('See .env.example for reference.');
    console.error('==========================================');
  }
  
  return {
    isValid: missingVars.length === 0,
    missingVars,
  };
};
```

3. **URL Format Validation**:
```typescript
export const validateApiUrl = (url: string | undefined): boolean => {
  if (!url) return false;
  
  try {
    // Basic validation - should be a valid URL with http(s) protocol
    const parsedUrl = new URL(url);
    return parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:';
  } catch (error) {
    console.error(`Invalid API URL format: ${url}`);
    return false;
  }
};
```

4. **Initialization Function**:
```typescript
export const initEnvironmentValidation = (): void => {
  const { isValid } = validateEnvironmentVariables();
  
  // Only print environment status in development
  if (process.env.NODE_ENV === 'development') {
    printEnvStatus();
  }
  
  // If environment validation fails, we don't crash the app but we do show a warning
  if (!isValid) {
    console.error('Application may not function correctly due to missing environment variables');
  }
  
  // Validate API URL format
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  if (apiUrl && !validateApiUrl(apiUrl)) {
    console.error(`Invalid API URL format: ${apiUrl}`);
  }
};
```

5. **React Component for UI Feedback**:
```tsx
'use client';

import { useEffect, useState } from 'react';
import { initEnvironmentValidation } from '@/lib/env-validator';

/**
 * Environment Validator Component
 * 
 * This component runs environment validation during initial client-side rendering
 * and displays an error message if validation fails.
 */
export default function EnvironmentValidator() {
  const [validationFailed, setValidationFailed] = useState(false);

  useEffect(() => {
    try {
      // Initialize environment validation
      initEnvironmentValidation();
    } catch (error) {
      console.error('Environment validation threw an exception:', error);
      setValidationFailed(true);
    }
  }, []);

  // Only render something if validation fails
  if (!validationFailed) {
    return null;
  }

  // Error UI for missing environment variables
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-red-600 text-white p-4 z-50">
      <div className="container mx-auto">
        <h3 className="text-xl font-bold mb-2">⚠️ Environment Configuration Issue</h3>
        <p>
          Missing or invalid environment variables detected. Check the browser console for details.
          The application may not function correctly.
        </p>
      </div>
    </div>
  );
}
```

## Error Messages and Troubleshooting

### Common Error Messages

1. **Missing Required Variables**:
```
Missing required environment variables: MONGODB_URI, NEXT_PUBLIC_API_URL
```
Solution: Add the missing variables to your .env or .env.local file.

2. **Invalid MongoDB URI Format**:
```
Invalid MONGODB_URI format
```
Solution: Check that your MongoDB URI follows the format: `mongodb+srv://username:password@cluster.mongodb.net/database?retryWrites=true&w=majority`

3. **Frontend Environment Error**:
If you see a red banner at the top of the page listing missing variables, check your .env.local file and restart the Next.js server.

### Troubleshooting Steps

1. **Verify Environment Files**:
   - Backend: Check `.env` file in the project root
   - Frontend: Check `.env.local` file in the web/frontend directory

2. **Check for Syntax Errors**:
   - Environment variables should not have spaces around the equals sign
   - No quotes are needed for most values

3. **Restart Services**:
   - Changes to environment files require restarting the services
   - For Docker: `docker-compose down && docker-compose up`
   - For local development: restart the respective servers

4. **Development Mode Workarounds**:
   - In development, some validations will show warnings but not halt the application
   - Check the console for warning messages

## Development vs. Production Considerations

### Development Environment

In development mode, the application is more forgiving:
- Some production-only variables are not required
- Warnings are displayed instead of halting the application
- Local mock implementations may be used when services are unavailable

### Production Environment

In production, validation is strict:
- All required variables must be present
- Format validation must pass
- The application will not start if validation fails
- No fallbacks or mock implementations are used

## Extending the Validation System

When adding new environment variables to the project:

1. **Update Validator Files**:
   - Add new required variables to the lists in both backend and frontend validators
   - Include format validation for critical variables

2. **Update Documentation**:
   - Add the new variable to this guide
   - Update `.env.example` with the new variable and description

3. **Update Tests**:
   - Add test cases for new validation logic
   - Mock the new environment variables in test setup

## Best Practices

1. **Keep Sensitive Information Safe**:
   - Never commit real environment values to the repository
   - Use `.env.example` to document variables without showing real values
   - Consider using a secrets management service in production

2. **Descriptive Variable Names**:
   - Use the service name as a prefix (e.g., `MONGODB_URI`, `CLOUDFLARE_ACCOUNT_ID`)
   - Make the purpose clear in the name
   - Use `NEXT_PUBLIC_` prefix for variables that should be exposed to the browser

3. **Validation Location**:
   - Validate as early as possible in the application lifecycle
   - Use startup events for server validation
   - Use component mounting for frontend validation

4. **Error Messages**:
   - Make error messages actionable and clear
   - Include instructions for resolving the issue
   - Don't expose sensitive information in error messages

---

By following this guide, you can ensure your environment configuration is properly validated, preventing runtime errors and improving the developer experience. 