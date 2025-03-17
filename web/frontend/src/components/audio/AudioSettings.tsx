import React from 'react';
import { X as XIcon, Download as DownloadIcon } from 'lucide-react';

interface AudioSettingsProps {
  /** Current playback speed (0.5-2.0) */
  playbackSpeed: number;
  /** Audio source URL for download */
  audioSrc: string | null;
  /** Callback for playback speed change */
  onPlaybackSpeedChange: (speed: number) => void;
  /** Callback when settings panel is closed */
  onClose: () => void;
}

/**
 * A component for configuring audio playback settings
 * 
 * Features:
 * - Playback speed control
 * - Audio download option
 * 
 * @param props - Component props
 * @returns JSX element
 */
export const AudioSettings: React.FC<AudioSettingsProps> = ({
  playbackSpeed,
  audioSrc,
  onPlaybackSpeedChange,
  onClose,
}) => {
  // Download audio file
  const handleDownloadAudio = () => {
    if (audioSrc) {
      const a = document.createElement('a');
      a.href = audioSrc;
      a.download = `audio.mp3`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  // Prevent click propagation for the settings panel
  const handlePanelClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={onClose} data-testid="audio-settings-modal">
      <div 
        className="bg-white rounded-lg shadow-xl w-72 p-4"
        onClick={handlePanelClick}
        data-testid="audio-settings-panel"
      >
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-medium text-gray-900" data-testid="audio-settings-title">Audio Options</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500"
            data-testid="audio-settings-close"
          >
            <XIcon className="h-5 w-5" />
          </button>
        </div>
        
        <div className="mb-4">
          <div className="flex justify-between items-center mb-1">
            <label className="text-sm text-gray-600" data-testid="audio-settings-speed-label">Playback Speed: {playbackSpeed.toFixed(2)}x</label>
            <span className="text-xs text-gray-500" data-testid="audio-settings-speed-text">
              {playbackSpeed < 0.85 ? 'Slower' : playbackSpeed > 1.1 ? 'Faster' : 'Normal'}
            </span>
          </div>
          <input 
            type="range" 
            min="0.5" 
            max="2.0" 
            step="0.05" 
            value={playbackSpeed} 
            onChange={(e) => {
              e.stopPropagation();
              onPlaybackSpeedChange(parseFloat(e.target.value));
            }}
            className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            onMouseDown={(e) => e.stopPropagation()}
            data-testid="audio-settings-speed-slider"
          />
          <div className="flex justify-between text-[10px] text-gray-400">
            <span data-testid="audio-settings-speed-min">0.5x</span>
            <span data-testid="audio-settings-speed-max">2.0x</span>
          </div>
        </div>
        
        {/* Download audio button */}
        {audioSrc && (
          <div className="mt-4 pt-2 border-t border-gray-200" data-testid="audio-settings-download-container">
            <button
              onClick={handleDownloadAudio}
              className="w-full flex items-center justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
              data-testid="audio-settings-download-button"
            >
              <DownloadIcon className="mr-2 h-4 w-4" />
              Download Audio
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default AudioSettings; 