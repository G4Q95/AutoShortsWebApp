import React, { useState, useRef, useEffect } from 'react';
import { Play as PlayIcon, Pause as PauseIcon, RotateCw as RegenerateIcon } from 'lucide-react';

interface AudioPlayerProps {
  /** The audio source URL */
  audioSrc: string | null;
  /** Whether audio is currently being generated */
  isGenerating?: boolean;
  /** Callback to regenerate audio */
  onRegenerate?: () => void;
  /** Initial volume (0-1) */
  initialVolume?: number;
  /** Initial playback speed (0.5-2) */
  initialPlaybackSpeed?: number;
  /** Error message to display */
  errorMessage?: string | null;
  /** Additional CSS classes for container */
  className?: string;
}

/**
 * A reusable audio player component with playback controls
 * 
 * Features:
 * - Play/pause functionality
 * - Current time and duration display
 * - Volume control
 * - Regenerate button (optional)
 * - Error message display
 * 
 * @param props - Component props
 * @returns JSX element
 */
export const AudioPlayer: React.FC<AudioPlayerProps> = ({
  audioSrc,
  isGenerating = false,
  onRegenerate,
  initialVolume = 1,
  initialPlaybackSpeed = 1,
  errorMessage = null,
  className = '',
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(initialVolume);
  const [playbackSpeed, setPlaybackSpeed] = useState(initialPlaybackSpeed);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  
  const audioRef = useRef<HTMLAudioElement>(null);

  // Initialize audio element
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
      audioRef.current.playbackRate = playbackSpeed;
    }
  }, [audioSrc]);

  // Add event listeners for audio playback state
  useEffect(() => {
    const audioElement = audioRef.current;
    
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleEnded = () => setIsPlaying(false);
    const handleTimeUpdate = () => {
      if (audioElement) {
        setCurrentTime(audioElement.currentTime);
      }
    };
    const handleDurationChange = () => {
      if (audioElement) {
        setDuration(audioElement.duration);
      }
    };
    
    if (audioElement) {
      audioElement.addEventListener('play', handlePlay);
      audioElement.addEventListener('pause', handlePause);
      audioElement.addEventListener('ended', handleEnded);
      audioElement.addEventListener('timeupdate', handleTimeUpdate);
      audioElement.addEventListener('durationchange', handleDurationChange);
    }
    
    return () => {
      if (audioElement) {
        audioElement.removeEventListener('play', handlePlay);
        audioElement.removeEventListener('pause', handlePause);
        audioElement.removeEventListener('ended', handleEnded);
        audioElement.removeEventListener('timeupdate', handleTimeUpdate);
        audioElement.removeEventListener('durationchange', handleDurationChange);
      }
    };
  }, [audioRef.current]);

  // Format time for display (converts seconds to mm:ss format)
  const formatTime = (timeInSeconds: number): string => {
    if (isNaN(timeInSeconds)) return "0:00";
    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = Math.floor(timeInSeconds % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // Play/pause toggle
  const togglePlayPause = () => {
    if (audioRef.current) {
      if (audioRef.current.paused) {
        audioRef.current.play().catch(e => console.error("Error playing audio:", e));
      } else {
        audioRef.current.pause();
      }
    }
  };

  // Handle volume change
  const handleVolumeChange = (newVolume: number) => {
    setVolume(newVolume);
    if (audioRef.current) {
      audioRef.current.volume = newVolume;
    }
  };

  // Handle playback speed change
  const handlePlaybackSpeedChange = (newSpeed: number) => {
    setPlaybackSpeed(newSpeed);
    if (audioRef.current) {
      audioRef.current.playbackRate = newSpeed;
    }
  };

  // Add volume slider styles
  useEffect(() => {
    // Use a class-based approach to avoid injecting styles
    const styleElement = document.head.querySelector('#audio-player-styles');
    
    if (!styleElement) {
      const styleSheet = document.createElement('style');
      styleSheet.id = 'audio-player-styles';
      styleSheet.textContent = `
        .audio-player-volume-slider {
          height: 6px;
          appearance: none;
          width: 100%;
          background: rgba(255, 255, 255, 0.7);
          border-radius: 3px;
          outline: none;
        }
        
        .audio-player-volume-slider::-webkit-slider-thumb {
          appearance: none;
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background: white;
          cursor: pointer;
          border: none;
          box-shadow: 0 0 2px rgba(0,0,0,0.4);
        }
        
        .audio-player-volume-slider::-moz-range-thumb {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background: white;
          cursor: pointer;
          border: none;
          box-shadow: 0 0 2px rgba(0,0,0,0.4);
        }
      `;
      document.head.appendChild(styleSheet);
    }
    
    return () => {
      // Don't remove the global styles as other instances might need them
    };
  }, []);

  if (errorMessage) {
    return (
      <div className={`text-xs text-red-600 bg-red-50 p-1 rounded ${className}`}>
        {errorMessage}
      </div>
    );
  }

  return (
    <div className={`audio-player ${className}`}>
      {/* Hidden audio element */}
      <audio ref={audioRef} src={audioSrc || ''} className="hidden" />
      
      {/* Audio controls */}
      <div className="flex items-center w-full justify-between bg-gray-800 rounded p-1.5">
        {/* Left side - play button and time */}
        <div className="flex items-center">
          <button 
            onClick={togglePlayPause}
            className="text-white p-0.5 hover:bg-green-700 rounded-full bg-green-700 flex-shrink-0 mr-1"
            style={{ width: '20px', height: '20px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}
            disabled={!audioSrc || isGenerating}
          >
            {isPlaying ? 
              <PauseIcon className="h-3.5 w-3.5" /> : 
              <PlayIcon className="h-3.5 w-3.5" />
            }
          </button>
          
          <div className="text-xs whitespace-nowrap font-semibold text-white">
            <span>{formatTime(currentTime)}</span>
            <span className="mx-0.5">/</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>
        
        {/* Middle - volume slider */}
        <div className="relative mx-2 flex-grow max-w-[250px]">
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={volume}
            className="audio-player-volume-slider w-full h-2"
            onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
          />
        </div>
        
        {/* Right - regenerate button */}
        {onRegenerate && (
          <div className="flex items-center">
            <button 
              onClick={onRegenerate}
              disabled={isGenerating}
              className="text-white hover:bg-green-700 rounded-full bg-green-700 flex-shrink-0 flex items-center justify-center"
              title="Regenerate voice"
              style={{ width: '18px', height: '18px' }}
            >
              <RegenerateIcon className="h-3 w-3" />
            </button>
          </div>
        )}
      </div>
      
      {/* Optional speed control */}
      {playbackSpeed !== 1.0 && (
        <div className="text-xs text-gray-600 mt-0.5">
          Speed: {playbackSpeed.toFixed(1)}x
        </div>
      )}
    </div>
  );
};

export default AudioPlayer; 