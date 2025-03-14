'use client';

import { useEffect, useState } from 'react';
import { initEnvironmentValidation, isTestEnvironment } from '@/lib/env-validator';

/**
 * Environment Validator Component
 * 
 * This component runs environment validation during initial client-side rendering
 * and displays an error message if validation fails.
 * In test environments, it provides default values for required environment variables.
 */
export default function EnvironmentValidator() {
  const [validationFailed, setValidationFailed] = useState(false);

  useEffect(() => {
    // Skip validation in test environments
    if (isTestEnvironment()) {
      console.log('Test environment detected - skipping strict environment validation');
      return;
    }

    try {
      // Initialize environment validation
      initEnvironmentValidation();
    } catch (error) {
      console.error('Environment validation threw an exception:', error);
      setValidationFailed(true);
    }
  }, []);

  // Only render something if validation fails and we're not in a test
  if (!validationFailed || isTestEnvironment()) {
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