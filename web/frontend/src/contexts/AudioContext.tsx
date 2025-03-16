'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';

// Define the audio state interface
interface AudioState {
  isPlaying: boolean;
  currentPlayingId: string | null;
  volume: number;
}

// Define the context interface
interface AudioContextType {
  audioState: AudioState;
  setAudioPlaying: (isPlaying: boolean, id?: string | null) => void;
  setAudioVolume: (volume: number) => void;
}

// Create context with initial values
const AudioContext = createContext<AudioContextType>({
  audioState: {
    isPlaying: false,
    currentPlayingId: null,
    volume: 1
  },
  setAudioPlaying: () => {},
  setAudioVolume: () => {}
});

// Provider component
export const AudioProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [audioState, setAudioState] = useState<AudioState>({
    isPlaying: false,
    currentPlayingId: null,
    volume: 1
  });

  // Set audio playing state
  const setAudioPlaying = (isPlaying: boolean, id: string | null = null) => {
    setAudioState(prev => ({
      ...prev,
      isPlaying,
      currentPlayingId: isPlaying ? (id || prev.currentPlayingId) : prev.currentPlayingId
    }));
  };

  // Set audio volume
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

// Custom hook to use the audio context
export const useAudioContext = () => useContext(AudioContext); 