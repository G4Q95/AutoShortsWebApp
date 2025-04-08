import React, { useRef, useState, useEffect } from 'react';

// Constants for testing
const TEST_VIDEO_URL = '/sample-video.mp4';
const FALLBACK_VIDEO_URL = 'https://www.w3schools.com/html/mov_bbb.mp4';

const TestBridgePage: React.FC = () => {
  // Video element reference
  const videoRef = useRef<HTMLVideoElement>(null);
  
  // State for video status
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  
  // Helper functions for readable state values
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

  // Set up video event listeners
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    
    const handleLoadedMetadata = () => {
      console.log("Video metadata loaded");
      if (video.readyState >= 1) {
        setDuration(video.duration);
      }
    };
    
    const handleLoadedData = () => {
      console.log("Video data loaded");
      setLoaded(true);
      setDuration(video.duration);
    };
    
    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime);
    };
    
    const handleError = () => {
      console.error("Video error:", video.error);
      setError(video.error?.message || "Unknown video error");
      
      // Try fallback if main video fails
      if (video.src !== FALLBACK_VIDEO_URL) {
        console.log("Trying fallback video...");
        video.src = FALLBACK_VIDEO_URL;
      }
    };
    
    // Add event listeners
    video.addEventListener("loadedmetadata", handleLoadedMetadata);
    video.addEventListener("loadeddata", handleLoadedData);
    video.addEventListener("timeupdate", handleTimeUpdate);
    video.addEventListener("error", handleError);
    
    // Check if already loaded (for when component mounts after video loads)
    if (video.readyState >= 2) {
      console.log("Video already loaded on mount");
      setLoaded(true);
      setDuration(video.duration);
    }
    
    return () => {
      // Remove event listeners on cleanup
      video.removeEventListener("loadedmetadata", handleLoadedMetadata);
      video.removeEventListener("loadeddata", handleLoadedData);
      video.removeEventListener("timeupdate", handleTimeUpdate);
      video.removeEventListener("error", handleError);
    };
  }, []);
  
  // Play/pause control
  const handlePlay = () => {
    if (videoRef.current) {
      videoRef.current.play()
        .then(() => setIsPlaying(true))
        .catch(err => {
          console.error('Play failed:', err);
          setError(`Play failed: ${err.message}`);
        });
    }
  };
  
  const handlePause = () => {
    if (videoRef.current) {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  };
  
  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (videoRef.current) {
      const time = parseFloat(e.target.value);
      videoRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };
  
  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Simple Video Test Page</h1>
      
      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-2">Video Player</h2>
        <video
          ref={videoRef}
          src={TEST_VIDEO_URL}
          className="w-full max-w-lg border border-gray-300"
          controls
        />
        
        {error && (
          <div className="text-red-500 mt-2">{error}</div>
        )}
      </div>
      
      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-2">Video Status</h2>
        <p><strong>URL:</strong> {videoRef.current?.src || TEST_VIDEO_URL}</p>
        <p><strong>Loaded:</strong> {loaded ? 'Yes' : 'No'}</p>
        <p><strong>Network State:</strong> {videoRef.current ? getNetworkStateText(videoRef.current.networkState) : 'N/A'}</p>
        <p><strong>Ready State:</strong> {videoRef.current ? getReadyStateText(videoRef.current.readyState) : 'N/A'}</p>
        <p><strong>Duration:</strong> {duration.toFixed(2)}s</p>
        <p><strong>Current Time:</strong> {currentTime.toFixed(2)}s</p>
        <p><strong>Playing:</strong> {isPlaying ? 'Yes' : 'No'}</p>
        <p><strong>Load Error:</strong> {error || 'None'}</p>
      </div>
      
      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-2">Custom Controls</h2>
        <div className="flex space-x-2 mb-2">
          <button
            onClick={handlePlay}
            disabled={!loaded || isPlaying}
            className="px-4 py-2 bg-blue-500 text-white rounded disabled:bg-gray-300"
          >
            Play
          </button>
          <button
            onClick={handlePause}
            disabled={!loaded || !isPlaying}
            className="px-4 py-2 bg-blue-500 text-white rounded disabled:bg-gray-300"
          >
            Pause
          </button>
        </div>
        
        <div className="flex items-center space-x-2">
          <span>Seek:</span>
          <input
            type="range"
            min="0"
            max={duration || 100}
            value={currentTime}
            onChange={handleSeek}
            disabled={!loaded}
            className="w-48"
          />
          <span>{currentTime.toFixed(2)}s / {duration.toFixed(2)}s</span>
        </div>
      </div>
      
      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-2">Implementation Plan</h2>
        <p>1. ✅ First test basic HTML5 video functionality - working</p>
        <p>2. Next we'll add the bridge adapter - connecting to useBridgeAdapter</p>
        <p>3. Finally we'll connect to the full VideoContext implementation</p>
      </div>
    </div>
  );
};

export default TestBridgePage;