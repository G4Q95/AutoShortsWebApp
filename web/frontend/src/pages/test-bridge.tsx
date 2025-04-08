import React, { useRef, useState, useEffect, useCallback } from "react";
import { useBridgeAdapter } from "@/hooks/new/useBridgeAdapter";

// Test video from W3Schools - reliable source
const TEST_VIDEO_URL = "https://www.w3schools.com/html/mov_bbb.mp4";

// Helper functions for video state debugging
const getReadyStateText = (state: number) => {
  switch (state) {
    case 0: return "0 (HAVE_NOTHING)";
    case 1: return "1 (HAVE_METADATA)";
    case 2: return "2 (HAVE_CURRENT_DATA)";
    case 3: return "3 (HAVE_FUTURE_DATA)";
    case 4: return "4 (HAVE_ENOUGH_DATA)";
    default: return `${state} (UNKNOWN)`;
  }
};

const getNetworkStateText = (state: number) => {
  switch (state) {
    case 0: return "0 (NETWORK_EMPTY)";
    case 1: return "1 (NETWORK_IDLE)";
    case 2: return "2 (NETWORK_LOADING)";
    case 3: return "3 (NETWORK_NO_SOURCE)";
    default: return `${state} (UNKNOWN)`;
  }
};

export default function TestBridgePage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  
  // Video state tracking
  const [videoLoaded, setVideoLoaded] = useState(false);
  const [videoLoadError, setVideoLoadError] = useState<string | null>(null);
  const [videoCurrentTime, setVideoCurrentTime] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);
  const [videoReadyState, setVideoReadyState] = useState(0);
  const [videoNetworkState, setVideoNetworkState] = useState(0);
  
  // Bridge state tracking
  const [bridgeInitialized, setBridgeInitialized] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [bridgeError, setBridgeError] = useState<string | null>(null);
  
  // Initialize bridge adapter with error handling
  const bridge = useBridgeAdapter({
    videoRef,
    onError: (error: Error) => {
      console.error("Bridge error:", error);
      setBridgeError(error.message);
    }
  });
  
  // Video event handlers
  const handleLoadedMetadata = useCallback(() => {
    console.log("Video metadata loaded");
    if (videoRef.current) {
      setVideoDuration(videoRef.current.duration);
      setVideoReadyState(videoRef.current.readyState);
      setVideoNetworkState(videoRef.current.networkState);
    }
  }, []);
  
  const handleLoadedData = useCallback(() => {
    console.log("Video data loaded");
    setVideoLoaded(true);
    if (videoRef.current) {
      setVideoReadyState(videoRef.current.readyState);
      setVideoNetworkState(videoRef.current.networkState);
    }
  }, []);
  
  const handleTimeUpdate = useCallback(() => {
    if (videoRef.current) {
      setVideoCurrentTime(videoRef.current.currentTime);
    }
  }, []);
  
  const handleError = useCallback(() => {
    console.error("Video error:", videoRef.current?.error);
    setVideoLoadError(videoRef.current?.error?.message || "Unknown video error");
    setVideoNetworkState(videoRef.current?.networkState || 0);
    setVideoReadyState(videoRef.current?.readyState || 0);
  }, []);

  // Set up video event listeners
  useEffect(() => {
    const video = videoRef.current;
    
    if (video) {
      video.addEventListener("loadedmetadata", handleLoadedMetadata);
      video.addEventListener("loadeddata", handleLoadedData);
      video.addEventListener("timeupdate", handleTimeUpdate);
      video.addEventListener("error", handleError);
      
      // Update states initially
      setVideoReadyState(video.readyState);
      setVideoNetworkState(video.networkState);
      
      return () => {
        video.removeEventListener("loadedmetadata", handleLoadedMetadata);
        video.removeEventListener("loadeddata", handleLoadedData);
        video.removeEventListener("timeupdate", handleTimeUpdate);
        video.removeEventListener("error", handleError);
      };
    }
  }, [handleLoadedData, handleLoadedMetadata, handleTimeUpdate, handleError]);

  // Bridge initialization and cleanup
  useEffect(() => {
    // Only try to initialize bridge once video has metadata
    if (videoRef.current && videoRef.current.readyState >= 1 && !bridgeInitialized) {
      console.log("Video element ready, initializing bridge");
      
      // Check if bridge is available
      if (bridge) {
        console.log("Bridge adapter initialized successfully");
        setBridgeInitialized(true);
      } else {
        console.error("Failed to initialize bridge adapter");
      }
    }
    
    return () => {
      // Clean up bridge on unmount
      if (bridge) {
        console.log("Cleaning up bridge");
        bridge.destroy?.();
      }
    };
  }, [bridge, bridgeInitialized]);

  // Video control functions
  const handlePlay = () => {
    if (bridge && videoRef.current) {
      console.log("Play requested");
      bridge.legacyPlay()
        .then(() => {
          console.log("Play successful");
          setIsPlaying(true);
        })
        .catch(err => {
          console.error("Play failed:", err);
          setBridgeError(`Play error: ${err.message}`);
        });
    }
  };

  const handlePause = () => {
    if (bridge && videoRef.current) {
      console.log("Pause requested");
      bridge.legacyPause()
        .then(() => {
          console.log("Pause successful");
          setIsPlaying(false);
        })
        .catch(err => {
          console.error("Pause failed:", err);
          setBridgeError(`Pause error: ${err.message}`);
        });
    }
  };

  const handleSeek = (time: number) => {
    if (bridge && videoRef.current) {
      console.log(`Seek requested: ${time}`);
      bridge.legacySeek(time)
        .then(() => {
          console.log("Seek successful");
        })
        .catch(err => {
          console.error("Seek failed:", err);
          setBridgeError(`Seek error: ${err.message}`);
        });
    }
  };

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-6">Video Context Bridge Test Page</h1>
      
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Test Video</h2>
        <div className="relative aspect-video w-full max-w-2xl bg-gray-200">
          <video
            ref={videoRef}
            src={TEST_VIDEO_URL}
            className="w-full h-full"
            crossOrigin="anonymous"
            playsInline
            preload="auto"
            poster="/sample-poster.jpg"
            controls
          />
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="p-4 border rounded-md">
          <h2 className="text-xl font-semibold mb-2">Video Status</h2>
          <div className="space-y-2">
            <p><strong>URL:</strong> {TEST_VIDEO_URL}</p>
            <p><strong>Loaded:</strong> {videoLoaded ? "Yes" : "No"}</p>
            <p><strong>Network State:</strong> {getNetworkStateText(videoNetworkState)}</p>
            <p><strong>Ready State:</strong> {getReadyStateText(videoReadyState)}</p>
            <p><strong>Duration:</strong> {videoDuration.toFixed(2)}s</p>
            <p><strong>Current Time:</strong> {videoCurrentTime.toFixed(2)}s</p>
            <p><strong>Load Error:</strong> {videoLoadError || "None"}</p>
          </div>
        </div>
        
        <div className="p-4 border rounded-md">
          <h2 className="text-xl font-semibold mb-2">Bridge Status</h2>
          <div className="space-y-2">
            <p><strong>Initialized:</strong> {bridgeInitialized ? "Yes" : "No"}</p>
            <p><strong>Is Playing:</strong> {isPlaying ? "Yes" : "No"}</p>
            <p><strong>Current Time:</strong> {videoCurrentTime.toFixed(2)}s</p>
            <p><strong>Duration:</strong> {videoDuration.toFixed(2)}s</p>
            <p><strong>Bridge Error:</strong> {bridgeError || "None"}</p>
          </div>
        </div>
      </div>
      
      <div className="mt-8">
        <h2 className="text-xl font-semibold mb-4">Bridge Controls</h2>
        <div className="flex space-x-4">
          <button
            onClick={handlePlay}
            disabled={!videoLoaded || isPlaying}
            className="px-4 py-2 bg-blue-500 text-white rounded disabled:bg-gray-300"
          >
            Play
          </button>
          <button
            onClick={handlePause}
            disabled={!videoLoaded || !isPlaying}
            className="px-4 py-2 bg-blue-500 text-white rounded disabled:bg-gray-300"
          >
            Pause
          </button>
        </div>
        
        <div className="mt-4">
          <label className="block mb-2">Seek:</label>
          <input
            type="range"
            min={0}
            max={videoDuration}
            step={0.1}
            value={videoCurrentTime}
            onChange={(e) => handleSeek(parseFloat(e.target.value))}
            disabled={!videoLoaded}
            className="w-full max-w-md"
          />
          <div className="text-sm mt-1">
            {videoCurrentTime.toFixed(2)}s / {videoDuration.toFixed(2)}s
          </div>
        </div>
      </div>
      
      <div className="mt-8">
        <h2 className="text-xl font-semibold mb-4">Implementation Notes</h2>
        <div className="p-4 bg-gray-100 rounded">
          <p className="mb-2">
            This is a simplified test page for debugging video loading and bridge issues.
          </p>
          <p className="mb-2">
            The page uses a direct HTML5 video element with the Bridge adapter for basic playback control.
          </p>
          <p>
            Once basic playback is confirmed to work, we'll transition to the full VideoContext implementation.
          </p>
        </div>
      </div>
    </div>
  );
}