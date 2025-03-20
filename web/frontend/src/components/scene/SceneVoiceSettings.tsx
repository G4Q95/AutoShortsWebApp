/**
 * SceneVoiceSettings component
 * Provides UI for voice selection and voice generation settings
 */
import React, { useState, useRef, useEffect } from 'react';
import { Settings as SettingsIcon, X as XIcon } from 'lucide-react';
import { useVoiceContext } from '@/contexts/VoiceContext';

interface VoiceOption {
  voice_id: string;
  name: string;
}

interface VoiceSettings {
  voice_id: string;
  stability: number; 
  similarity_boost: number; 
  style: number;
  speaker_boost: boolean;
  speed: number;
}

interface SceneVoiceSettingsProps {
  /**
   * Current voice ID
   */
  voiceId: string;
  
  /**
   * Current voice settings
   */
  voiceSettings: {
    stability?: number;
    similarity_boost?: number;
    style?: number;
    speaker_boost?: boolean;
    speed?: number;
  };
  
  /**
   * Whether the voice generation is in progress
   */
  isGenerating: boolean;
  
  /**
   * Audio error message, if any
   */
  audioError?: string | null;
  
  /**
   * Handler for voice ID changes
   */
  onVoiceChange: (voiceId: string) => void;
  
  /**
   * Handler for voice settings changes
   */
  onSettingsChange: (settings: Partial<VoiceSettings>) => void;
  
  /**
   * Handler for generate voice button click
   */
  onGenerateClick: () => void;
}

/**
 * Voice settings and selection component for scenes
 * Features:
 * - Voice dropdown selection
 * - Voice settings panel with sliders for various parameters
 * - Generate/Regenerate voice button
 */
