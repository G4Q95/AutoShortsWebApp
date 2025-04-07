import React, { useRef, useState, useEffect } from 'react';
import { useBridgeAdapter } from './useBridgeAdapter';
import useBridgeConfig from './useBridgeConfig';

export function TestBridgePlayer({
  mediaUrl = 'https://example.com/video.mp4',
  localMediaUrl = '/local-video.mp4',
}) {
  // Refs for DOM elements
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // State
  const [isPlaying, setIsPlaying] = useState(false);
  const [showFirstFrame, setShowFirstFrame] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  
  // Bridge configuration
  const { useNewBridge, toggleBridgeImplementation, currentImplementation } = useBridgeConfig();
  
  // Use bridge adapter
  const bridge = useBridgeAdapter({
    canvasRef,
    videoRef,
    mediaUrl,
    localMediaUrl,
    mediaType: 'video',
    initialMediaAspectRatio: 16/9,
    showFirstFrame,
    onInitialLoad: () => console.log('Bridge ready'),
  });
  
  // Toggle play/pause
  const handlePlayPause = async () => {
    if (isPlaying) {
      await bridge.pause();
      setIsPlaying(false);
    } else {
      // First hide the first frame video
      setShowFirstFrame(false);
      
      // Small delay to ensure React has updated the DOM
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // Now play
      const success = await bridge.play();
      
      if (success) {
        setIsPlaying(true);
      } else {
        // If play failed, show first frame again
        setShowFirstFrame(true);
      }
    }
  };
  
  // Handle seeking
  const handleSeek = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(event.target.value);
    await bridge.seek(newTime);
    setCurrentTime(newTime);
  };
  
  // Update time display from bridge
  useEffect(() => {
    if (bridge.currentTime !== undefined) {
      setCurrentTime(bridge.currentTime);
    }
  }, [bridge.currentTime]);
  
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
            src={localMediaUrl}
            className="w-full h-full"
            playsInline
            muted
            preload="auto"
          />
        )}
        
        {/* VideoContext canvas */}
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full"
          style={{ display: showFirstFrame ? 'none' : 'block' }}
        />
        
        {/* Loading indicator */}
        {!bridge.isReady && (
          <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
          </div>
        )}
        
        {/* Error display */}
        {bridge.hasError && (
          <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-70">
            <div className="text-white text-center p-4">
              <p className="text-red-500">Error</p>
              <p className="text-sm">{bridge.errorMessage}</p>
            </div>
          </div>
        )}
      </div>
      
      {/* Controls */}
      <div className="mt-4 flex space-x-4 items-center">
        <button
          onClick={handlePlayPause}
          disabled={!bridge.isReady}
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
          disabled={!bridge.isReady}
          className="flex-grow"
        />
        
        <span className="text-sm font-mono">
          {currentTime.toFixed(1)} / {bridge.duration.toFixed(1)}
        </span>
      </div>
      
      {/* Status */}
      <div className="mt-4 text-xs text-gray-500">
        <div>Status: {bridge.isReady ? 'Ready' : 'Not Ready'}</div>
        <div>Duration: {bridge.duration.toFixed(2)}s</div>
        <div>showFirstFrame: {showFirstFrame.toString()}</div>
        <div>isPlaying: {isPlaying.toString()}</div>
      </div>
    </div>
  );
}

export default TestBridgePlayer; 