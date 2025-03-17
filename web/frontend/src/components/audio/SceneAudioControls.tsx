'use client';

import React, { useRef, useEffect, useState } from 'react';
import { useAudioContext } from '@/contexts/AudioContext';
import { AudioPlayerControls } from './AudioPlayerControls';
import { Mic as MicIcon } from 'lucide-react';
import { useVoiceContext } from '@/contexts/VoiceContext';
import { FlipContainer } from './FlipContainer';
import { GenerateVoiceoverButton } from './GenerateVoiceoverButton';

interface Voice {
  id: string;
  name: string;
}

interface SceneAudioControlsProps {
  sceneId: string;
  audioSource?: string;
  audioButtonText?: string;
  isGeneratingAudio?: boolean;
  onGenerateClick: () => void;
  onRegenerateClick: () => void;
  onVoiceChange?: (voice: string) => void;
  onRateChange?: (rate: number) => void;
  className?: string;
}

export const SceneAudioControls: React.FC<SceneAudioControlsProps> = ({
  sceneId,
  audioSource,
  audioButtonText = 'Generate Voiceover',
  isGeneratingAudio = false,
  onGenerateClick,
  onRegenerateClick,
  onVoiceChange,
  onRateChange,
  className = '',
}) => {
  const { voices, selectedVoice } = useVoiceContext();
  const { audioState, setAudioPlaying, setAudioVolume } = useAudioContext();
  const [isFlipped, setIsFlipped] = useState(!!audioSource);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const settingsButtonRef = useRef<HTMLButtonElement>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [volume, setVolume] = useState(1);

  // Keep track of whether this scene's audio is playing
  const isThisAudioPlaying = audioState.currentPlayingId === sceneId && audioState.isPlaying;

  // Flip when audio is generated
  useEffect(() => {
    setIsFlipped(!!audioSource);
  }, [audioSource]);

  // Handle play/pause
  const handlePlayPause = () => {
    if (!audioRef.current) return;
    
    if (isThisAudioPlaying) {
      audioRef.current.pause();
      setAudioPlaying(false);
    } else {
      // If another audio is playing, it will be paused by the AudioContext
      audioRef.current.play().catch(console.error);
      setAudioPlaying(true, sceneId);
    }
  };

  // Handle volume change
  const handleVolumeChange = (newVolume: number) => {
    setVolume(newVolume);
    if (audioRef.current) {
      audioRef.current.volume = newVolume;
    }
    setAudioVolume(newVolume);
  };

  // Handle audio timeupdate
  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  // Handle audio loaded
  const handleAudioLoaded = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
      audioRef.current.volume = audioState.volume;
      setVolume(audioState.volume);
    }
  };

  // Handle audio ended
  const handleAudioEnded = () => {
    setAudioPlaying(false);
  };

  // Toggle settings
  const toggleSettings = () => {
    setShowSettings(!showSettings);
  };

  // Handle voice change
  const handleVoiceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (onVoiceChange) {
      onVoiceChange(e.target.value);
    }
  };

  // Handle rate change (audio playback speed)
  const handleRateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (onRateChange) {
      onRateChange(parseFloat(e.target.value));
    }
  };

  // Handle click outside settings
  useEffect(() => {
    if (!showSettings) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (
        settingsButtonRef.current &&
        !settingsButtonRef.current.contains(event.target as Node) &&
        !document.querySelector('[data-testid="audio-settings-dropdown"]')?.contains(event.target as Node)
      ) {
        setShowSettings(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showSettings]);

  // Use useEffect to update audioRef.current.volume when audioState.volume changes
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = audioState.volume;
      setVolume(audioState.volume);
    }
  }, [audioState.volume]);

  return (
    <div 
      className={`relative w-full rounded-bl-md overflow-hidden ${className}`}
      style={{ height: '32px' }}
      data-testid="scene-audio-controls"
    >
      <FlipContainer
        isFlipped={isFlipped}
        frontContent={
          <GenerateVoiceoverButton 
            onClick={onGenerateClick}
            isGenerating={isGeneratingAudio}
            disabled={!selectedVoice || isGeneratingAudio}
          />
        }
        backContent={
          <AudioPlayerControls
            currentTime={currentTime}
            duration={duration}
            isPlaying={isThisAudioPlaying}
            volume={volume}
            onPlayPause={handlePlayPause}
            onVolumeChange={handleVolumeChange}
            onRegenerate={onRegenerateClick}
            onShowSettings={toggleSettings}
            isGenerating={isGeneratingAudio}
            settingsButtonRef={settingsButtonRef as React.RefObject<HTMLButtonElement>}
          />
        }
      />

      {/* Audio Settings Dropdown */}
      {showSettings && (
        <div className="absolute right-0 top-full mt-1 bg-white border border-gray-300 rounded shadow-lg p-2 z-50 w-44" data-testid="audio-settings-dropdown">
          <div className="mb-2">
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Voice
            </label>
            <select 
              value={selectedVoice} 
              onChange={handleVoiceChange}
              className="block w-full text-xs border-gray-300 rounded"
              data-testid="audio-settings-voice-selector"
            >
              {voices.map((voice: Voice) => (
                <option key={voice.id} value={voice.id}>
                  {voice.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Speed: {onRateChange ? 1 : 1}x
            </label>
            <input
              type="range"
              min="0.5"
              max="2"
              step="0.1"
              defaultValue="1"
              className="block w-full"
              onChange={handleRateChange}
              data-testid="audio-settings-speed-slider"
            />
          </div>
        </div>
      )}

      {/* Hidden Audio Element */}
      <audio
        ref={audioRef}
        src={audioSource}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleAudioLoaded}
        onEnded={handleAudioEnded}
        data-testid="scene-audio"
      />
    </div>
  );
};

export default SceneAudioControls;