const SceneVoiceSettingsComponent: React.FC<SceneVoiceSettingsProps> = ({
  voiceId,
  voiceSettings,
  isGenerating,
  audioError,
  onVoiceChange,
  onSettingsChange,
  onGenerateClick
}) => {
  // Use the voice context instead of local state for voices
  const { voices, isLoading: loadingVoices } = useVoiceContext();
  
  // Extract settings with defaults
  const stability = voiceSettings.stability ?? 0.5;
  const similarityBoost = voiceSettings.similarity_boost ?? 0.75;
  const style = voiceSettings.style ?? 0;
  const speakerBoost = voiceSettings.speaker_boost ?? false;
  const speed = voiceSettings.speed ?? 1.0;
  
  // State for settings panel
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const settingsButtonRef = useRef<HTMLButtonElement>(null);

  // Set default voice if none selected
  useEffect(() => {
    if (!voiceId && voices.length > 0) {
      onVoiceChange(voices[0].voice_id);
    }
  }, [voiceId, voices, onVoiceChange]);
  
  // Handle setting changes
  const handleSettingChange = (setting: keyof VoiceSettings, value: number | boolean) => {
    onSettingsChange({ [setting]: value });
  };
  
  return (
    <div className="voice-settings" data-testid="scene-voice-settings">
      {/* Voice selection header */}
      <div className="flex items-center justify-between">
        <div className="text-xs font-medium text-gray-700">Voice Narration</div>
        <button
          ref={settingsButtonRef}
          onClick={() => setShowSettings(!showSettings)}
          className="text-xs text-blue-600 hover:text-blue-700 p-0.5 rounded flex items-center"
          aria-label="Voice settings"
          data-testid="voice-settings-button"
        >
          <SettingsIcon className="h-3 w-3 mr-0.5" />
          <span>Settings</span>
        </button>
      </div>
      
      {/* Error display */}
      {audioError && (
        <div className="mb-0.5 text-xs text-red-600 bg-red-50 p-0.5 rounded" data-testid="audio-error">
          {audioError}
        </div>
      )}
      
      {/* Voice selector dropdown */}
      <select
        value={voiceId}
        onChange={(e) => onVoiceChange(e.target.value)}
        className="text-xs py-0.5 px-1 border border-gray-300 rounded w-full mt-0.5 mb-0.5"
        disabled={isGenerating || voices.length === 0}
        data-testid="voice-selector"
      >
        {voices.length === 0 ? (
          <option>{loadingVoices ? 'Loading voices...' : 'No voices available'}</option>
        ) : (
          voices.map((voice) => (
            <option key={voice.voice_id} value={voice.voice_id}>
              {voice.name}
            </option>
          ))
        )}
      </select>
      
      {/* Generate/Regenerate Voice Button */}
      <button
        onClick={onGenerateClick}
        className={`w-full py-0.5 text-xs font-medium rounded flex justify-center items-center ${
          isGenerating
            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
            : 'bg-blue-600 text-white hover:bg-blue-700'
        }`}
        disabled={isGenerating || !voiceId || voices.length === 0}
        data-testid="generate-voice-button"
      >
        {isGenerating ? (
          <>
            <svg className="animate-spin -ml-1 mr-2 h-3 w-3 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Generating...
          </>
        ) : (
          <>Generate Voice</>
        )}
      </button>
      
      {/* Voice Settings Panel Overlay */}
      {showSettings && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-30 z-50 flex items-center justify-center"
          onClick={(e) => {
            e.stopPropagation();
            if (e.target === e.currentTarget) {
              setShowSettings(false);
            }
          }}
        >
          <div
            className="bg-white rounded-lg shadow-xl border border-gray-300 w-80 max-w-[90vw] absolute"
            style={{
              top: settingsButtonRef.current 
                ? settingsButtonRef.current.getBoundingClientRect().top - 320 
                : '10vh',
              left: settingsButtonRef.current 
                ? settingsButtonRef.current.getBoundingClientRect().left - 244
                : '10vw',
              boxShadow: '0 0 0 1px rgba(0,0,0,0.05), 0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05)'
            }}
            onClick={(e) => e.stopPropagation()}
            data-testid="voice-settings-panel"
          >
            <div className="flex justify-between items-center p-3 border-b border-gray-200">
              <h3 className="text-sm font-medium text-gray-800">Voice Settings</h3>
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setShowSettings(false);
                }}
                className="text-gray-400 hover:text-gray-600"
                data-testid="close-settings-button"
              >
                <XIcon className="h-4 w-4" />
              </button>
            </div>
            
            <div className="p-4">
              {/* Speed slider */}
              <div className="mb-4">
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs text-gray-600">Speed: {speed.toFixed(2)}x</label>
                  <span className="text-xs text-gray-500">
                    {speed < 0.85 ? 'Slower' : speed > 1.1 ? 'Faster' : 'Normal'}
                  </span>
                </div>
                <input 
                  type="range" 
                  min="0.7" 
                  max="1.2" 
                  step="0.01" 
                  value={speed} 
                  onChange={(e) => {
                    e.stopPropagation();
                    handleSettingChange('speed', parseFloat(e.target.value));
                  }}
                  className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                  onMouseDown={(e) => e.stopPropagation()}
                  data-testid="speed-slider"
                />
                <div className="flex justify-between text-[10px] text-gray-400">
                  <span>Slower (0.7x)</span>
                  <span>Faster (1.2x)</span>
                </div>
              </div>
              
              {/* Stability slider */}
              <div className="mb-4">
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs text-gray-600">Stability: {Math.round(stability * 100)}%</label>
                  <span className="text-xs text-gray-500">{stability < 0.3 ? 'Variable' : stability > 0.7 ? 'Stable' : 'Balanced'}</span>
                </div>
                <input 
                  type="range" 
                  min="0" 
                  max="1" 
                  step="0.01" 
                  value={stability} 
                  onChange={(e) => {
                    e.stopPropagation();
                    handleSettingChange('stability', parseFloat(e.target.value));
                  }}
                  className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                  onMouseDown={(e) => e.stopPropagation()}
                  data-testid="stability-slider"
                />
                <div className="flex justify-between text-[10px] text-gray-400">
                  <span>0%</span>
                  <span>100%</span>
                </div>
              </div>
              
              {/* Similarity Boost slider */}
              <div className="mb-4">
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs text-gray-600">Similarity: {Math.round(similarityBoost * 100)}%</label>
                  <span className="text-xs text-gray-500">{similarityBoost < 0.3 ? 'Less Similar' : similarityBoost > 0.7 ? 'More Similar' : 'Balanced'}</span>
                </div>
                <input 
                  type="range" 
                  min="0" 
                  max="1" 
                  step="0.01" 
                  value={similarityBoost} 
                  onChange={(e) => {
                    e.stopPropagation();
                    handleSettingChange('similarity_boost', parseFloat(e.target.value));
                  }}
                  className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                  onMouseDown={(e) => e.stopPropagation()}
                  data-testid="similarity-slider"
                />
                <div className="flex justify-between text-[10px] text-gray-400">
                  <span>0%</span>
                  <span>100%</span>
                </div>
              </div>
              
              {/* Style slider */}
              <div className="mb-4">
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs text-gray-600">Style: {Math.round(style * 100)}%</label>
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
                    handleSettingChange('style', parseFloat(e.target.value));
                  }}
                  className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                  onMouseDown={(e) => e.stopPropagation()}
                  data-testid="style-slider"
                />
                <div className="flex justify-between text-[10px] text-gray-400">
                  <span>0%</span>
                  <span>100%</span>
                </div>
              </div>
              
              {/* Speaker Boost toggle */}
              <div className="flex items-center justify-between mb-4">
                <label className="text-xs text-gray-600">Speaker Boost</label>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSettingChange('speaker_boost', !speakerBoost);
                  }}
                  className={`relative inline-flex h-5 w-10 items-center rounded-full ${speakerBoost ? 'bg-blue-600' : 'bg-gray-200'}`}
                  data-testid="speaker-boost-toggle"
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${speakerBoost ? 'translate-x-5' : 'translate-x-1'}`}
                  />
                </button>
              </div>
              
              <div className="text-[10px] text-gray-500 mb-3">
                These settings apply only to this scene.
              </div>
              
              <div className="flex justify-end">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowSettings(false);
                  }}
                  className="text-xs bg-blue-600 text-white hover:bg-blue-700 px-3 py-1.5 rounded font-medium"
                  data-testid="apply-settings-button"
                >
                  Apply Settings
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * Custom comparison function for React.memo
 * Only re-render when essential voice props change
 */
function arePropsEqual(prevProps: SceneVoiceSettingsProps, nextProps: SceneVoiceSettingsProps): boolean {
  // Compare basic props
  if (
    prevProps.voiceId !== nextProps.voiceId ||
    prevProps.isGenerating !== nextProps.isGenerating ||
    prevProps.audioError !== nextProps.audioError
  ) {
    return false;
  }
  
  // Compare voice settings object
  const prevSettings = prevProps.voiceSettings;
  const nextSettings = nextProps.voiceSettings;
  
  return (
    prevSettings.stability === nextSettings.stability &&
    prevSettings.similarity_boost === nextSettings.similarity_boost &&
    prevSettings.style === nextSettings.style &&
    prevSettings.speaker_boost === nextSettings.speaker_boost &&
    prevSettings.speed === nextSettings.speed
  );
}

/**
 * Memoized version of SceneVoiceSettings to prevent unnecessary re-renders
 */
export const SceneVoiceSettings = React.memo(SceneVoiceSettingsComponent, arePropsEqual); 