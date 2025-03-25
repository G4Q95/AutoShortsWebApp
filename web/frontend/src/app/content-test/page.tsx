'use client';

import { useState, useCallback } from 'react';
import { fetchAPI } from '@/lib/api-client';
import * as contentAPI from '@/lib/api/content';
import { API_FLAGS, enableAllNewContentAPIs, disableAllNewContentAPIs } from '@/lib/api-flags';
import { 
  createError, 
  ErrorCategory, 
  EnhancedError, 
  categorizeError 
} from '@/lib/error-handling';

/**
 * Content API Test Page
 * 
 * This page provides a UI for testing both the original and new content API implementations
 * side by side to verify they work correctly and return compatible results.
 */
export default function ContentTestPage() {
  const [url, setUrl] = useState('https://www.reddit.com/r/interesting/comments/1j7mwks/sand_that_moves_like_water_in_the_desert/');
  const [validationResult, setValidationResult] = useState<any>(null);
  const [extractionResult, setExtractionResult] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedImplementation, setSelectedImplementation] = useState<'original' | 'new'>('original');
  const [error, setError] = useState<string | null>(null);
  const [enhancedErrorDetails, setEnhancedErrorDetails] = useState<EnhancedError | null>(null);
  const [errorTestType, setErrorTestType] = useState<'network' | 'timeout' | 'validation'>('network');

  // Check the current implementation based on feature flags
  const [flagsEnabled, setFlagsEnabled] = useState({
    useNewContentAPI: API_FLAGS.useNewContentAPI,
    useNewExtractContent: API_FLAGS.useNewExtractContent,
    useNewValidateUrl: API_FLAGS.useNewValidateUrl
  });

  const updateFlagState = useCallback(() => {
    setFlagsEnabled({
      useNewContentAPI: API_FLAGS.useNewContentAPI,
      useNewExtractContent: API_FLAGS.useNewExtractContent,
      useNewValidateUrl: API_FLAGS.useNewValidateUrl
    });
  }, []);

  // Enable all feature flags
  const enableAllFlags = useCallback(() => {
    enableAllNewContentAPIs();
    updateFlagState();
  }, [updateFlagState]);

  // Disable all feature flags
  const disableAllFlags = useCallback(() => {
    disableAllNewContentAPIs();
    updateFlagState();
  }, [updateFlagState]);

  // Test URL validation using original implementation
  const testOriginalValidateUrl = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetchAPI(`/content/validate-url`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url }),
      });
      setValidationResult(response);
    } catch (err) {
      setError(`Original validateUrl error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsLoading(false);
    }
  }, [url]);

  // Test URL validation using new implementation
  const testNewValidateUrl = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await contentAPI.validateUrl(url);
      setValidationResult(response);
    } catch (err) {
      setError(`New validateUrl error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsLoading(false);
    }
  }, [url]);

  // Test content extraction using original implementation
  const testOriginalExtractContent = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetchAPI(`/content/extract?url=${encodeURIComponent(url)}`, {
        method: 'GET',
      });
      setExtractionResult(response);
    } catch (err) {
      setError(`Original extractContent error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsLoading(false);
    }
  }, [url]);

  // Test content extraction using new implementation
  const testNewExtractContent = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await contentAPI.extractContent(url);
      setExtractionResult(response);
    } catch (err) {
      setError(`New extractContent error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsLoading(false);
    }
  }, [url]);

  // Function to call the appropriate test based on selected implementation
  const validateUrl = useCallback(() => {
    if (selectedImplementation === 'original') {
      testOriginalValidateUrl();
    } else {
      testNewValidateUrl();
    }
  }, [selectedImplementation, testOriginalValidateUrl, testNewValidateUrl]);

  // Function to call the appropriate test based on selected implementation
  const extractContent = useCallback(() => {
    if (selectedImplementation === 'original') {
      testOriginalExtractContent();
    } else {
      testNewExtractContent();
    }
  }, [selectedImplementation, testOriginalExtractContent, testNewExtractContent]);

  // Deliberately trigger an error for testing error handling
  const testErrorHandling = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setEnhancedErrorDetails(null);
    
    try {
      let errorResult;
      
      switch (errorTestType) {
        case 'network':
          // Test network error by using an invalid endpoint
          errorResult = await contentAPI.extractContent('https://non-existent-domain-12345.com');
          break;
          
        case 'timeout':
          // Force a timeout error by using a very short timeout
          // This is simulated since we can't actually modify the timeout in the content.ts file from here
          const timeoutError = createError(
            'Request timed out after 10000ms',
            ErrorCategory.TIMEOUT,
            { url: url, timeoutMs: 10000 }
          );
          throw timeoutError;
          
        case 'validation':
          // Test validation error by using an invalid URL format
          errorResult = await contentAPI.validateUrl('not-a-valid-url');
          break;
      }
      
      // Should not reach here if error is thrown as expected
      setExtractionResult(errorResult);
    } catch (err) {
      const enhancedError = err as EnhancedError;
      setError(`${enhancedError.message || 'Unknown error'}`);
      setEnhancedErrorDetails(enhancedError);
    } finally {
      setIsLoading(false);
    }
  }, [errorTestType, url]);

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Content API Test Page</h1>
      
      <div className="bg-slate-100 p-4 rounded-md mb-6">
        <h2 className="text-lg font-semibold mb-2">Feature Flag Status</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="mb-2">
              <span className="font-medium">useNewContentAPI:</span>{' '}
              <span className={flagsEnabled.useNewContentAPI ? 'text-green-600' : 'text-red-600'}>
                {flagsEnabled.useNewContentAPI ? 'Enabled' : 'Disabled'}
              </span>
            </p>
            <p className="mb-2">
              <span className="font-medium">useNewExtractContent:</span>{' '}
              <span className={flagsEnabled.useNewExtractContent ? 'text-green-600' : 'text-red-600'}>
                {flagsEnabled.useNewExtractContent ? 'Enabled' : 'Disabled'}
              </span>
            </p>
            <p className="mb-2">
              <span className="font-medium">useNewValidateUrl:</span>{' '}
              <span className={flagsEnabled.useNewValidateUrl ? 'text-green-600' : 'text-red-600'}>
                {flagsEnabled.useNewValidateUrl ? 'Enabled' : 'Disabled'}
              </span>
            </p>
          </div>
          <div className="flex items-center space-x-4">
            <button
              onClick={enableAllFlags}
              className="px-4 py-2 bg-green-600 text-white rounded-md"
              disabled={isLoading}
            >
              Enable All Flags
            </button>
            <button
              onClick={disableAllFlags}
              className="px-4 py-2 bg-red-600 text-white rounded-md"
              disabled={isLoading}
            >
              Disable All Flags
            </button>
          </div>
        </div>
      </div>

      <div className="mb-6">
        <h2 className="text-lg font-semibold mb-2">Test Settings</h2>
        <div className="flex flex-col space-y-4">
          <div>
            <label htmlFor="url" className="block text-sm font-medium text-gray-700 mb-1">
              URL to Test:
            </label>
            <input
              id="url"
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md"
              placeholder="Enter URL to test"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Implementation to Test:
            </label>
            <div className="flex space-x-4">
              <label className="inline-flex items-center">
                <input
                  type="radio"
                  value="original"
                  checked={selectedImplementation === 'original'}
                  onChange={() => setSelectedImplementation('original')}
                  className="form-radio h-4 w-4 text-indigo-600"
                />
                <span className="ml-2">Original</span>
              </label>
              <label className="inline-flex items-center">
                <input
                  type="radio"
                  value="new"
                  checked={selectedImplementation === 'new'}
                  onChange={() => setSelectedImplementation('new')}
                  className="form-radio h-4 w-4 text-indigo-600"
                />
                <span className="ml-2">New</span>
              </label>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div>
          <h2 className="text-lg font-semibold mb-2">URL Validation</h2>
          <button
            onClick={validateUrl}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-md"
            disabled={isLoading}
          >
            {isLoading ? 'Loading...' : 'Validate URL'}
          </button>
          
          {validationResult && (
            <div className="mt-4 bg-gray-50 p-3 rounded-md">
              <h3 className="font-medium mb-2">Result:</h3>
              <div className="overflow-auto max-h-64">
                <pre className="text-xs">{JSON.stringify(validationResult, null, 2)}</pre>
              </div>
            </div>
          )}
        </div>
        
        <div>
          <h2 className="text-lg font-semibold mb-2">Content Extraction</h2>
          <button
            onClick={extractContent}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-md"
            disabled={isLoading}
          >
            {isLoading ? 'Loading...' : 'Extract Content'}
          </button>
          
          {extractionResult && (
            <div className="mt-4 bg-gray-50 p-3 rounded-md">
              <h3 className="font-medium mb-2">Result:</h3>
              <div className="overflow-auto max-h-64">
                <pre className="text-xs">{JSON.stringify(extractionResult, null, 2)}</pre>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="mt-8 mb-6">
        <h2 className="text-xl font-semibold mb-4">Error Handling Testing</h2>
        <div className="bg-gray-50 p-4 rounded-md">
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Error Type to Test:
            </label>
            <div className="flex space-x-4">
              <label className="inline-flex items-center">
                <input
                  type="radio"
                  value="network"
                  checked={errorTestType === 'network'}
                  onChange={() => setErrorTestType('network')}
                  className="form-radio h-4 w-4 text-indigo-600"
                />
                <span className="ml-2">Network Error</span>
              </label>
              <label className="inline-flex items-center">
                <input
                  type="radio"
                  value="timeout"
                  checked={errorTestType === 'timeout'}
                  onChange={() => setErrorTestType('timeout')}
                  className="form-radio h-4 w-4 text-indigo-600"
                />
                <span className="ml-2">Timeout Error</span>
              </label>
              <label className="inline-flex items-center">
                <input
                  type="radio"
                  value="validation"
                  checked={errorTestType === 'validation'}
                  onChange={() => setErrorTestType('validation')}
                  className="form-radio h-4 w-4 text-indigo-600"
                />
                <span className="ml-2">Validation Error</span>
              </label>
            </div>
          </div>
          
          <button
            onClick={testErrorHandling}
            className="px-4 py-2 bg-purple-600 text-white rounded-md"
            disabled={isLoading}
          >
            {isLoading ? 'Testing...' : 'Test Error Handling'}
          </button>
          
          {enhancedErrorDetails && (
            <div className="mt-4">
              <h3 className="font-medium mb-2">Enhanced Error Details:</h3>
              <div className="bg-red-50 p-3 rounded-md border border-red-200">
                <p className="mb-1">
                  <span className="font-semibold">Message:</span> {enhancedErrorDetails.message}
                </p>
                <p className="mb-1">
                  <span className="font-semibold">Category:</span>{' '}
                  <span className="px-2 py-1 bg-red-100 rounded text-xs font-medium">
                    {enhancedErrorDetails.category || 'UNKNOWN'}
                  </span>
                </p>
                {enhancedErrorDetails.timestamp && (
                  <p className="mb-1">
                    <span className="font-semibold">Time:</span>{' '}
                    {new Date(enhancedErrorDetails.timestamp).toLocaleTimeString()}
                  </p>
                )}
                {enhancedErrorDetails.details && (
                  <div className="mb-1">
                    <span className="font-semibold">Details:</span>
                    <pre className="text-xs mt-1 bg-red-50 p-2 rounded">
                      {JSON.stringify(enhancedErrorDetails.details, null, 2)}
                    </pre>
                  </div>
                )}
                {enhancedErrorDetails.originalError && (
                  <div className="mb-1">
                    <span className="font-semibold">Original Error:</span>
                    <pre className="text-xs mt-1 bg-red-50 p-2 rounded">
                      {enhancedErrorDetails.originalError.message}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-100 text-red-800 rounded-md">
          <h3 className="font-medium mb-1">Error:</h3>
          <p>{error}</p>
        </div>
      )}
    </div>
  );
} 