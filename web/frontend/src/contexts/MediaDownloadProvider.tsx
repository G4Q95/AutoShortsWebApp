'use client';

import React, { createContext, useContext, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';

// Only import the type, not the actual implementation
import type MediaDownloadManager from '../utils/media/mediaDownloadManager';

interface MediaDownloadProviderProps {
  children: React.ReactNode;
}

interface MediaDownloadContextValue {
  getLocalUrl: (remoteUrl: string, mediaType: 'video' | 'image', priority?: boolean) => Promise<string>;
  hasLocalUrl: (remoteUrl: string) => boolean;
  release: (remoteUrl: string) => void;
  releaseAll: () => void;
}

// Create the context
const MediaDownloadContext = createContext<MediaDownloadContextValue | undefined>(undefined);

// Create a no-op implementation for SSR
const noopMediaDownload: MediaDownloadContextValue = {
  getLocalUrl: async (remoteUrl) => remoteUrl,
  hasLocalUrl: () => false,
  release: () => {},
  releaseAll: () => {}
};

// Provider component
export const MediaDownloadProvider: React.FC<MediaDownloadProviderProps> = ({ children }) => {
  const [isClient, setIsClient] = React.useState(false);
  const managerRef = useRef<MediaDownloadManager | null>(null);

  // Check if we're on the client side
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Initialize MediaDownloadManager only on client side
  useEffect(() => {
    if (!isClient) return;

    const initializeManager = async () => {
      try {
        // Dynamically import MediaDownloadManager
        const { default: MediaDownloadManagerModule } = await import('../utils/media/mediaDownloadManager');

        // Create a new instance if one doesn't exist
        if (!managerRef.current) {
          managerRef.current = new MediaDownloadManagerModule();
        }
      } catch (error) {
        console.error('Error initializing MediaDownloadManager:', error);
      }
    };

    initializeManager();

    // Clean up on unmount
    return () => {
      if (managerRef.current) {
        managerRef.current.releaseAll();
        managerRef.current = null;
      }
    };
  }, [isClient]);

  // Helper functions to expose the manager methods
  const getLocalUrl = async (remoteUrl: string, mediaType: 'video' | 'image', priority = false): Promise<string> => {
    if (!isClient || !managerRef.current) return remoteUrl;
    return managerRef.current.getLocalUrl(remoteUrl, mediaType, priority);
  };

  const hasLocalUrl = (remoteUrl: string): boolean => {
    if (!isClient || !managerRef.current) return false;
    return managerRef.current.hasLocalUrl(remoteUrl);
  };

  const release = (remoteUrl: string): void => {
    if (!isClient || !managerRef.current) return;
    managerRef.current.release(remoteUrl);
  };

  const releaseAll = (): void => {
    if (!isClient || !managerRef.current) return;
    managerRef.current.releaseAll();
  };

  // If we're on the server, return a default context value
  if (!isClient) {
    return (
      <MediaDownloadContext.Provider value={noopMediaDownload}>
        {children}
      </MediaDownloadContext.Provider>
    );
  }

  const contextValue: MediaDownloadContextValue = {
    getLocalUrl,
    hasLocalUrl,
    release,
    releaseAll
  };

  return (
    <MediaDownloadContext.Provider value={contextValue}>
      {children}
    </MediaDownloadContext.Provider>
  );
};

// Custom hook for using the MediaDownloadManager
export const useMediaDownload = (): MediaDownloadContextValue => {
  const context = useContext(MediaDownloadContext);

  if (context === undefined) {
    throw new Error('useMediaDownload must be used within a MediaDownloadProvider');
  }

  return context;
};

export default MediaDownloadProvider; 