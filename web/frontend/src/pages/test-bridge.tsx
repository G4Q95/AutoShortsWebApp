import React, { useRef, useState, useEffect, useCallback } from 'react';

// Constants for testing
const TEST_VIDEO_URL = '/sample-video.mp4';
const FALLBACK_VIDEO_URL = 'https://www.w3schools.com/html/mov_bbb.mp4';

const TestBridgePage: React.FC = () => {
  // Element references
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // UI state
  const [showFirstFrame, setShowFirstFrame] = useState(false);
  
  // Video state
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

  // Draw the current frame to canvas
  const drawFrameToCanvas = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) {
      console.log('Cannot draw frame: video or canvas not available');
      return false;
    }
    
    try {
      const context = canvasRef.current.getContext('2d');
      if (!context) {
        console.log('Cannot draw frame: canvas context not available');
        return false;
      }
      
      // Set canvas dimensions to match video
      canvasRef.current.width = videoRef.current.videoWidth;
      canvasRef.current.height = videoRef.current.videoHeight;
      
      // Draw video frame to canvas
      context.drawImage(
        videoRef.current,
        0, 0,
        canvasRef.current.width,
        canvasRef.current.height
      );
      
      console.log('Frame drawn to canvas successfully');
      return true;
    } catch (err) {
      console.error('Error drawing frame to canvas:', err);
      return false;
    }
  }, [videoRef, canvasRef]);

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
      
      // Try to draw the first frame once loaded
      if (showFirstFrame) {
        drawFrameToCanvas();
      }
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
    
    // Set initial video source
    video.src = TEST_VIDEO_URL;
    
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
      
      // Try to draw the first frame right away
      if (showFirstFrame) {
        drawFrameToCanvas();
      }
    }
    
    return () => {
      // Remove event listeners on cleanup
      video.removeEventListener("loadedmetadata", handleLoadedMetadata);
      video.removeEventListener("loadeddata", handleLoadedData);
      video.removeEventListener("timeupdate", handleTimeUpdate);
      video.removeEventListener("error", handleError);
    };
  }, [showFirstFrame, drawFrameToCanvas]);
  
  // Handle visibility changes with useEffect
  useEffect(() => {
    if (!videoRef.current || !canvasRef.current) return;
    
    if (showFirstFrame) {
      // Pause video, draw frame to canvas, show canvas, hide video
      if (videoRef.current.readyState >= 2) {
        if (isPlaying) {
          videoRef.current.pause();
          setIsPlaying(false);
        }
        
        if (drawFrameToCanvas()) {
          // Toggle visibility
          canvasRef.current.style.display = 'block';
          videoRef.current.style.visibility = 'hidden';
          console.log("Showing canvas, hiding video");
        } else {
          // If drawing fails, keep video visible as fallback
          canvasRef.current.style.display = 'none';
          videoRef.current.style.visibility = 'visible';
          console.log("Failed to draw to canvas, keeping video visible");
        }
      }
    } else {
      // Hide canvas, show video
      canvasRef.current.style.display = 'none';
      videoRef.current.style.visibility = 'visible';
      console.log("Showing video, hiding canvas");
    }
  }, [showFirstFrame, isPlaying, drawFrameToCanvas]);
  
  // Toggle showing first frame (canvas)
  const toggleFirstFrame = () => {
    setShowFirstFrame(prev => !prev);
  };
  
  // Play/pause control
  const handlePlay = () => {
    if (showFirstFrame) {
      // If showing first frame, switch to video
      setShowFirstFrame(false);
    }
    
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
    const time = parseFloat(e.target.value);
    
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      setCurrentTime(time);
      
      // If showing canvas, redraw after seek
      if (showFirstFrame && videoRef.current.readyState >= 2) {
        drawFrameToCanvas();
      }
    }
  };
  
  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Simple Video Test Page</h1>
      
      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-2">Video Player</h2>
        <div className="relative w-full max-w-lg border border-gray-300">
          {/* Canvas for first frame display */}
          <canvas 
            ref={canvasRef}
            className="absolute top-0 left-0 w-full h-full"
            style={{ display: 'none' }}
          />
          
          {/* Video element */}
          <video
            ref={videoRef}
            className="w-full"
            controls={!showFirstFrame}
          />
        </div>
        
        {error && (
          <div className="text-red-500 mt-2">{error}</div>
        )}
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div>
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
        
        <div>
          <h2 className="text-xl font-semibold mb-2">First Frame Status</h2>
          <p><strong>Show First Frame:</strong> {showFirstFrame ? 'Yes' : 'No'}</p>
          <p><strong>Canvas Width:</strong> {canvasRef.current?.width || 0}px</p>
          <p><strong>Canvas Height:</strong> {canvasRef.current?.height || 0}px</p>
          <p><strong>Video Width:</strong> {videoRef.current?.videoWidth || 0}px</p>
          <p><strong>Video Height:</strong> {videoRef.current?.videoHeight || 0}px</p>
        </div>
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
          <button
            onClick={toggleFirstFrame}
            disabled={!loaded}
            className="px-4 py-2 bg-green-500 text-white rounded disabled:bg-gray-300"
          >
            {showFirstFrame ? 'Show Video' : 'Show First Frame'}
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
        <p>2. 🟡 Direct canvas implementation - in progress</p>
        <p>3. Next: Apply lessons to bridge adapter</p>
      </div>
    </div>
  );
};

export default TestBridgePage;