'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

// Define the voice interface
interface Voice {
  id: string;
  name: string;
}

// Define the context interface
interface VoiceContextType {
  voices: Voice[];
  selectedVoice: string;
  setSelectedVoice: (voiceId: string) => void;
}

// Create context with default values
const VoiceContext = createContext<VoiceContextType>({
  voices: [],
  selectedVoice: '',
  setSelectedVoice: () => {}
});

// Provider component
export const VoiceProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Sample voices - in a real app, these would come from an API
  const [voices, setVoices] = useState<Voice[]>([
    { id: 'aria', name: 'Aria' },
    { id: 'daniel', name: 'Daniel' },
    { id: 'sarah', name: 'Sarah' },
    { id: 'james', name: 'James' }
  ]);
  
  const [selectedVoice, setSelectedVoice] = useState<string>('aria');

  // In a real implementation, we would fetch voices from an API
  // useEffect(() => {
  //   const fetchVoices = async () => {
  //     try {
  //       const response = await fetch('/api/voices');
  //       const data = await response.json();
  //       setVoices(data.voices);
  //       if (data.voices.length > 0 && !selectedVoice) {
  //         setSelectedVoice(data.voices[0].id);
  //       }
  //     } catch (error) {
  //       console.error('Error fetching voices:', error);
  //     }
  //   };
  //   
  //   fetchVoices();
  // }, []);

  return (
    <VoiceContext.Provider value={{ voices, selectedVoice, setSelectedVoice }}>
      {children}
    </VoiceContext.Provider>
  );
};

// Custom hook to use the voice context
export const useVoiceContext = () => useContext(VoiceContext); 