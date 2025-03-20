import React from 'react';
import { Play, Pause, RefreshCw, Volume2, VolumeX } from 'lucide-react';

interface VoiceControlsProps {
  /**
   * Whether audio is currently being generated
   */
  isGenerating: boolean;
  
  /**
   * Whether audio is currently playing
   */
  isPlaying: boolean;
  
  /**
   * Whether audio is muted
   */
  isMuted: boolean;
  
  /**
   * Whether the scene is in read-only mode
   */
  readOnly?: boolean;
  
  /**
   * Audio URL for playback
   */
  audioUrl?: string | null;
  
  /**
   * Handler for starting voice generation
   */
  onGenerate: () => void;
  
  /**
   * Handler for toggling audio playback
   */
  onPlayPause: () => void;
  
  /**
   * Handler for toggling audio mute
   */
  onToggleMute: () => void;
}

/**
 * Component for controlling voice generation and audio playback
 */
export const VoiceControls: React.FC<VoiceControlsProps> = ({
  isGenerating,
  isPlaying,
  isMuted,
  readOnly = false,
  audioUrl,
  onGenerate,
  onPlayPause,
  onToggleMute
}) => {
  const hasAudio = Boolean(audioUrl);
  
  return (
    <div className="voice-controls flex items-center space-x-2" data-testid="voice-controls">
      {/* Generate/Regenerate button */}
      {!readOnly && (
        <button
          onClick={onGenerate}
          disabled={isGenerating}
          className={`p-1.5 rounded-full ${
            isGenerating
              ? 'bg-blue-100 text-blue-400'
              : 'bg-blue-600 text-white hover:bg-blue-700'
          }`}
          aria-label={hasAudio ? 'Regenerate voice' : 'Generate voice'}
          data-testid="generate-voice-button"
        >
          <RefreshCw
            className={`h-4 w-4 ${isGenerating ? 'animate-spin' : ''}`}
          />
        </button>
      )}
      
      {/* Play/Pause button */}
      {hasAudio && (
        <button
          onClick={onPlayPause}
          className="p-1.5 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200"
          aria-label={isPlaying ? 'Pause audio' : 'Play audio'}
          data-testid="play-pause-button"
        >
          {isPlaying ? (
            <Pause className="h-4 w-4" />
          ) : (
            <Play className="h-4 w-4" />
          )}
        </button>
      )}
      
      {/* Mute toggle */}
      {hasAudio && (
        <button
          onClick={onToggleMute}
          className="p-1.5 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200"
          aria-label={isMuted ? 'Unmute audio' : 'Mute audio'}
          data-testid="mute-toggle-button"
        >
          {isMuted ? (
            <VolumeX className="h-4 w-4" />
          ) : (
            <Volume2 className="h-4 w-4" />
          )}
        </button>
      )}
    </div>
  );
}; 