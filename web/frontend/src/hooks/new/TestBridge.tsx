import React, { useRef, useState, useEffect } from 'react';
import { useBridgeAdapter } from './useBridgeAdapter';
import useBridgeConfig from './useBridgeConfig';

export function TestBridgePlayer({
  mediaUrl = 'https://storage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
  localMediaUrl = 'https://storage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
}) {
  // Refs for DOM elements
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // State
  const [isPlaying, setIsPlaying] = useState(false);
  const [showFirstFrame, setShowFirstFrame] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [error, setError] = useState<string | null>(null);
  
  // Bridge configuration
  const { useNewBridge, toggleBridgeImplementation, currentImplementation } = useBridgeConfig();
  
  // Use bridge adapter with error handling
  const bridge = useBridgeAdapter({
    canvasRef,
    videoRef,
    mediaUrl,
    localMediaUrl,
    mediaType: 'video',
    initialMediaAspectRatio: 16/9,
    showFirstFrame,
    onInitialLoad: () => {
      console.log('Bridge ready - onInitialLoad callback fired');
    },
    onError: (err) => {
      console.error('Bridge error:', err);
      setError(err.message);
    }
  });
  
  // Toggle play/pause with better error handling
  const handlePlayPause = async () => {
    try {
      if (isPlaying) {
        console.log('Attempting to pause...');
        await bridge.pause();
        setIsPlaying(false);
      } else {
        console.log('Preparing to play...');
        // First hide the first frame video
        setShowFirstFrame(false);
        
        // Small delay to ensure React has updated the DOM
        await new Promise(resolve => setTimeout(resolve, 50));
        
        console.log('Attempting to play...');
        // Now play
        const success = await bridge.play();
        
        if (success) {
          console.log('Play successful');
          setIsPlaying(true);
        } else {
          console.error('Play failed');
          // If play failed, show first frame again
          setShowFirstFrame(true);
        }
      }
    } catch (error) {
      console.error('Error during play/pause:', error);
      setError(error instanceof Error ? error.message : String(error));
      setShowFirstFrame(true);
      setIsPlaying(false);
    }
  };
  
  // Handle seeking with error handling
  const handleSeek = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      const newTime = parseFloat(event.target.value);
      console.log(`Seeking to ${newTime}`);
      await bridge.seek(newTime);
      setCurrentTime(newTime);
    } catch (error) {
      console.error('Error during seek:', error);
      setError(error instanceof Error ? error.message : String(error));
    }
  };
  
  // Update time display from bridge
  useEffect(() => {
    if (bridge.currentTime !== undefined) {
      setCurrentTime(bridge.currentTime);
    }
  }, [bridge.currentTime]);
  
  // Load video directly in the first frame
  useEffect(() => {
    const video = videoRef.current;
    if (video && localMediaUrl) {
      // Set up event listeners
      const handleVideoLoaded = () => {
        console.log('First frame video loaded');
      };
      
      const handleVideoError = (e: any) => {
        console.error('Error loading first frame video:', e);
        setError(`Error loading video: ${e.target?.error?.message || 'Unknown error'}`);
      };
      
      // Add event listeners
      video.addEventListener('loadeddata', handleVideoLoaded);
      video.addEventListener('error', handleVideoError);
      
      // Load the video
      video.src = localMediaUrl;
      video.load();
      
      // Cleanup
      return () => {
        video.removeEventListener('loadeddata', handleVideoLoaded);
        video.removeEventListener('error', handleVideoError);
      };
    }
  }, [localMediaUrl]);
  
  // Clear error after 5 seconds
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);
  
  return (
    <div className="p-4 border rounded-lg max-w-xl mx-auto">
      <h2 className="text-lg font-bold mb-2">Test Bridge Player</h2>
      
      <div className="mb-4">
        <p className="text-sm text-gray-500">
          Using <span className="font-mono">{currentImplementation}</span> bridge implementation
        </p>
        <button 
          onClick={toggleBridgeImplementation}
          className="mt-1 px-2 py-1 bg-gray-200 text-xs rounded"
        >
          Toggle Implementation
        </button>
      </div>
      
      {/* Video container */}
      <div 
        ref={containerRef}
        className="relative aspect-video bg-black overflow-hidden"
      >
        {/* First frame video element */}
        {showFirstFrame && (
          <video
            ref={videoRef}
            className="w-full h-full"
            playsInline
            muted
            preload="auto"
            poster="https://storage.googleapis.com/gtv-videos-bucket/sample/images/BigBuckBunny.jpg"
          />
        )}
        
        {/* VideoContext canvas */}
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full"
          style={{ display: showFirstFrame ? 'none' : 'block' }}
        />
        
        {/* Loading indicator */}
        {!bridge.isReady && !error && (
          <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
          </div>
        )}
        
        {/* Error display */}
        {(error || bridge.hasError) && (
          <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-70">
            <div className="text-white text-center p-4 max-w-md">
              <p className="text-red-500 font-bold">Error</p>
              <p className="text-sm">{error || bridge.errorMessage}</p>
            </div>
          </div>
        )}
        
        {/* Play/Pause overlay */}
        <div 
          className="absolute inset-0 flex items-center justify-center cursor-pointer"
          onClick={handlePlayPause}
        >
          {isPlaying ? (
            <div className="w-12 h-12 flex items-center justify-center rounded-full bg-black bg-opacity-50 hover:bg-opacity-70">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m-9-3a9 9 0 1118 0 9 9 0 01-18 0z" />
              </svg>
            </div>
          ) : (
            <div className="w-12 h-12 flex items-center justify-center rounded-full bg-black bg-opacity-50 hover:bg-opacity-70">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          )}
        </div>
      </div>
      
      {/* Controls */}
      <div className="mt-4 flex space-x-4 items-center">
        <button
          onClick={handlePlayPause}
          disabled={!bridge.isReady && !error}
          className="px-4 py-2 bg-blue-500 text-white rounded disabled:opacity-50"
        >
          {isPlaying ? 'Pause' : 'Play'}
        </button>
        
        <input
          type="range"
          min="0"
          max={bridge.duration || 100}
          step="0.1"
          value={currentTime}
          onChange={handleSeek}
          disabled={!bridge.isReady || Boolean(error)}
          className="flex-grow"
        />
        
        <span className="text-sm font-mono">
          {currentTime.toFixed(1)} / {bridge.duration.toFixed(1)}
        </span>
      </div>
      
      {/* Debug info */}
      <div className="mt-4 text-xs text-gray-500 p-2 bg-gray-100 rounded">
        <div>Status: {bridge.isReady ? 'Ready' : 'Not Ready'}</div>
        <div>Duration: {bridge.duration.toFixed(2)}s</div>
        <div>showFirstFrame: {showFirstFrame.toString()}</div>
        <div>isPlaying: {isPlaying.toString()}</div>
        <div>isInitializing: {bridge.isInitializing?.toString() || 'undefined'}</div>
        <div>hasError: {bridge.hasError?.toString() || 'false'}</div>
        {bridge.errorMessage && <div>Error: {bridge.errorMessage}</div>}
      </div>
    </div>
  );
}

export default TestBridgePlayer; 