import React, { createContext, useContext, useState } from 'react';
import { Scene } from './ProjectTypes';

// Define the context type
interface SceneContextType {
  scene: Scene;
  isEditing: boolean;
  toggleEdit: () => void;
}

// Create the context with a default undefined value
export const SceneContext = createContext<SceneContextType | undefined>(undefined);

// Props for the SceneProvider
interface SceneProviderProps {
  children: React.ReactNode;
  scene: Scene;
}

/**
 * Provider component that makes scene context available to any
 * child component that calls useScene().
 */
export const SceneProvider: React.FC<SceneProviderProps> = ({ children, scene }) => {
  const [isEditing, setIsEditing] = useState(false);
  
  const toggleEdit = () => {
    setIsEditing(prev => !prev);
  };
  
  // The value that will be given to the context
  const value = {
    scene,
    isEditing,
    toggleEdit
  };
  
  return (
    <SceneContext.Provider value={value}>
      {children}
    </SceneContext.Provider>
  );
};

/**
 * Hook that lets you access the scene context
 */
export const useScene = (): SceneContextType => {
  const context = useContext(SceneContext);
  if (context === undefined) {
    throw new Error('useScene must be used within a SceneProvider');
  }
  return context;
};

export default SceneContext; 