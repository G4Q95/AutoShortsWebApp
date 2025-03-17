'use client';

import { useState, useEffect } from 'react';
import { getAvailableVoices } from '@/lib/api-client';
import { 
  API_FLAGS, 
  enableAllNewVoiceAPIs, 
  disableAllNewVoiceAPIs 
} from '@/lib/api-flags';

export default function TestApiFlags() {
  const [result, setResult] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [flagState, setFlagState] = useState({ ...API_FLAGS });

  // Test the original API implementation
  const testOriginalApi = async () => {
    setLoading(true);
    setError(null);
    setResult('');
    
    try {
      console.log('Testing original API implementation...');
      disableAllNewVoiceAPIs();
      setFlagState({ ...API_FLAGS });
      
      const startTime = Date.now();
      const response = await getAvailableVoices();
      const endTime = Date.now();
      
      if (response.error) {
        throw new Error(response.error.message);
      }
      
      setResult(
        `ORIGINAL API SUCCESS: ✅\n` +
        `Duration: ${endTime - startTime}ms\n` +
        `Voice count: ${response.data.voices.length}\n` +
        `First voice: ${response.data.voices[0]?.name || 'N/A'}`
      );
    } catch (err) {
      setError(`Error testing original API: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoading(false);
    }
  };
  
  // Test the new API implementation
  const testNewApi = async () => {
    setLoading(true);
    setError(null);
    setResult('');
    
    try {
      console.log('Testing new API implementation...');
      enableAllNewVoiceAPIs();
      setFlagState({ ...API_FLAGS });
      
      const startTime = Date.now();
      const response = await getAvailableVoices();
      const endTime = Date.now();
      
      if (response.error) {
        throw new Error(response.error.message);
      }
      
      setResult(
        `NEW API SUCCESS: ✅\n` +
        `Duration: ${endTime - startTime}ms\n` +
        `Voice count: ${response.data.voices.length}\n` +
        `First voice: ${response.data.voices[0]?.name || 'N/A'}`
      );
    } catch (err) {
      setError(`Error testing new API: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoading(false);
    }
  };
  
  // Toggle individual feature flags
  const toggleFlag = (flag: keyof typeof API_FLAGS) => {
    API_FLAGS[flag] = !API_FLAGS[flag];
    setFlagState({ ...API_FLAGS });
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">API Feature Flag Testing</h1>
      
      <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-4 border rounded">
          <h2 className="text-xl font-semibold mb-2">Test API Implementations</h2>
          <div className="flex gap-2 mb-4">
            <button
              onClick={testOriginalApi}
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
            >
              Test Original API
            </button>
            <button
              onClick={testNewApi}
              disabled={loading}
              className="px-4 py-2 bg-green-600 text-white rounded disabled:opacity-50"
            >
              Test New API
            </button>
          </div>
          
          {loading && <p className="text-blue-600">Loading...</p>}
          {error && <p className="text-red-600">{error}</p>}
          {result && (
            <pre className="p-3 bg-gray-100 rounded whitespace-pre-wrap text-sm">
              {result}
            </pre>
          )}
        </div>
        
        <div className="p-4 border rounded">
          <h2 className="text-xl font-semibold mb-2">Feature Flags</h2>
          <div className="space-y-2">
            {Object.entries(flagState).map(([flag, value]) => (
              <div key={flag} className="flex items-center">
                <label className="flex items-center cursor-pointer">
                  <div className="relative">
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={value === true}
                      onChange={() => toggleFlag(flag as keyof typeof API_FLAGS)}
                    />
                    <div className={`block w-10 h-6 rounded-full ${value ? 'bg-green-400' : 'bg-gray-300'}`}></div>
                    <div className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition ${value ? 'transform translate-x-4' : ''}`}></div>
                  </div>
                  <span className="ml-3 text-sm font-medium">
                    {flag}: {value.toString()}
                  </span>
                </label>
              </div>
            ))}
          </div>
          
          <div className="mt-4 flex gap-2">
            <button
              onClick={() => {
                enableAllNewVoiceAPIs();
                setFlagState({ ...API_FLAGS });
              }}
              className="px-3 py-1 bg-green-600 text-white text-sm rounded"
            >
              Enable All
            </button>
            <button
              onClick={() => {
                disableAllNewVoiceAPIs();
                setFlagState({ ...API_FLAGS });
              }}
              className="px-3 py-1 bg-gray-600 text-white text-sm rounded"
            >
              Disable All
            </button>
          </div>
        </div>
      </div>
      
      <div className="p-4 border rounded">
        <h2 className="text-xl font-semibold mb-2">Console Output</h2>
        <p className="mb-2 text-sm">Check the browser console for detailed implementation logs.</p>
        <button
          onClick={() => console.clear()}
          className="px-3 py-1 bg-red-600 text-white text-sm rounded"
        >
          Clear Console
        </button>
      </div>
    </div>
  );
} 