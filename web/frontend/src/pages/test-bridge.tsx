import React, { useRef, useState, useEffect } from 'react';
import { useBridgeAdapter } from '@/hooks/new/useBridgeAdapter';

// Using a local test video to avoid cross-origin issues
const TEST_VIDEO_URL = '/sample-video.mp4'; // Place a short sample video in public directory

export default function TestBridgePage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Separate video element state from bridge state
  const [directVideoState, setDirectVideoState] = useState({
    loaded: false,
    networkState: 0,
    readyState: 0,
    error: null as string | null,
    duration: 0
  });
  
  // Bridge state
  const [bridgeState, setBridgeState] = useState({
    error: null as string | null,
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    videoReady: false,
    showFirstFrame: true
  });

  // Set up direct video element only once
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // Track all state changes in a single handler to avoid race conditions
    const handleVideoStateChange = () => {
      if (!video) return;
      
      setDirectVideoState({
        loaded: video.readyState >= 1,
        networkState: video.networkState,
        readyState: video.readyState,
        error: video.error ? `Video error: ${video.error.message || 'Unknown error'}` : null,
        duration: video.duration || 0
      });
    };

    // Set up all event listeners
    const events = [
      'loadstart', 'loadedmetadata', 'loadeddata', 
      'progress', 'canplay', 'canplaythrough',
      'error', 'stalled', 'suspend', 'waiting'
    ];
    
    events.forEach(event => {
      video.addEventListener(event, handleVideoStateChange);
    });

    // Initial load
    handleVideoStateChange();
    
    // Set source and load
    video.crossOrigin = 'anonymous';
    video.src = TEST_VIDEO_URL;
    video.load();
    
    // Cleanup
    return () => {
      events.forEach(event => {
        video.removeEventListener(event, handleVideoStateChange);
      });
    };
  }, []);

  // Handle bridge errors
  const handleBridgeError = (err: Error) => {
    console.error('Bridge error:', err);
    setBridgeState(prev => ({
      ...prev,
      error: err.message
    }));
    
    // Auto-clear error after 5 seconds
    setTimeout(() => {
      setBridgeState(prev => ({
        ...prev,
        error: null
      }));
    }, 5000);
  };

  // Initialize bridge adapter
  const bridge = useBridgeAdapter({
    videoRef,
    canvasRef,
    mediaUrl: TEST_VIDEO_URL,
    mediaType: 'video/mp4',
    showFirstFrame: bridgeState.showFirstFrame,
    onError: handleBridgeError,
    onTimeUpdate: (time) => {
      setBridgeState(prev => ({
        ...prev,
        currentTime: time
      }));
    },
    onDurationChange: (dur) => {
      setBridgeState(prev => ({
        ...prev,
        duration: dur
      }));
    },
    onIsReadyChange: (ready) => {
      setBridgeState(prev => ({
        ...prev,
        videoReady: ready
      }));
    }
  });

  // Bridge action handlers with state updates
  const handlePlayPause = async () => {
    try {
      if (bridgeState.isPlaying) {
        await bridge.pause();
        setBridgeState(prev => ({
          ...prev,
          isPlaying: false
        }));
      } else {
        // Toggle first frame off when playing
        if (bridgeState.showFirstFrame) {
          setBridgeState(prev => ({
            ...prev,
            showFirstFrame: false
          }));
          
          // Wait one tick for state to update before playing
          await new Promise(resolve => setTimeout(resolve, 50));
        }
        
        await bridge.play();
        setBridgeState(prev => ({
          ...prev,
          isPlaying: true
        }));
      }
    } catch (err) {
      console.error('Play/Pause error:', err);
    }
  };

  const handleSeek = async (time: number) => {
    try {
      await bridge.seek(time);
      setBridgeState(prev => ({
        ...prev,
        currentTime: time
      }));
    } catch (err) {
      console.error('Seek error:', err);
    }
  };

  const toggleFirstFrame = () => {
    // If playing, pause first
    if (bridgeState.isPlaying) {
      bridge.pause().then(() => {
        setBridgeState(prev => ({
          ...prev,
          isPlaying: false,
          showFirstFrame: !prev.showFirstFrame
        }));
      }).catch(console.error);
    } else {
      setBridgeState(prev => ({
        ...prev,
        showFirstFrame: !prev.showFirstFrame
      }));
    }
  };

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Video Bridge Test Page</h1>
      
      {/* Status Display */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div className="p-4 bg-gray-100 rounded">
          <h2 className="text-xl font-semibold mb-2">Video Status</h2>
          <div className="space-y-2">
            <p>Video URL: {TEST_VIDEO_URL}</p>
            <p>Loaded: {directVideoState.loaded ? 'Yes' : 'No'}</p>
            <p>Network State: {directVideoState.networkState} ({getNetworkStateText(directVideoState.networkState)})</p>
            <p>Ready State: {directVideoState.readyState} ({getReadyStateText(directVideoState.readyState)})</p>
            {directVideoState.error && (
              <p className="text-red-500">Error: {directVideoState.error}</p>
            )}
          </div>
        </div>

        <div className="p-4 bg-gray-100 rounded">
          <h2 className="text-xl font-semibold mb-2">Bridge Status</h2>
          <div className="space-y-2">
            {bridgeState.error && (
              <div className="text-red-600">
                Bridge Error: {bridgeState.error}
              </div>
            )}
            <div>Video Ready: {bridgeState.videoReady ? 'Yes' : 'No'}</div>
            <div>Playing: {bridgeState.isPlaying ? 'Yes' : 'No'}</div>
            <div>Current Time: {bridgeState.currentTime.toFixed(2)}s</div>
            <div>Duration: {bridgeState.duration.toFixed(2)}s</div>
            <div>Show First Frame: {bridgeState.showFirstFrame ? 'Yes' : 'No'}</div>
            <div>Bridge Loading: {bridge.isLoading ? 'Yes' : 'No'}</div>
            <div>Bridge Has Error: {bridge.hasError ? 'Yes' : 'No'}</div>
            {bridge.errorMessage && (
              <div className="text-red-600">
                Bridge Error Message: {bridge.errorMessage}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Direct Video Test */}
      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-2">Direct Video Test</h2>
        <video 
          src={TEST_VIDEO_URL}
          controls
          className="w-full max-w-2xl border border-gray-300"
        />
        <p className="mt-2 text-sm text-gray-600">
          This is a direct video element, separate from the bridge implementation above.
          It should help us verify if the video file itself can be loaded correctly.
        </p>
      </div>

      {/* Video and Canvas Container */}
      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-2">Video Element and Canvas</h2>
        <div className="space-y-4">
          <div className="relative w-full max-w-2xl h-[360px] border border-gray-300">
            {/* Single video element used by both direct and bridge mode */}
            <video
              ref={videoRef}
              className="w-full h-full object-contain bg-black"
              playsInline
              crossOrigin="anonymous"
              style={{ display: bridgeState.showFirstFrame ? 'none' : 'block' }}
            />
            <canvas
              ref={canvasRef}
              className="w-full h-full object-contain bg-black"
              style={{ display: bridgeState.showFirstFrame ? 'block' : 'none' }}
            />
          </div>
          
          {/* Controls */}
          <div className="space-y-4">
            <div className="flex gap-4">
              <button
                onClick={handlePlayPause}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-400"
                disabled={!bridgeState.videoReady && directVideoState.readyState < 1}
              >
                {bridgeState.isPlaying ? 'Pause' : 'Play'}
              </button>
              
              <button
                onClick={toggleFirstFrame}
                className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 disabled:bg-gray-400"
                disabled={!bridgeState.videoReady && directVideoState.readyState < 1}
              >
                Toggle First Frame
              </button>
            </div>

            <div className="flex items-center space-x-4">
              <input
                type="range"
                min={0}
                max={bridgeState.duration || directVideoState.duration || 100}
                value={bridgeState.currentTime}
                onChange={(e) => handleSeek(parseFloat(e.target.value))}
                className="w-full max-w-xl"
                disabled={!bridgeState.videoReady && directVideoState.readyState < 1}
              />
              <span>
                {bridgeState.currentTime.toFixed(2)} / {bridgeState.duration.toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function getNetworkStateText(state: number): string {
  switch (state) {
    case 0: return 'NETWORK_EMPTY';
    case 1: return 'NETWORK_IDLE';
    case 2: return 'NETWORK_LOADING';
    case 3: return 'NETWORK_NO_SOURCE';
    default: return 'UNKNOWN';
  }
}

function getReadyStateText(state: number): string {
  switch (state) {
    case 0: return 'HAVE_NOTHING';
    case 1: return 'HAVE_METADATA';
    case 2: return 'HAVE_CURRENT_DATA';
    case 3: return 'HAVE_FUTURE_DATA';
    case 4: return 'HAVE_ENOUGH_DATA';
    default: return 'UNKNOWN';
  }
}