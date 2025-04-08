import React, { useRef, useState, useEffect } from 'react';

// Use an external video source that's guaranteed to work
const TEST_VIDEO_URL = 'https://www.w3schools.com/html/mov_bbb.mp4';

export default function TestBridgePage() {
  // Video element ref
  const videoRef = useRef<HTMLVideoElement>(null);
  
  // Video loading state
  const [videoLoaded, setVideoLoaded] = useState(false);
  const [videoLoadError, setVideoLoadError] = useState<string | null>(null);
  const [videoState, setVideoState] = useState({
    currentTime: 0,
    duration: 0,
    paused: true,
    networkState: 0,
    readyState: 0
  });
  
  useEffect(() => {
    const videoElement = videoRef.current;
    if (!videoElement) return;
    
    console.log('Setting up video event listeners');
    
    // Track video state changes
    const updateVideoState = () => {
      if (!videoElement) return;
      
      setVideoState({
        currentTime: videoElement.currentTime,
        duration: videoElement.duration || 0,
        paused: videoElement.paused,
        networkState: videoElement.networkState,
        readyState: videoElement.readyState
      });
    };
    
    const handleLoadedData = () => {
      console.log('Video loaded successfully');
      setVideoLoaded(true);
      setVideoLoadError(null);
      updateVideoState();
    };
    
    const handleError = () => {
      const errorMessage = videoElement.error 
        ? `Error: ${videoElement.error.message || 'Unknown video loading error'}`
        : 'Unknown error';
        
      console.error('Video load error:', errorMessage);
      setVideoLoaded(false);
      setVideoLoadError(errorMessage);
    };
    
    // Add event listeners
    videoElement.addEventListener('loadeddata', handleLoadedData);
    videoElement.addEventListener('error', handleError);
    videoElement.addEventListener('timeupdate', updateVideoState);
    videoElement.addEventListener('play', updateVideoState);
    videoElement.addEventListener('pause', updateVideoState);
    
    // Set video source
    videoElement.src = TEST_VIDEO_URL;
    
    // Update state initially
    updateVideoState();
    
    // Clean up event listeners
    return () => {
      videoElement.removeEventListener('loadeddata', handleLoadedData);
      videoElement.removeEventListener('error', handleError);
      videoElement.removeEventListener('timeupdate', updateVideoState);
      videoElement.removeEventListener('play', updateVideoState);
      videoElement.removeEventListener('pause', updateVideoState);
    };
  }, []);
  
  // Helper functions for human-readable state values
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
  
  const handlePlay = () => {
    if (videoRef.current) {
      videoRef.current.play().catch(err => {
        console.error('Error playing video:', err);
        setVideoLoadError(`Error playing: ${err.message}`);
      });
    }
  };
  
  const handlePause = () => {
    if (videoRef.current) {
      videoRef.current.pause();
    }
  };
  
  const seekTo = (time: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = time;
    }
  };

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Video Bridge Test Page</h1>
      
      <h2 className="text-xl font-semibold mb-2">Video Status</h2>
      <div className="space-y-2 mb-4">
        <p>Video URL: {TEST_VIDEO_URL}</p>
        <p>Loaded: {videoLoaded ? 'Yes' : 'No'}</p>
        <p>Network State: {getNetworkStateText(videoState.networkState)}</p>
        <p>Ready State: {getReadyStateText(videoState.readyState)}</p>
        {videoLoadError && (
          <p className="text-red-500">Error: {videoLoadError}</p>
        )}
      </div>
      
      <h2 className="text-xl font-semibold mb-2">Direct Video Test</h2>
      <p className="mb-2">This is a direct video element to verify if the video file can be loaded correctly.</p>
      
      <div>
        <video 
          ref={videoRef}
          controls
          width="400"
          height="225"
          style={{ border: '1px solid #ccc' }}
        />
      </div>
      
      <div className="mt-4 space-y-2">
        <div>
          <button 
            className="px-3 py-1 bg-blue-500 text-white rounded mr-2"
            disabled={!videoLoaded} 
            onClick={videoState.paused ? handlePlay : handlePause}
          >
            {videoState.paused ? 'Play' : 'Pause'}
          </button>
          
          <button 
            className="px-3 py-1 bg-gray-500 text-white rounded"
            disabled={!videoLoaded}
            onClick={() => seekTo(0)}
          >
            Go to Start
          </button>
        </div>
        
        <div className="flex items-center">
          <input
            type="range"
            disabled={!videoLoaded}
            min={0}
            max={videoState.duration || 0}
            step={0.01}
            value={videoState.currentTime}
            onChange={(e) => seekTo(parseFloat(e.target.value))}
            style={{ width: '400px' }}
          />
          <span className="ml-2">
            {videoState.currentTime.toFixed(2)} / {videoState.duration.toFixed(2)}
          </span>
        </div>
      </div>
      
      <div className="mt-6">
        <h2 className="text-xl font-semibold mb-2">Debug Information</h2>
        <pre className="bg-gray-100 p-2 rounded">
          {JSON.stringify({
            videoLoaded,
            error: videoLoadError,
            ...videoState
          }, null, 2)}
        </pre>
      </div>
    </div>
  );
}