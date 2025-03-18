'use client';

import { useState, useCallback, useEffect } from 'react';
import { 
  getAvailableVoices, 
  generateVoice, 
  generateVoiceAudio,
  getVoiceById
} from '@/lib/api-client';
import { API_FLAGS, enableAllNewVoiceAPIs, disableAllNewVoiceAPIs } from '@/lib/api-flags';
import { Voice, GenerateVoiceRequest } from '@/lib/api-types';

/**
 * Test page for validating Voice API refactoring
 */
export default function VoiceApiTestPage() {
  // State
  const [voices, setVoices] = useState<Voice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<string>('');
  const [text, setText] = useState<string>('Hello, this is a test of the refactored voice API with improved error handling!');
  const [stability, setStability] = useState<number>(0.5);
  const [similarity, setSimilarity] = useState<number>(0.5);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [audio, setAudio] = useState<HTMLAudioElement | null>(null);
  const [result, setResult] = useState<string>('');
  const [errorDetails, setErrorDetails] = useState<any | null>(null);
  const [testMode, setTestMode] = useState<'normal' | 'error'>('normal');
  const [timeoutValue, setTimeoutValue] = useState<number>(15000);
  const [errorType, setErrorType] = useState<string>('timeout');
  const [flagState, setFlagState] = useState({ ...API_FLAGS });

  // Load voices when component mounts
  useEffect(() => {
    fetchVoices();
  }, []);

  // Reset audio when text changes
  useEffect(() => {
    if (audio) {
      audio.pause();
      setAudio(null);
    }
  }, [text]);

  // Fetch available voices
  const fetchVoices = async () => {
    setIsLoading(true);
    setError(null);
    setResult('');
    
    try {
      const response = await getAvailableVoices();
      
      if (response.error) {
        throw new Error(response.error.message);
      }
      
      setVoices(response.data.voices);
      if (response.data.voices.length > 0 && !selectedVoice) {
        setSelectedVoice(response.data.voices[0].voice_id);
      }
      
      setResult(`Successfully fetched ${response.data.voices.length} voices`);
    } catch (err) {
      setError(`Error fetching voices: ${err instanceof Error ? err.message : String(err)}`);
      setErrorDetails(err);
    } finally {
      setIsLoading(false);
    }
  };

  // Generate voice
  const handleGenerateVoice = async () => {
    if (!selectedVoice || !text) {
      setError('Voice and text are required');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    setResult('');
    setAudio(null);
    
    try {
      // Prepare request based on test mode
      let actualTimeout = timeoutValue;
      
      // If in error test mode, use a very short timeout to force an error
      if (testMode === 'error' && errorType === 'timeout') {
        actualTimeout = 1; // 1ms timeout to force timeout error
      }
      
      // Prepare request data
      const request: GenerateVoiceRequest = {
        text,
        voice_id: selectedVoice,
        stability,
        similarity_boost: similarity
      };
      
      // Add invalid fields if testing validation errors
      if (testMode === 'error' && errorType === 'validation') {
        // @ts-ignore - intentionally adding invalid property for testing
        request.invalid_field = 'This should cause a validation error';
        request.voice_id = '';
      }
      
      // Generate audio
      const { audio, error, characterCount, processingTime } = await generateVoiceAudio(request);
      
      if (error) {
        throw error;
      }
      
      // Set audio and result
      setAudio(audio);
      setResult(`Successfully generated audio: ${characterCount} characters in ${processingTime.toFixed(2)}s`);
    } catch (err) {
      setError(`Error generating voice: ${err instanceof Error ? err.message : String(err)}`);
      setErrorDetails(err);
    } finally {
      setIsLoading(false);
    }
  };

  // Get voice by ID
  const handleGetVoiceById = async () => {
    if (!selectedVoice) {
      setError('Voice ID is required');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    setResult('');
    
    try {
      // If testing network error, use an invalid voice ID
      const voiceId = testMode === 'error' && errorType === 'network' 
        ? 'invalid_voice_id_for_testing' 
        : selectedVoice;
        
      const response = await getVoiceById(voiceId);
      
      if (response.error) {
        throw new Error(response.error.message);
      }
      
      setResult(`Successfully fetched voice: ${response.data.name}`);
    } catch (err) {
      setError(`Error fetching voice: ${err instanceof Error ? err.message : String(err)}`);
      setErrorDetails(err);
    } finally {
      setIsLoading(false);
    }
  };

  // Toggle individual feature flags
  const toggleFlag = (flag: keyof typeof API_FLAGS) => {
    API_FLAGS[flag] = !API_FLAGS[flag];
    setFlagState({ ...API_FLAGS });
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Voice API Test (Refactored)</h1>
      
      {/* Feature Flag Controls */}
      <div className="mb-8 p-4 border rounded-lg bg-gray-50">
        <h2 className="text-xl font-semibold mb-2">Feature Flags</h2>
        <div className="grid grid-cols-2 gap-4">
          {Object.entries(flagState).map(([flag, value]) => {
            // Only show voice-related flags
            if (!flag.includes('Voice') && !flag.includes('voice')) return null;
            
            return (
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
            );
          })}
        </div>
        
        <div className="mt-4 flex gap-2">
          <button
            onClick={() => {
              enableAllNewVoiceAPIs();
              setFlagState({ ...API_FLAGS });
            }}
            className="px-3 py-1 bg-green-600 text-white text-sm rounded"
          >
            Enable All Voice APIs
          </button>
          <button
            onClick={() => {
              disableAllNewVoiceAPIs();
              setFlagState({ ...API_FLAGS });
            }}
            className="px-3 py-1 bg-gray-600 text-white text-sm rounded"
          >
            Disable All Voice APIs
          </button>
        </div>
      </div>
      
      {/* Test Mode Controls */}
      <div className="mb-8 p-4 border rounded-lg bg-gray-50">
        <h2 className="text-xl font-semibold mb-2">Test Mode</h2>
        <div className="flex gap-4 mb-4">
          <label className="flex items-center">
            <input
              type="radio"
              name="testMode"
              value="normal"
              checked={testMode === 'normal'}
              onChange={() => setTestMode('normal')}
              className="mr-2"
            />
            Normal Mode
          </label>
          <label className="flex items-center">
            <input
              type="radio"
              name="testMode"
              value="error"
              checked={testMode === 'error'}
              onChange={() => setTestMode('error')}
              className="mr-2"
            />
            Error Test Mode
          </label>
        </div>
        
        {testMode === 'error' && (
          <div className="p-3 bg-yellow-50 border border-yellow-300 rounded-md">
            <h3 className="font-medium mb-2">Error Type to Test</h3>
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center">
                <input
                  type="radio"
                  name="errorType"
                  value="timeout"
                  checked={errorType === 'timeout'}
                  onChange={() => setErrorType('timeout')}
                  className="mr-2"
                />
                Timeout Error
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  name="errorType"
                  value="network"
                  checked={errorType === 'network'}
                  onChange={() => setErrorType('network')}
                  className="mr-2"
                />
                Network Error
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  name="errorType"
                  value="validation"
                  checked={errorType === 'validation'}
                  onChange={() => setErrorType('validation')}
                  className="mr-2"
                />
                Validation Error
              </label>
            </div>

            {errorType === 'timeout' && (
              <div className="mt-3">
                <label>
                  <span className="block mb-1">Timeout Value (ms):</span>
                  <input 
                    type="number" 
                    value={timeoutValue} 
                    onChange={(e) => setTimeoutValue(parseInt(e.target.value))} 
                    min="1" 
                    max="30000" 
                    className="border rounded p-1 w-32"
                  />
                  {testMode === 'error' && errorType === 'timeout' && (
                    <p className="text-sm text-amber-600 mt-1">
                      Using 1ms timeout to force an error
                    </p>
                  )}
                </label>
              </div>
            )}
          </div>
        )}
      </div>
      
      {/* Voice Selection */}
      <div className="mb-8 p-4 border rounded-lg">
        <h2 className="text-xl font-semibold mb-4">Voice Selection</h2>
        <div className="mb-4 flex gap-4">
          <button
            onClick={fetchVoices}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            disabled={isLoading}
          >
            {isLoading ? "Loading..." : "Get Voices List"}
          </button>
          
          <button
            onClick={handleGetVoiceById}
            className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50"
            disabled={isLoading || !selectedVoice}
          >
            {isLoading ? "Loading..." : "Get Voice by ID"}
          </button>
        </div>
        
        <div className="mb-4">
          <label className="block mb-2">Select Voice:</label>
          <select 
            value={selectedVoice} 
            onChange={(e) => setSelectedVoice(e.target.value)}
            className="block w-full p-2 border rounded"
            disabled={voices.length === 0}
          >
            {voices.length === 0 && <option value="">No voices available</option>}
            {voices.map(voice => (
              <option key={voice.voice_id} value={voice.voice_id}>
                {voice.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      
      {/* Voice Generation */}
      <div className="mb-8 p-4 border rounded-lg">
        <h2 className="text-xl font-semibold mb-4">Voice Generation</h2>
        
        <div className="mb-4">
          <label className="block mb-2">Text to Convert:</label>
          <textarea 
            value={text} 
            onChange={(e) => setText(e.target.value)}
            className="block w-full p-2 border rounded h-32"
            placeholder="Enter text to convert to speech"
          />
        </div>
        
        <div className="grid grid-cols-2 gap-6 mb-4">
          <div>
            <label className="block mb-2">
              Stability: {stability}
            </label>
            <input 
              type="range" 
              min="0" 
              max="1" 
              step="0.1" 
              value={stability}
              onChange={(e) => setStability(parseFloat(e.target.value))}
              className="w-full"
            />
          </div>
          
          <div>
            <label className="block mb-2">
              Similarity Boost: {similarity}
            </label>
            <input 
              type="range" 
              min="0" 
              max="1" 
              step="0.1" 
              value={similarity}
              onChange={(e) => setSimilarity(parseFloat(e.target.value))}
              className="w-full"
            />
          </div>
        </div>
        
        <div className="flex gap-4">
          <button
            onClick={handleGenerateVoice}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
            disabled={isLoading || !selectedVoice || !text}
          >
            {isLoading ? "Generating..." : "Generate Voice"}
          </button>
          
          {audio && (
            <div className="flex items-center gap-2">
              <button
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                onClick={() => audio.play()}
              >
                Play
              </button>
              <button
                className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
                onClick={() => audio.pause()}
              >
                Pause
              </button>
            </div>
          )}
        </div>
      </div>
      
      {/* Results */}
      {result && (
        <div className="mb-8 p-4 border rounded-lg bg-green-50 border-green-200">
          <h2 className="text-xl font-semibold mb-2">Success</h2>
          <p>{result}</p>
        </div>
      )}
      
      {/* Errors */}
      {error && (
        <div className="mb-8 p-4 border rounded-lg bg-red-50 border-red-200">
          <h2 className="text-xl font-semibold mb-2">Error</h2>
          <p className="text-red-700 mb-4">{error}</p>
          
          {errorDetails && (
            <div className="mt-4">
              <h3 className="font-semibold">Error Details:</h3>
              <pre className="bg-gray-800 text-white p-4 rounded mt-2 overflow-auto max-h-60 text-sm">
                {JSON.stringify(errorDetails, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
} 