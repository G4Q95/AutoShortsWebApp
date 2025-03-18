import React, { useState, useEffect } from 'react';
import { extractContent } from '@/lib/api-client';
import { validateUrl } from '@/lib/api/content';
import { enableAllNewContentAPIs, disableAllNewContentAPIs } from '@/lib/api-flags';
import { ApiResponse } from '@/lib/api-types';

export default function ApiTest() {
  const [url, setUrl] = useState('https://www.reddit.com/r/mildlyinteresting/comments/1j8mkup/slug_on_our_wall_has_a_red_triangle_on_its_back/');
  const [useNewApi, setUseNewApi] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [validateResult, setValidateResult] = useState<ApiResponse<any> | null>(null);
  const [extractResult, setExtractResult] = useState<ApiResponse<any> | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Toggle feature flags based on the checkbox
  useEffect(() => {
    try {
      if (useNewApi) {
        enableAllNewContentAPIs();
        console.log('Enabled new Content API implementations');
      } else {
        disableAllNewContentAPIs();
        console.log('Disabled new Content API implementations');
      }
    } catch (err) {
      console.error('Error toggling API implementations:', err);
      setError(`Failed to toggle API implementation: ${err instanceof Error ? err.message : String(err)}`);
    }
  }, [useNewApi]);

  const handleValidateUrl = async () => {
    setIsValidating(true);
    setValidateResult(null);
    setError(null);
    
    try {
      console.log(`Testing URL validation with ${useNewApi ? 'new' : 'original'} implementation`);
      const result = await validateUrl(url);
      console.log('Validation result:', result);
      setValidateResult(result);
    } catch (err) {
      console.error('Validation error:', err);
      setError(`Validation error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsValidating(false);
    }
  };

  const handleExtractContent = async () => {
    setIsExtracting(true);
    setExtractResult(null);
    setError(null);
    
    try {
      console.log(`Testing content extraction with ${useNewApi ? 'new' : 'original'} implementation`);
      const result = await extractContent(url);
      console.log('Extraction result:', result);
      setExtractResult(result);
    } catch (err) {
      console.error('Extraction error:', err);
      setError(`Extraction error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsExtracting(false);
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <h1 className="text-2xl font-bold mb-6">API Implementation Test Page</h1>
      
      {error && (
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4" role="alert">
          <p>{error}</p>
        </div>
      )}
      
      <div className="mb-6 p-4 bg-gray-100 rounded">
        <div className="flex items-center mb-4">
          <input
            type="checkbox"
            id="apiToggle"
            checked={useNewApi}
            onChange={(e) => setUseNewApi(e.target.checked)}
            className="mr-2 h-5 w-5"
          />
          <label htmlFor="apiToggle" className="font-medium">
            Use New API Implementation
          </label>
        </div>
        <div className="text-sm text-gray-600">
          Current implementation: <span className="font-semibold">{useNewApi ? 'New' : 'Original'}</span>
        </div>
      </div>
      
      <div className="mb-6">
        <label htmlFor="urlInput" className="block text-sm font-medium text-gray-700 mb-2">
          URL to Test
        </label>
        <input
          type="text"
          id="urlInput"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className="w-full p-2 border border-gray-300 rounded"
        />
      </div>
      
      <div className="flex flex-wrap gap-4 mb-8">
        <button
          onClick={handleValidateUrl}
          disabled={isValidating}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {isValidating ? 'Validating...' : 'Validate URL'}
        </button>
        
        <button
          onClick={handleExtractContent}
          disabled={isExtracting}
          className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:opacity-50"
        >
          {isExtracting ? 'Extracting...' : 'Extract Content'}
        </button>
      </div>
      
      {validateResult && (
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-2">URL Validation Result</h2>
          <pre className="bg-gray-100 p-4 rounded overflow-auto max-h-60">
            {JSON.stringify(validateResult, null, 2)}
          </pre>
        </div>
      )}
      
      {extractResult && (
        <div>
          <h2 className="text-xl font-semibold mb-2">Content Extraction Result</h2>
          <pre className="bg-gray-100 p-4 rounded overflow-auto max-h-96">
            {JSON.stringify(extractResult, null, 2)}
          </pre>
          
          {extractResult.connectionInfo.success && extractResult.data?.media && (
            <div className="mt-4">
              <h3 className="text-lg font-semibold mb-2">Media Preview</h3>
              <div className="h-72 bg-black rounded overflow-hidden">
                {extractResult.data.media.type === 'image' ? (
                  <img
                    src={extractResult.data.media.url}
                    alt="Extracted media"
                    className="h-full w-full object-contain"
                  />
                ) : extractResult.data.media.type === 'video' ? (
                  <video
                    src={extractResult.data.media.url}
                    controls
                    className="h-full w-full object-contain"
                  />
                ) : (
                  <div className="h-full w-full flex items-center justify-center text-white">
                    Unsupported media type: {extractResult.data.media.type}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
} 