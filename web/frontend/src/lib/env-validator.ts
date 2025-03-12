/**
 * Environment variable validation module for frontend
 * 
 * This module provides functions to validate environment variables
 * and ensure all required variables are present with valid formats.
 */

// Define required environment variables with descriptions
const REQUIRED_VARS = {
  'NEXT_PUBLIC_API_URL': 'Backend API URL for requests',
};

// Define optional but recommended variables
const RECOMMENDED_VARS = {
  // Add optional variables if needed
};

/**
 * Validates that all required environment variables are set
 * 
 * @returns {Object} Validation results
 */
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
      // @ts-ignore - We know the key exists
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

/**
 * Validates the API URL format
 * 
 * @param {string} url - API URL to validate
 * @returns {boolean} True if valid, false otherwise
 */
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

/**
 * Prints the status of environment variables for debugging
 * Automatically masks sensitive variables
 */
export const printEnvStatus = (): void => {
  console.log('===== FRONTEND ENVIRONMENT VARIABLE STATUS =====');
  
  const allVars = { ...REQUIRED_VARS, ...RECOMMENDED_VARS };
  
  Object.entries(allVars).forEach(([varName, description]) => {
    const value = process.env[varName];
    
    let displayValue;
    let status;
    
    if (value) {
      // Mask sensitive values 
      if (/key|secret|password|token/i.test(varName)) {
        displayValue = value.length > 10 ? `${value.substring(0, 3)}...${value.substring(value.length - 3)}` : '***';
      } else {
        displayValue = value;
      }
      
      status = '✅ SET';
    } else {
      displayValue = 'NOT SET';
      status = Object.keys(REQUIRED_VARS).includes(varName) ? '❌ MISSING' : '⚠️ RECOMMENDED';
    }
    
    console.log(`${status}: ${varName} - ${displayValue}`);
  });
  
  console.log('==============================================');
};

/**
 * Initialize environment validation
 * 
 * Call this at application startup to ensure all required variables are present
 */
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