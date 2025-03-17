'use client';

import React, { useState } from 'react';
import { extractContent as originalExtractContent } from '@/lib/api-client';
import { extractContent as newExtractContent } from '@/lib/api/content';

/**
 * API Test Page
 * 
 * This page is used to test and compare the behavior of the original and new API implementations.
 * It allows side-by-side testing of API functions to ensure they have the same behavior.
 */
export default function ApiTestPage() {
  const [url, setUrl] = useState('https://www.reddit.com/r/interesting/comments/1j7mwks/sand_that_moves_like_water_in_the_desert/');
  const [originalResult, setOriginalResult] = useState<any>(null);
  const [originalError, setOriginalError] = useState<string | null>(null);
  const [newResult, setNewResult] = useState<any>(null);
  const [newError, setNewError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [networkInfo, setNetworkInfo] = useState<{
    original: { method: string; url: string; headers?: Record<string, string> } | null;
    new: { method: string; url: string; headers?: Record<string, string> } | null;
  }>({ original: null, new: null });

  // Function to test extractContent from both implementations
  const testExtractContent = async () => {
    setLoading(true);
    setOriginalResult(null);
    setNewResult(null);
    setOriginalError(null);
    setNewError(null);
    setNetworkInfo({ original: null, new: null });

    // Set up network monitoring
    const originalXHR = new XMLHttpRequest();
    const originalOpen = originalXHR.open.bind(originalXHR);
    
    // Override XHR.open for original implementation
    XMLHttpRequest.prototype.open = function(
      method: string, 
      url: string | URL, 
      async: boolean = true, 
      username?: string | null, 
      password?: string | null
    ) {
      setTimeout(() => {
        setNetworkInfo(prev => ({
          ...prev,
          original: { method, url: url.toString(), headers: {} }
        }));
      }, 0);
      return originalOpen.call(this, method, url, async, username, password);
    };

    try {
      // Test original implementation
      const originalResponse = await originalExtractContent(url);
      setOriginalResult(originalResponse);
    } catch (error) {
      setOriginalError(error instanceof Error ? error.message : String(error));
    }

    // Reset XHR to monitor the new implementation
    XMLHttpRequest.prototype.open = function(
      method: string, 
      url: string | URL, 
      async: boolean = true, 
      username?: string | null, 
      password?: string | null
    ) {
      setTimeout(() => {
        setNetworkInfo(prev => ({
          ...prev,
          new: { method, url: url.toString(), headers: {} }
        }));
      }, 0);
      return originalOpen.call(this, method, url, async, username, password);
    };

    try {
      // Test new implementation
      const newResponse = await newExtractContent(url);
      setNewResult(newResponse);
    } catch (error) {
      setNewError(error instanceof Error ? error.message : String(error));
    }

    // Restore original XHR
    XMLHttpRequest.prototype.open = originalOpen;
    setLoading(false);
  };

  // Check if results match
  const resultsMatch = originalResult && newResult && 
    JSON.stringify(originalResult) === JSON.stringify(newResult);

  const APIDifferenceNotes = () => (
    <div className="mt-6 p-4 border border-red-500 rounded bg-red-50">
      <h3 className="text-lg font-bold text-red-700">⚠️ Critical API Implementation Differences</h3>
      <div className="mt-2">
        <p className="font-semibold">Function: extractContent</p>
        <ul className="list-disc pl-6 mt-1 space-y-1">
          <li>
            <span className="font-medium">Original implementation:</span> Uses <code>GET</code> method with query parameters 
            (<code>/content/extract?url=...</code>)
          </li>
          <li>
            <span className="font-medium">New implementation:</span> Incorrectly used <code>POST</code> method with JSON body
            (<code>/content/extract</code> with <code>{"{url: '...'"}</code> in body)
          </li>
          <li>
            <span className="font-medium">Impact:</span> 405 Method Not Allowed errors, breaking project loading and other functionality
          </li>
          <li>
            <span className="font-medium">Resolution:</span> New implementation updated to match original behavior
          </li>
        </ul>
      </div>
      <p className="mt-4 text-red-700 font-medium">⚠️ Always verify HTTP method, URL structure, and request format when migrating API functions!</p>
    </div>
  );

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">API Function Comparison Test</h1>
      <p className="mb-4">This page compares the behavior of the original and new API implementations.</p>
      
      <APIDifferenceNotes />
      
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Test URL:
        </label>
        <div className="flex">
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="flex-grow px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            placeholder="Enter a Reddit URL"
          />
          <button
            onClick={testExtractContent}
            disabled={loading}
            className="ml-2 px-4 py-2 bg-blue-600 text-white rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
          >
            {loading ? 'Testing...' : 'Test Functions'}
          </button>
        </div>
      </div>

      {loading && (
        <div className="text-center py-4">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-gray-300 border-t-blue-600"></div>
          <p className="mt-2 text-gray-600">Testing API functions...</p>
        </div>
      )}

      {/* Network information */}
      {(networkInfo.original || networkInfo.new) && (
        <div className="mb-6 border border-gray-200 rounded-md p-4">
          <h2 className="text-lg font-semibold mb-2">Network Requests</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <h3 className="font-medium text-blue-600">Original Implementation</h3>
              {networkInfo.original ? (
                <div className="mt-2 text-sm">
                  <p><span className="font-semibold">Method:</span> {networkInfo.original.method}</p>
                  <p><span className="font-semibold">URL:</span> {networkInfo.original.url}</p>
                </div>
              ) : (
                <p className="text-sm text-gray-500">No request detected</p>
              )}
            </div>
            <div>
              <h3 className="font-medium text-green-600">New Implementation</h3>
              {networkInfo.new ? (
                <div className="mt-2 text-sm">
                  <p><span className="font-semibold">Method:</span> {networkInfo.new.method}</p>
                  <p><span className="font-semibold">URL:</span> {networkInfo.new.url}</p>
                </div>
              ) : (
                <p className="text-sm text-gray-500">No request detected</p>
              )}
            </div>
          </div>
          {networkInfo.original && networkInfo.new && (
            <div className="mt-4">
              <h3 className="font-medium">Comparison</h3>
              <p className={`text-sm ${networkInfo.original.method === networkInfo.new.method ? 'text-green-600' : 'text-red-600'}`}>
                Method: {networkInfo.original.method === networkInfo.new.method ? 'Match ✓' : 'Mismatch ✗'}
              </p>
              <p className={`text-sm ${networkInfo.original.url === networkInfo.new.url ? 'text-green-600' : 'text-red-600'}`}>
                URL: {networkInfo.original.url === networkInfo.new.url ? 'Match ✓' : 'Mismatch ✗'}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Results comparison */}
      <div className="grid grid-cols-2 gap-4">
        <div className="border border-gray-200 rounded-md p-4">
          <h2 className="text-lg font-semibold mb-2">Original API Client</h2>
          {originalError ? (
            <div className="text-red-600 bg-red-50 p-3 rounded-md">
              <p className="font-semibold">Error:</p>
              <p>{originalError}</p>
            </div>
          ) : originalResult ? (
            <pre className="bg-gray-50 p-3 rounded-md overflow-auto max-h-96 text-xs">
              {JSON.stringify(originalResult, null, 2)}
            </pre>
          ) : (
            <p className="text-gray-500">No result yet</p>
          )}
        </div>
        
        <div className="border border-gray-200 rounded-md p-4">
          <h2 className="text-lg font-semibold mb-2">New API Client</h2>
          {newError ? (
            <div className="text-red-600 bg-red-50 p-3 rounded-md">
              <p className="font-semibold">Error:</p>
              <p>{newError}</p>
            </div>
          ) : newResult ? (
            <pre className="bg-gray-50 p-3 rounded-md overflow-auto max-h-96 text-xs">
              {JSON.stringify(newResult, null, 2)}
            </pre>
          ) : (
            <p className="text-gray-500">No result yet</p>
          )}
        </div>
      </div>

      {/* Results matching indicator */}
      {originalResult && newResult && (
        <div className={`mt-4 p-4 rounded-md ${resultsMatch ? 'bg-green-100' : 'bg-red-100'}`}>
          <p className={`font-semibold ${resultsMatch ? 'text-green-700' : 'text-red-700'}`}>
            {resultsMatch 
              ? '✓ Results match exactly' 
              : '✗ Results do not match - check differences carefully'}
          </p>
        </div>
      )}
    </div>
  );
} 