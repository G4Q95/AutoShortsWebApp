/**
 * VideoContextTimeline.tsx
 * 
 * Part of the VideoContext integration (Phase 2)
 * 
 * A component for visualizing and controlling scene sequence and playback timing
 * specifically for the VideoContext implementation. This displays scenes as blocks
 * on a timeline with proper durations.
 */

import React, { useState, useEffect, useRef } from 'react';
import { useVideoContext } from '../../contexts/VideoContextProvider';

interface Scene {
  id: string;
  media: {
    type: string;
    url: string;
  };
  content: {
    text?: string;
  };
  duration?: number;
}

interface VideoContextTimelineProps {
  scenes: Scene[];
  currentSceneIndex?: number;
  onSceneSelect?: (sceneIndex: number) => void;
  className?: string;
}

const VideoContextTimeline: React.FC<VideoContextTimelineProps> = ({
  scenes,
  currentSceneIndex = 0,
  onSceneSelect,
  className = '',
}) => {
  const { state, actions } = useVideoContext();
  const timelineRef = useRef<HTMLDivElement>(null);
  const [scenePositions, setScenePositions] = useState<Array<{ start: number; end: number }>>([]);
  const [timelineWidth, setTimelineWidth] = useState<number>(0);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  
  // Calculate scene positions and durations
  useEffect(() => {
    if (!scenes || scenes.length === 0) return;
    
    const positions: Array<{ start: number; end: number }> = [];
    let currentTime = 0;
    
    scenes.forEach((scene) => {
      const duration = scene.duration || 5; // Default to 5 seconds
      
      positions.push({
        start: currentTime,
        end: currentTime + duration
      });
      
      currentTime += duration;
    });
    
    setScenePositions(positions);
  }, [scenes]);
  
  // Set up the timeline width based on container size
  useEffect(() => {
    if (timelineRef.current) {
      const updateWidth = () => {
        if (timelineRef.current) {
          setTimelineWidth(timelineRef.current.offsetWidth);
        }
      };
      
      updateWidth();
      window.addEventListener('resize', updateWidth);
      
      return () => {
        window.removeEventListener('resize', updateWidth);
      };
    }
  }, []);
  
  // Update VideoContext when scene positions change
  useEffect(() => {
    if (!state.isReady || !scenePositions.length || scenes.length === 0) return;
    
    // Clear existing sources
    scenes.forEach((scene) => {
      actions.removeSource(scene.id);
    });
    
    // Add sources with proper timing
    scenes.forEach((scene, index) => {
      const { start, end } = scenePositions[index];
      const source = actions.addSource(scene.id, scene.media.url, scene.media.type);
      
      if (source) {
        actions.setSourceTiming(scene.id, start, end);
        
        // Add transition to previous scene if not the first scene
        if (index > 0) {
          const prevScene = scenes[index - 1];
          const transitionStart = scenePositions[index - 1].end - 1; // 1 second overlap
          const transitionEnd = start + 1;
          
          actions.addTransition(
            prevScene.id,
            scene.id,
            'CROSSFADE',
            transitionStart,
            transitionEnd
          );
        }
      }
    });
  }, [state.isReady, scenes, scenePositions, actions]);
  
  // Calculate the position for the playhead based on current time
  const getPlayheadPosition = () => {
    if (state.duration === 0) return 0;
    return (state.currentTime / state.duration) * timelineWidth;
  };
  
  // Handle timeline click for seeking
  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!timelineRef.current || state.duration === 0) return;
    
    const rect = timelineRef.current.getBoundingClientRect();
    const offsetX = e.clientX - rect.left;
    const seekTime = (offsetX / rect.width) * state.duration;
    
    actions.seek(seekTime);
    
    // Find which scene this time falls into
    let foundIndex = 0;
    for (let i = 0; i < scenePositions.length; i++) {
      const { start, end } = scenePositions[i];
      if (seekTime >= start && seekTime < end) {
        foundIndex = i;
        break;
      }
    }
    
    if (onSceneSelect) {
      onSceneSelect(foundIndex);
    }
  };
  
  // Handle playhead drag start
  const handlePlayheadMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsDragging(true);
    
    // Pause while dragging
    if (state.isPlaying) {
      actions.pause();
    }
  };
  
  // Handle playhead drag
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging || !timelineRef.current) return;
      
      const rect = timelineRef.current.getBoundingClientRect();
      const offsetX = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
      const seekTime = (offsetX / rect.width) * state.duration;
      
      actions.seek(seekTime);
    };
    
    const handleMouseUp = () => {
      setIsDragging(false);
    };
    
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, actions, state.duration]);
  
  return (
    <div className={`videocontext-timeline ${className}`} data-testid="videocontext-timeline">
      <div 
        ref={timelineRef}
        className="timeline-track relative h-16 bg-gray-200 rounded-md overflow-hidden"
        onClick={handleTimelineClick}
        data-testid="videocontext-timeline-track"
      >
        {/* Scene blocks */}
        {scenes.map((scene, index) => {
          if (!scenePositions[index]) return null;
          
          const { start, end } = scenePositions[index];
          const duration = state.duration || 1;
          const leftPos = (start / duration) * 100;
          const width = ((end - start) / duration) * 100;
          
          return (
            <div
              key={scene.id}
              className={`scene-block absolute h-full ${
                index === currentSceneIndex ? 'bg-blue-500' : 'bg-blue-300'
              }`}
              style={{
                left: `${leftPos}%`,
                width: `${width}%`
              }}
              onClick={(e) => {
                e.stopPropagation();
                if (onSceneSelect) onSceneSelect(index);
              }}
              data-testid={`videocontext-scene-block-${index}`}
            >
              <div className="scene-label absolute top-1 left-1 text-xs text-white">
                {index + 1}
              </div>
            </div>
          );
        })}
        
        {/* Playhead */}
        <div
          className="playhead absolute top-0 bottom-0 w-0.5 bg-red-500 cursor-ew-resize z-10"
          style={{ left: `${getPlayheadPosition()}px` }}
          onMouseDown={handlePlayheadMouseDown}
          data-testid="videocontext-playhead"
        >
          <div className="playhead-handle w-3 h-3 bg-red-500 rounded-full absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2" />
        </div>
        
        {/* Time markers */}
        <div className="time-markers absolute bottom-0 left-0 right-0 h-4 text-xs text-gray-600 flex">
          {Array.from({ length: 5 }).map((_, i) => (
            <div 
              key={i} 
              className="marker absolute border-l border-gray-400 h-2"
              style={{ left: `${i * 25}%` }}
            >
              <span className="absolute -left-3 top-2">
                {Math.round((i * state.duration) / 4)}s
              </span>
            </div>
          ))}
        </div>
      </div>
      
      {/* Timeline controls */}
      <div className="timeline-controls flex items-center justify-between mt-2">
        <button
          onClick={() => actions.play()}
          className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded-md text-sm"
          disabled={state.isPlaying}
          data-testid="videocontext-play-button"
        >
          Play
        </button>
        
        <button
          onClick={() => actions.pause()}
          className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded-md text-sm"
          disabled={!state.isPlaying}
          data-testid="videocontext-pause-button"
        >
          Pause
        </button>
        
        <button
          onClick={() => actions.seek(0)}
          className="bg-gray-500 hover:bg-gray-600 text-white px-3 py-1 rounded-md text-sm"
          data-testid="videocontext-reset-button"
        >
          Reset
        </button>
      </div>
    </div>
  );
};

export default VideoContextTimeline; 