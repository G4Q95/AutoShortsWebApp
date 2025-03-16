import React from 'react';
import {
  Play as PlayIcon,
  Pause as PauseIcon,
  RotateCw as RegenerateIcon,
  MoreVertical as MoreVerticalIcon
} from 'lucide-react';

interface AudioPlayerControlsProps {
  /** Current time in seconds */
  currentTime: number;
  /** Duration in seconds */
  duration: number;
  /** Whether audio is playing */
  isPlaying: boolean;
  /** Current volume (0-1) */
  volume: number;
  /** Handler for play/pause */
  onPlayPause: () => void;
  /** Handler for volume change */
  onVolumeChange: (volume: number) => void;
  /** Handler for regenerating voiceover */
  onRegenerate: () => void;
  /** Handler for showing audio settings */
  onShowSettings: () => void;
  /** Whether audio is generating */
  isGenerating: boolean;
  /** Ref for the settings button */
  settingsButtonRef?: React.RefObject<HTMLButtonElement>;
}

/**
 * A component that exactly matches the styling of the
 * original audio player controls in SceneComponent
 */
export const AudioPlayerControls: React.FC<AudioPlayerControlsProps> = ({
  currentTime,
  duration,
  isPlaying,
  volume,
  onPlayPause,
  onVolumeChange,
  onRegenerate,
  onShowSettings,
  isGenerating,
  settingsButtonRef
}) => {
  // Format time for audio display
  const formatTime = (timeInSeconds: number): string => {
    if (isNaN(timeInSeconds)) return "0:00";
    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = Math.floor(timeInSeconds % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div
      className="back absolute inset-0 flex-grow px-2 py-2 bg-green-600 text-white text-sm rounded-bl-md flex items-center justify-between"
      style={{
        right: '0',
        width: '100%',
        paddingRight: '0.75rem',
        borderRight: 'none'
      }}
    >
      {/* Audio Control Section - all controls in a single row with flex */}
      <div className="flex items-center w-full justify-between">
        {/* Left side - play button and time */}
        <div className="flex items-center">
          <button 
            onClick={onPlayPause}
            className="text-white p-0.5 hover:bg-green-700 rounded-full bg-green-700 flex-shrink-0 mr-1"
            style={{ width: '20px', height: '20px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}
          >
            {isPlaying ? 
              <PauseIcon className="h-3.5 w-3.5" /> : 
              <PlayIcon className="h-3.5 w-3.5" />
            }
          </button>
          
          <div className="text-xs whitespace-nowrap font-semibold">
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
            className="volume-slider w-full h-2"
            onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
            data-testid="audio-slider"
          />
        </div>
        
        {/* Right - action buttons */}
        <div className="flex items-center">
          <button 
            onClick={onRegenerate}
            disabled={isGenerating}
            className="text-white hover:bg-green-700 rounded-full bg-green-700 flex-shrink-0 flex items-center justify-center mr-1.5"
            title="Regenerate voice"
            style={{ width: '18px', height: '18px' }}
          >
            <RegenerateIcon className="h-3 w-3" />
          </button>
          
          <button 
            ref={settingsButtonRef}
            className="text-white hover:bg-green-700 rounded-full bg-green-700 flex-shrink-0 flex items-center justify-center"
            title="Audio options"
            onClick={onShowSettings}
            style={{ width: '18px', height: '18px' }}
          >
            <MoreVerticalIcon className="h-3 w-3" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default AudioPlayerControls; 