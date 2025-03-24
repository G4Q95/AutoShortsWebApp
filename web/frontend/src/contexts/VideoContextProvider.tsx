import React, { createContext, useContext, useRef, useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
// Import just the type, not the actual implementation
import type VideoContextManager from '../utils/video/videoContextManager';

// Define the context type
interface VideoContextProviderProps {
  children: React.ReactNode;
}

interface VideoContextState {
  isReady: boolean;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  manager: VideoContextManager | null;
}

interface VideoContextActions {
  play: () => void;
  pause: () => void;
  seek: (time: number) => void;
  addSource: (id: string, url: string, mediaType: string) => any;
  removeSource: (id: string) => void;
  setSourceTiming: (id: string, startTime: number, endTime: number) => void;
  addEffect: (sourceId: string, effectType: any, options?: any) => any;
  removeEffect: (effectId: string) => void;
  addTransition: (sourceAId: string, sourceBId: string, type: any, startTime: number, endTime: number, mix?: number) => any;
  removeTransition: (transitionId: string) => void;
}

interface VideoContextContextValue {
  state: VideoContextState;
  actions: VideoContextActions;
}

// Create the context
const VideoContextContext = createContext<VideoContextContextValue | undefined>(undefined);

// Create an initial state for server-side rendering
const initialState: VideoContextState = {
  isReady: false,
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  manager: null,
};

// Create empty actions for server-side rendering
const emptyActions: VideoContextActions = {
  play: () => {},
  pause: () => {},
  seek: () => {},
  addSource: () => null,
  removeSource: () => {},
  setSourceTiming: () => {},
  addEffect: () => null,
  removeEffect: () => {},
  addTransition: () => null,
  removeTransition: () => {},
};

// Provider component
export const VideoContextProvider: React.FC<VideoContextProviderProps> = ({ children }) => {
  const [isClient, setIsClient] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const managerRef = useRef<VideoContextManager | null>(null);
  
  // State for tracking playback status and time
  const [isReady, setIsReady] = useState<boolean>(false);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  
  // Check if we're on the client side
  useEffect(() => {
    setIsClient(true);
  }, []);
  
  // Only set up VideoContext on the client
  useEffect(() => {
    if (!isClient) return;

    // Dynamically import VideoContextManager
    const initializeManager = async () => {
      try {
        // Create a canvas element if one doesn't exist
        if (!canvasRef.current) {
          const canvas = document.createElement('canvas');
          canvas.width = 1080;
          canvas.height = 1920;
          canvas.style.display = 'none'; // Hide the canvas initially
          document.body.appendChild(canvas);
          canvasRef.current = canvas;
        }
        
        // Dynamically import the VideoContextManager
        const { default: VideoContextManagerModule } = await import('../utils/video/videoContextManager');
        
        // Initialize the VideoContextManager
        if (canvasRef.current && !managerRef.current) {
          const manager = new VideoContextManagerModule(canvasRef.current);
          managerRef.current = manager;
          
          // Set up event handlers
          manager.registerEvent('ended', () => {
            setIsPlaying(false);
          });
          
          manager.registerEvent('timeupdate', () => {
            if (manager) {
              setCurrentTime(manager.getCurrentTime());
            }
          });
          
          setIsReady(true);
        }
      } catch (error) {
        console.error('Error initializing VideoContextManager:', error);
        setIsReady(false);
      }
    };
    
    initializeManager();
    
    // Clean up on unmount
    return () => {
      if (managerRef.current) {
        managerRef.current.destroy();
        managerRef.current = null;
      }
      
      if (canvasRef.current && document.body.contains(canvasRef.current)) {
        document.body.removeChild(canvasRef.current);
        canvasRef.current = null;
      }
      
      setIsReady(false);
    };
  }, [isClient]);
  
  // Update duration when manager reports changes
  useEffect(() => {
    if (!isClient) return;
    
    if (managerRef.current) {
      const checkDuration = () => {
        const newDuration = managerRef.current?.getDuration() || 0;
        if (newDuration !== duration) {
          setDuration(newDuration);
        }
      };
      
      // Check initially and set up interval
      checkDuration();
      const interval = setInterval(checkDuration, 1000); // Check every second
      
      return () => clearInterval(interval);
    }
  }, [duration, isClient]);
  
  // If we're on the server, return a default context value
  if (!isClient) {
    return (
      <VideoContextContext.Provider value={{ state: initialState, actions: emptyActions }}>
        {children}
      </VideoContextContext.Provider>
    );
  }
  
  // Actions for manipulating the VideoContext
  const play = () => {
    if (managerRef.current) {
      managerRef.current.play();
      setIsPlaying(true);
    }
  };
  
  const pause = () => {
    if (managerRef.current) {
      managerRef.current.pause();
      setIsPlaying(false);
    }
  };
  
  const seek = (time: number) => {
    if (managerRef.current) {
      managerRef.current.seek(time);
      setCurrentTime(time);
    }
  };
  
  const addSource = (id: string, url: string, mediaType: string) => {
    try {
      if (managerRef.current) {
        return managerRef.current.addSource(id, url, mediaType);
      }
      return null;
    } catch (error) {
      console.error('Error adding source:', error);
      return null;
    }
  };
  
  const removeSource = (id: string) => {
    if (managerRef.current) {
      managerRef.current.removeSource(id);
    }
  };
  
  const setSourceTiming = (id: string, startTime: number, endTime: number) => {
    if (managerRef.current) {
      managerRef.current.setSourceTiming(id, startTime, endTime);
    }
  };
  
  const addEffect = (sourceId: string, effectType: any, options = {}) => {
    if (managerRef.current) {
      return managerRef.current.addEffect(sourceId, effectType, options);
    }
    return null;
  };
  
  const removeEffect = (effectId: string) => {
    if (managerRef.current) {
      managerRef.current.removeEffect(effectId);
    }
  };
  
  const addTransition = (sourceAId: string, sourceBId: string, type: any, startTime: number, endTime: number, mix = 1.0) => {
    if (managerRef.current) {
      return managerRef.current.addTransition(sourceAId, sourceBId, type, startTime, endTime, mix);
    }
    return null;
  };
  
  const removeTransition = (transitionId: string) => {
    if (managerRef.current) {
      managerRef.current.removeTransition(transitionId);
    }
  };
  
  // Combine state and actions for context value
  const contextValue = {
    state: {
      isReady,
      isPlaying,
      currentTime,
      duration,
      manager: managerRef.current,
    },
    actions: {
      play,
      pause,
      seek,
      addSource,
      removeSource,
      setSourceTiming,
      addEffect,
      removeEffect,
      addTransition,
      removeTransition
    }
  };
  
  return (
    <VideoContextContext.Provider value={contextValue}>
      {children}
    </VideoContextContext.Provider>
  );
};

// Custom hook for using the VideoContext
export const useVideoContext = () => {
  const context = useContext(VideoContextContext);
  
  if (context === undefined) {
    throw new Error('useVideoContext must be used within a VideoContextProvider');
  }
  
  return context;
};

export default VideoContextProvider; 