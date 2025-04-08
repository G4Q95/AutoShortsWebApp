import React, { useRef, useState, useEffect, MutableRefObject } from 'react';
import { useBridgeAdapter } from '../hooks/new/useBridgeAdapter';

// Constants for testing
const TEST_VIDEO_URL = 'https://www.w3schools.com/html/mov_bbb.mp4'; // Reliable external source
const FALLBACK_VIDEO_URL = '/sample-video.mp4'; // Local fallback

const TestBridgeAdapterPage: React.FC = () => {
  // Element references - using standard useRef, which is compatible with MutableRefObject
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Error handler
  const handleError = (error: Error) => {
    console.error('Bridge adapter error:', error);
  };
  
  // Time update handler
  const handleTimeUpdate = (time: number) => {
    console.log('Time updated:', time);
  };
  
  // Ready handler
  const handleReady = () => {
    console.log('Bridge adapter ready');
  };
  
  // Initialize bridge adapter
  const bridge = useBridgeAdapter({
    videoRef,
    canvasRef,
    videoSrc: TEST_VIDEO_URL,
    onReady: handleReady,
    onError: handleError,
    onTimeUpdate: handleTimeUpdate,
    startWithFirstFrame: true,
  });
  
  // Helper functions to make state values readable
  const getNetworkStateText = (state: number): string => {
    const states = [
      'NETWORK_EMPTY',
      'NETWORK_IDLE',
      'NETWORK_LOADING',
      'NETWORK_NO_SOURCE'
    ];
    return `${state} (${states[state] || 'UNKNOWN'})`;
  };
  
  const getReadyStateText = (state: number): string => {
    const states = [
      'HAVE_NOTHING',
      'HAVE_METADATA',
      'HAVE_CURRENT_DATA',
      'HAVE_FUTURE_DATA',
      'HAVE_ENOUGH_DATA'
    ];
    return `${state} (${states[state] || 'UNKNOWN'})`;
  };
  
  // Toggle first frame (video/canvas)
  const handleToggleFirstFrame = () => {
    // We'll manually handle this
    const canvas = canvasRef.current;
    const video = videoRef.current;
    
    if (video && canvas) {
      if (canvas.style.display === 'none') {
        // Show canvas, hide video
        canvas.style.display = 'block';
        video.style.display = 'none';
      } else {
        // Show video, hide canvas
        canvas.style.display = 'none';
        video.style.display = 'block';
      }
    }
  };
  
  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Bridge Adapter Test Page</h1>
      
      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-2">Video Player</h2>
        <div className="relative w-full max-w-lg border border-gray-300">
          {/* Canvas for first frame display */}
          <canvas 
            ref={canvasRef}
            className="absolute top-0 left-0 w-full h-full"
            style={{ display: 'block' }}
          />
          
          {/* Video element */}
          <video
            ref={videoRef}
            className="w-full"
            style={{ display: 'none' }}
          />
        </div>
        
        {bridge.error && (
          <div className="text-red-500 mt-2">{bridge.error.message}</div>
        )}
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div>
          <h2 className="text-xl font-semibold mb-2">Bridge Status</h2>
          <p><strong>Is Ready:</strong> {bridge.isReady ? 'Yes' : 'No'}</p>
          <p><strong>Is Playing:</strong> {bridge.isPlaying ? 'Yes' : 'No'}</p>
          <p><strong>Current Time:</strong> {bridge.currentTime.toFixed(2)}s</p>
          <p><strong>Duration:</strong> {bridge.duration.toFixed(2)}s</p>
          <p><strong>Has Error:</strong> {bridge.error ? 'Yes' : 'No'}</p>
          {bridge.error && (
            <p><strong>Error:</strong> {bridge.error.message}</p>
          )}
        </div>
        
        <div>
          <h2 className="text-xl font-semibold mb-2">Video Element Status</h2>
          <p><strong>URL:</strong> {videoRef.current?.src || TEST_VIDEO_URL}</p>
          <p><strong>Network State:</strong> {videoRef.current ? getNetworkStateText(videoRef.current.networkState) : 'N/A'}</p>
          <p><strong>Ready State:</strong> {videoRef.current ? getReadyStateText(videoRef.current.readyState) : 'N/A'}</p>
          <p><strong>Video Width:</strong> {videoRef.current?.videoWidth || 0}px</p>
          <p><strong>Video Height:</strong> {videoRef.current?.videoHeight || 0}px</p>
          <p><strong>Canvas Width:</strong> {canvasRef.current?.width || 0}px</p>
          <p><strong>Canvas Height:</strong> {canvasRef.current?.height || 0}px</p>
        </div>
      </div>
      
      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-2">Controls</h2>
        <div className="flex space-x-2 mb-2">
          <button
            onClick={() => bridge.actions.play()}
            disabled={!bridge.isReady || bridge.isPlaying}
            className="px-4 py-2 bg-blue-500 text-white rounded disabled:bg-gray-300"
          >
            Play
          </button>
          <button
            onClick={() => bridge.actions.pause()}
            disabled={!bridge.isReady || !bridge.isPlaying}
            className="px-4 py-2 bg-blue-500 text-white rounded disabled:bg-gray-300"
          >
            Pause
          </button>
          <button
            onClick={handleToggleFirstFrame}
            disabled={!bridge.isReady}
            className="px-4 py-2 bg-green-500 text-white rounded disabled:bg-gray-300"
          >
            Toggle Canvas/Video
          </button>
        </div>
        
        <div className="flex items-center space-x-2">
          <span>Seek:</span>
          <input
            type="range"
            min="0"
            max={bridge.duration || 100}
            value={bridge.currentTime}
            onChange={(e) => bridge.actions.seek(parseFloat(e.target.value))}
            disabled={!bridge.isReady}
            className="w-48"
          />
          <span>{bridge.currentTime.toFixed(2)}s / {bridge.duration.toFixed(2)}s</span>
        </div>
      </div>
      
      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-2">Implementation Notes</h2>
        <p>Testing the improved useBridgeAdapter with:</p>
        <ul className="list-disc ml-6">
          <li>Proper optional chaining for canvasRef</li>
          <li>Fixed VideoContext integration</li>
          <li>Improved error handling</li>
          <li>Better state management</li>
        </ul>
      </div>
    </div>
  );
};

export default TestBridgeAdapterPage;