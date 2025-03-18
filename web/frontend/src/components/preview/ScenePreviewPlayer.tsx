/**
 * ScenePreviewPlayer - Component for playing scene media with synchronized audio
 * 
 * This component handles both image and video media types, synchronizes with audio,
 * and provides playback controls.
 */

import React, { useState, useRef, useEffect } from 'react';
import { PlayIcon, PauseIcon } from 'lucide-react';

interface ScenePreviewPlayerProps {
  projectId: string;
  sceneId: string;
  mediaUrl: string;
  audioUrl?: string;
  mediaType: 'image' | 'video' | 'gallery';
  trim?: { start: number; end: number };
  onTrimChange?: (start: number, end: number) => void;
  className?: string;
}

const ScenePreviewPlayer = ({
  projectId,
  sceneId,
  mediaUrl,
  audioUrl,
  mediaType,
  trim = { start: 0, end: 0 },
  onTrimChange,
  className = '',
}: ScenePreviewPlayerProps) => {
  // State for player
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [volume, setVolume] = useState<number>(1);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  
  // Refs for media elements
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  
  // Initialize player
  useEffect(() => {
    setIsLoading(true);
    
    // If we have audio, set up event listeners
    if (audioUrl && audioRef.current) {
      const audio = audioRef.current;
      
      // Set up audio event listeners
      audio.addEventListener('loadedmetadata', handleAudioMetadata);
      audio.addEventListener('timeupdate', handleTimeUpdate);
      audio.addEventListener('ended', handleMediaEnded);
      
      // Cleanup event listeners
      return () => {
        audio.removeEventListener('loadedmetadata', handleAudioMetadata);
        audio.removeEventListener('timeupdate', handleTimeUpdate);
        audio.removeEventListener('ended', handleMediaEnded);
      };
    }
  }, [audioUrl]);
  
  // Set up video event listeners if needed
  useEffect(() => {
    if (mediaType === 'video' && videoRef.current) {
      const video = videoRef.current;
      
      // Set up video event listeners
      video.addEventListener('loadedmetadata', handleVideoMetadata);
      video.addEventListener('timeupdate', handleTimeUpdate);
      video.addEventListener('ended', handleMediaEnded);
      
      // Cleanup event listeners
      return () => {
        video.removeEventListener('loadedmetadata', handleVideoMetadata);
        video.removeEventListener('timeupdate', handleTimeUpdate);
        video.removeEventListener('ended', handleMediaEnded);
      };
    }
  }, [mediaType, mediaUrl]);
  
  // Handler functions
  const handleAudioMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
      setIsLoading(false);
      
      // If we're showing an image, the audio duration becomes the total duration
      if (mediaType === 'image') {
        // Set trim.end to audio duration if not already set
        if (trim.end === 0 && onTrimChange) {
          onTrimChange(trim.start, audioRef.current.duration);
        }
      }
    }
  };
  
  const handleVideoMetadata = () => {
    if (videoRef.current) {
      // For videos, we use the video duration unless the audio is longer
      if (audioRef.current && audioRef.current.duration > videoRef.current.duration) {
        setDuration(audioRef.current.duration);
      } else {
        setDuration(videoRef.current.duration);
      }
      
      setIsLoading(false);
      
      // Set default trim.end to video duration if not already set
      if (trim.end === 0 && onTrimChange) {
        onTrimChange(trim.start, videoRef.current.duration);
      }
    }
  };
  
  const handleTimeUpdate = () => {
    // Update current time based on the appropriate media element
    if (mediaType === 'video' && videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
      
      // Sync audio with video if needed
      if (audioRef.current && Math.abs(audioRef.current.currentTime - videoRef.current.currentTime) > 0.1) {
        audioRef.current.currentTime = videoRef.current.currentTime;
      }
    } else if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
    
    // Handle trim end point (stop playback)
    if (trim.end > 0 && currentTime >= trim.end) {
      handlePause();
      
      // Reset to start position
      if (mediaType === 'video' && videoRef.current) {
        videoRef.current.currentTime = trim.start;
      }
      if (audioRef.current) {
        audioRef.current.currentTime = trim.start;
      }
      
      setCurrentTime(trim.start);
    }
  };
  
  const handleMediaEnded = () => {
    setIsPlaying(false);
    
    // Reset to start position
    if (mediaType === 'video' && videoRef.current) {
      videoRef.current.currentTime = trim.start;
    }
    if (audioRef.current) {
      audioRef.current.currentTime = trim.start;
    }
    
    setCurrentTime(trim.start);
  };
  
  // Playback control functions
  const handlePlay = () => {
    setIsPlaying(true);
    
    // Start playback from trim.start if at beginning
    if (currentTime < trim.start || currentTime >= trim.end) {
      if (mediaType === 'video' && videoRef.current) {
        videoRef.current.currentTime = trim.start;
      }
      if (audioRef.current) {
        audioRef.current.currentTime = trim.start;
      }
      setCurrentTime(trim.start);
    }
    
    // Play the appropriate media
    if (mediaType === 'video' && videoRef.current) {
      videoRef.current.play();
    }
    if (audioRef.current) {
      audioRef.current.play();
    }
  };
  
  const handlePause = () => {
    setIsPlaying(false);
    
    // Pause the appropriate media
    if (mediaType === 'video' && videoRef.current) {
      videoRef.current.pause();
    }
    if (audioRef.current) {
      audioRef.current.pause();
    }
  };
  
  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value);
    setCurrentTime(newTime);
    
    // Update media position
    if (mediaType === 'video' && videoRef.current) {
      videoRef.current.currentTime = newTime;
    }
    if (audioRef.current) {
      audioRef.current.currentTime = newTime;
    }
  };
  
  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    setIsMuted(newVolume === 0);
    
    // Update volume of media elements
    if (mediaType === 'video' && videoRef.current) {
      videoRef.current.volume = newVolume;
    }
    if (audioRef.current) {
      audioRef.current.volume = newVolume;
    }
  };
  
  const toggleMute = () => {
    setIsMuted(!isMuted);
    
    // Update volume of media elements
    if (mediaType === 'video' && videoRef.current) {
      videoRef.current.muted = !isMuted;
    }
    if (audioRef.current) {
      audioRef.current.muted = !isMuted;
    }
  };
  
  // Helper function to format time
  const formatTime = (timeInSeconds: number): string => {
    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = Math.floor(timeInSeconds % 60);
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };
  
  return (
    <div 
      className={`flex flex-col bg-gray-900 rounded-lg overflow-hidden ${className}`}
      data-testid="scene-preview-player"
    >
      {/* Media Display */}
      <div className="relative aspect-video bg-black flex items-center justify-center">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
          </div>
        )}
        
        {mediaType === 'video' ? (
          <video 
            ref={videoRef}
            src={mediaUrl}
            className="w-full h-full object-contain max-h-full"
            playsInline
            muted={isMuted}
            data-testid="video-element"
            style={{ maxWidth: '100%', margin: 'auto' }}
          />
        ) : (
          <img 
            ref={imageRef}
            src={mediaUrl}
            alt="Scene content"
            className="w-full h-full object-contain max-h-full"
            data-testid="image-element"
            style={{ maxWidth: '100%', margin: 'auto' }}
          />
        )}
        
        {/* Hidden audio element */}
        {audioUrl && (
          <audio 
            ref={audioRef} 
            src={audioUrl} 
            preload="metadata"
            data-testid="audio-element"
          />
        )}
        
        {/* Play/Pause overlay */}
        <button
          onClick={isPlaying ? handlePause : handlePlay}
          className="absolute inset-0 w-full h-full flex items-center justify-center bg-black bg-opacity-0 hover:bg-opacity-20 transition-opacity"
          data-testid="play-pause-button"
        >
          {isPlaying ? (
            <PauseIcon className="w-16 h-16 text-white opacity-70" />
          ) : (
            <PlayIcon className="w-16 h-16 text-white opacity-70" />
          )}
        </button>
      </div>
      
      {/* Controls */}
      <div className="bg-gray-800 p-3 text-white">
        {/* Progress bar */}
        <div className="flex items-center mb-2">
          <span className="text-xs">{formatTime(currentTime)}</span>
          <input
            type="range"
            min={0}
            max={duration}
            value={currentTime}
            onChange={handleSeek}
            className="flex-grow mx-2 h-2 rounded-full bg-gray-600 appearance-none"
            step="0.1"
            data-testid="seek-slider"
          />
          <span className="text-xs">{formatTime(duration)}</span>
        </div>
        
        {/* Playback controls */}
        <div className="flex items-center">
          <button
            onClick={isPlaying ? handlePause : handlePlay}
            className="mr-3"
            data-testid="play-pause-control"
          >
            {isPlaying ? (
              <PauseIcon className="w-6 h-6" />
            ) : (
              <PlayIcon className="w-6 h-6" />
            )}
          </button>
          
          {/* Volume control */}
          <button
            onClick={toggleMute}
            className="mr-2"
            data-testid="mute-button"
          >
            {isMuted ? (
              <span>🔇</span>
            ) : (
              <span>🔊</span>
            )}
          </button>
          
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={volume}
            onChange={handleVolumeChange}
            className="w-20 h-2 rounded-full bg-gray-600 appearance-none"
            data-testid="volume-slider"
          />
        </div>
      </div>
    </div>
  );
};

export default ScenePreviewPlayer; 