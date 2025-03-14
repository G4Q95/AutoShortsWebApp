import React, { useState, useEffect } from 'react';
import { X as XIcon, Download as DownloadIcon } from 'lucide-react';

interface VoiceSettingsProps {
  /** List of available voices */
  voices: any[];
  /** Current selected voice ID */
  voiceId: string;
  /** Whether voices are currently loading */
  loadingVoices: boolean;
  /** Current stability value (0-1) */
  stability: number;
  /** Current similarity boost value (0-1) */
  similarityBoost: number;
  /** Current style value (0-1) */
  style: number;
  /** Whether speaker boost is enabled */
  speakerBoost: boolean;
  /** Current speed value (0.7-1.2) */
  speed: number;
  /** Audio source URL for download */
  audioSrc: string | null;
  /** Handle voice selection change */
  onVoiceChange: (voiceId: string) => void;
  /** Handle stability change */
  onStabilityChange: (value: number) => void;
  /** Handle similarity boost change */
  onSimilarityChange: (value: number) => void;
  /** Handle style change */
  onStyleChange: (value: number) => void;
  /** Handle speaker boost toggle */
  onSpeakerBoostChange: (enabled: boolean) => void;
  /** Handle speed change */
  onSpeedChange: (value: number) => void;
  /** Handle close settings panel */
  onClose: () => void;
  /** Error message to display */
  errorMessage?: string | null;
}

/**
 * A component for configuring voice generation settings
 * 
 * Features:
 * - Voice selection dropdown
 * - Parameter adjustment sliders
 * - Toggle options for voice features
 * - Audio download option
 * 
 * @param props - Component props
 * @returns JSX element
 */
export const VoiceSettings: React.FC<VoiceSettingsProps> = ({
  voices,
  voiceId,
  loadingVoices,
  stability,
  similarityBoost,
  style,
  speakerBoost,
  speed,
  audioSrc,
  onVoiceChange,
  onStabilityChange,
  onSimilarityChange,
  onStyleChange,
  onSpeakerBoostChange,
  onSpeedChange,
  onClose,
  errorMessage = null,
}) => {
  // Download audio file
  const handleDownloadAudio = () => {
    if (audioSrc) {
      const a = document.createElement('a');
      a.href = audioSrc;
      a.download = `voice_audio_${voiceId}.mp3`;
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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={onClose}>
      <div 
        className="bg-white rounded-lg shadow-xl w-72 p-4 max-h-[90vh] overflow-y-auto"
        onClick={handlePanelClick}
      >
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-medium text-gray-900">Voice Settings</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500"
          >
            <XIcon className="h-5 w-5" />
          </button>
        </div>
        
        {errorMessage && (
          <div className="mb-4 text-xs text-red-600 bg-red-50 p-2 rounded">
            {errorMessage}
          </div>
        )}
        
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">Voice</label>
          <select
            value={voiceId}
            onChange={(e) => onVoiceChange(e.target.value)}
            className="w-full py-1.5 px-2 border border-gray-300 rounded text-sm"
            disabled={loadingVoices || voices.length === 0}
          >
            {voices.length === 0 ? (
              <option>Loading voices...</option>
            ) : (
              voices.map((voice) => (
                <option key={voice.voice_id} value={voice.voice_id}>
                  {voice.name}
                </option>
              ))
            )}
          </select>
        </div>
        
        <div className="mb-4">
          <div className="flex justify-between items-center mb-1">
            <label className="text-sm text-gray-600">Stability: {Math.round(stability * 100)}%</label>
            <span className="text-xs text-gray-500">
              {stability < 0.3 ? 'More Variable' : stability > 0.7 ? 'More Stable' : 'Balanced'}
            </span>
          </div>
          <input 
            type="range" 
            min="0" 
            max="1" 
            step="0.01" 
            value={stability} 
            onChange={(e) => {
              e.stopPropagation();
              onStabilityChange(parseFloat(e.target.value));
            }}
            className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            onMouseDown={(e) => e.stopPropagation()}
          />
          <div className="flex justify-between text-[10px] text-gray-400">
            <span>0%</span>
            <span>100%</span>
          </div>
        </div>
        
        <div className="mb-4">
          <div className="flex justify-between items-center mb-1">
            <label className="text-sm text-gray-600">Similarity: {Math.round(similarityBoost * 100)}%</label>
            <span className="text-xs text-gray-500">
              {similarityBoost < 0.3 ? 'More Unique' : similarityBoost > 0.7 ? 'More Similar' : 'Balanced'}
            </span>
          </div>
          <input 
            type="range" 
            min="0" 
            max="1" 
            step="0.01" 
            value={similarityBoost} 
            onChange={(e) => {
              e.stopPropagation();
              onSimilarityChange(parseFloat(e.target.value));
            }}
            className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            onMouseDown={(e) => e.stopPropagation()}
          />
          <div className="flex justify-between text-[10px] text-gray-400">
            <span>0%</span>
            <span>100%</span>
          </div>
        </div>
        
        <div className="mb-4">
          <div className="flex justify-between items-center mb-1">
            <label className="text-sm text-gray-600">Style: {Math.round(style * 100)}%</label>
            <span className="text-xs text-gray-500">{style < 0.3 ? 'Natural' : style > 0.7 ? 'Expressive' : 'Balanced'}</span>
          </div>
          <input 
            type="range" 
            min="0" 
            max="1" 
            step="0.01" 
            value={style} 
            onChange={(e) => {
              e.stopPropagation();
              onStyleChange(parseFloat(e.target.value));
            }}
            className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            onMouseDown={(e) => e.stopPropagation()}
          />
          <div className="flex justify-between text-[10px] text-gray-400">
            <span>0%</span>
            <span>100%</span>
          </div>
        </div>
        
        <div className="mb-4">
          <div className="flex justify-between items-center mb-1">
            <label className="text-sm text-gray-600">Speed: {(speed).toFixed(1)}x</label>
            <span className="text-xs text-gray-500">
              {speed < 0.85 ? 'Slower' : speed > 1.15 ? 'Faster' : 'Normal'}
            </span>
          </div>
          <input 
            type="range" 
            min="0.7" 
            max="1.2" 
            step="0.05" 
            value={speed} 
            onChange={(e) => {
              e.stopPropagation();
              onSpeedChange(parseFloat(e.target.value));
            }}
            className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            onMouseDown={(e) => e.stopPropagation()}
          />
          <div className="flex justify-between text-[10px] text-gray-400">
            <span>0.7x</span>
            <span>1.2x</span>
          </div>
        </div>
        
        {/* Speaker Boost toggle */}
        <div className="flex items-center justify-between mb-4">
          <label className="text-sm text-gray-600">Speaker Boost</label>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onSpeakerBoostChange(!speakerBoost);
            }}
            className={`relative inline-flex h-5 w-10 items-center rounded-full ${speakerBoost ? 'bg-blue-600' : 'bg-gray-200'}`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${speakerBoost ? 'translate-x-5' : 'translate-x-1'}`}
            />
          </button>
        </div>
        
        {/* Download audio button */}
        {audioSrc && (
          <div className="mt-4 pt-2 border-t border-gray-200">
            <button
              onClick={handleDownloadAudio}
              className="w-full flex items-center justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
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

export default VoiceSettings; 