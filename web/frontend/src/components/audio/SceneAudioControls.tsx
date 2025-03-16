'use client';

import React, { useRef, useEffect, useState } from 'react';
import { useAudioContext } from '@/contexts/AudioContext';
import { AudioPlayerControls } from './AudioPlayerControls';
import { Mic as MicIcon } from 'lucide-react';
import { useVoiceContext } from '@/contexts/VoiceContext';

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
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      setCurrentTime(0);
    }
  };

  // Toggle audio settings
  const toggleSettings = () => {
    setShowSettings(!showSettings);
  };

  // Handle voice change
  const handleVoiceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onVoiceChange?.(e.target.value);
  };

  // Handle rate change
  const handleRateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rate = parseFloat(e.target.value);
    onRateChange?.(rate);
  };

  // Keep audio element in sync with AudioContext
  useEffect(() => {
    if (!audioRef.current) return;
    
    if (isThisAudioPlaying && audioRef.current.paused) {
      audioRef.current.play().catch(console.error);
    } else if (!isThisAudioPlaying && !audioRef.current.paused) {
      audioRef.current.pause();
    }
  }, [isThisAudioPlaying, sceneId]);

  // Close settings when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        settingsButtonRef.current && 
        !settingsButtonRef.current.contains(event.target as Node) &&
        showSettings
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
      style={{ height: '32px', perspective: '1000px' }}
    >
      {/* Flip container */}
      <div
        className="w-full h-full relative transition-transform duration-500 transform-style-preserve-3d"
        style={{
          transformStyle: 'preserve-3d',
          transform: isFlipped ? 'rotateX(180deg)' : 'rotateX(0)',
        }}
      >
        {/* Front - Generate Button */}
        <div
          className="front absolute inset-0 backface-hidden"
          style={{ 
            backfaceVisibility: 'hidden',
            zIndex: isFlipped ? 0 : 1,
            width: '100%',
          }}
        >
          <button
            className="w-full h-full flex justify-center items-center px-4 text-sm bg-green-600 text-white rounded-bl-md hover:bg-green-700 transition-colors relative overflow-hidden"
            onClick={onGenerateClick}
            disabled={isGeneratingAudio}
            style={{ display: 'flex', alignItems: 'center', paddingRight: '2rem' }}
          >
            <MicIcon className="w-3.5 h-3.5 mr-1.5" />
            <span className="font-medium">
              {isGeneratingAudio ? 'Generating...' : audioButtonText}
            </span>
            
            {/* Voice selector */}
            <select
              value={selectedVoice}
              onChange={handleVoiceChange}
              className="absolute right-1 h-5 rounded text-xs text-black bg-white py-0"
              style={{ width: '70px' }}
            >
              {voices.map((voice: Voice) => (
                <option key={voice.id} value={voice.id}>
                  {voice.name}
                </option>
              ))}
            </select>
          </button>
        </div>

        {/* Back - Audio Controls */}
        {audioSource && (
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
        )}
      </div>

      {/* Audio Settings Dropdown */}
      {showSettings && (
        <div className="absolute right-0 top-full mt-1 bg-white border border-gray-300 rounded shadow-lg p-2 z-50 w-44">
          <div className="mb-2">
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Voice
            </label>
            <select 
              value={selectedVoice} 
              onChange={handleVoiceChange}
              className="block w-full text-xs border-gray-300 rounded"
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