'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';

/**
 * Interface describing the audio state managed by the AudioContext
 * @property isPlaying - Whether audio is currently playing
 * @property currentPlayingId - ID of the currently playing scene (null if none)
 * @property volume - Global volume level (0-1)
 */
interface AudioState {
  isPlaying: boolean;
  currentPlayingId: string | null;
  volume: number;
}

/**
 * Interface describing the AudioContext API
 * @property audioState - Current audio state (playing, current scene ID, volume)
 * @property setAudioPlaying - Function to set playing state and optionally the current scene ID
 * @property setAudioVolume - Function to set global volume level
 */
interface AudioContextType {
  audioState: AudioState;
  setAudioPlaying: (isPlaying: boolean, id?: string | null) => void;
  setAudioVolume: (volume: number) => void;
}

/**
 * AudioContext provides global state management for audio playback across scenes.
 * This ensures only one audio element plays at a time and volume settings are consistent.
 */
const AudioContext = createContext<AudioContextType>({
  audioState: {
    isPlaying: false,
    currentPlayingId: null,
    volume: 1
  },
  setAudioPlaying: () => {},
  setAudioVolume: () => {}
});

/**
 * AudioProvider component that wraps the application and provides audio state management.
 * This component maintains the global audio state and provides methods to update it.
 * 
 * @param children - React children to be wrapped by the provider
 */
export const AudioProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [audioState, setAudioState] = useState<AudioState>({
    isPlaying: false,
    currentPlayingId: null,
    volume: 1
  });

  /**
   * Updates the audio playing state and optionally the current scene ID.
   * When setting isPlaying to true, it will use the provided ID or keep the existing one.
   * 
   * @param isPlaying - Whether audio should be playing
   * @param id - Optional scene ID that is currently playing
   */
  const setAudioPlaying = (isPlaying: boolean, id: string | null = null) => {
    setAudioState(prev => ({
      ...prev,
      isPlaying,
      currentPlayingId: isPlaying ? (id || prev.currentPlayingId) : prev.currentPlayingId
    }));
  };

  /**
   * Updates the global volume level for all audio elements.
   * This ensures consistent volume across all scenes.
   * 
   * @param volume - Volume level (0-1)
   */
  const setAudioVolume = (volume: number) => {
    setAudioState(prev => ({
      ...prev,
      volume
    }));
  };

  return (
    <AudioContext.Provider value={{ audioState, setAudioPlaying, setAudioVolume }}>
      {children}
    </AudioContext.Provider>
  );
};

/**
 * Custom hook to access the AudioContext.
 * Use this hook to access and update the global audio state.
 * 
 * @returns AudioContextType with audio state and methods to update it
 * @example
 * const { audioState, setAudioPlaying, setAudioVolume } = useAudioContext();
 */
export const useAudioContext = () => useContext(AudioContext); 