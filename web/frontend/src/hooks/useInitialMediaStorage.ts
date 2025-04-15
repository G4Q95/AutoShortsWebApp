import React, { useEffect, useRef, useCallback } from 'react';
import { Project, Scene } from '@/components/project/ProjectTypes';
import { storeSceneMedia } from '@/lib/media-utils';

interface UseInitialMediaStorageProps {
  project: Project | null;
  storingMediaStatus: Record<string, boolean>;
  setStoringMediaStatus: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  updateSceneMedia: (sceneId: string, mediaData: Partial<Scene['media']>) => void;
}

/**
 * Custom hook to handle triggering media storage for scenes that exist 
 * when a newly created project's MongoDB _id first becomes available.
 */
export function useInitialMediaStorage({
  project,
  storingMediaStatus,
  setStoringMediaStatus,
  updateSceneMedia,
}: UseInitialMediaStorageProps): void {
  const prevProjectIdRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    const currentId = project?._id;
    const prevId = prevProjectIdRef.current;

    // Check if _id just became available (changed from undefined to defined)
    if (currentId && !prevId && project) {
      console.log(`[useInitialMediaStorage] Project _id ${currentId} detected. Checking for scenes needing storage.`);
      
      project.scenes.forEach(scene => {
        const needsStorage = scene.media?.url && !scene.media?.storageKey;
        const isStoring = storingMediaStatus[scene.id];

        if (needsStorage && !isStoring) {
          console.log(`[useInitialMediaStorage] Triggering storage for pre-existing scene ${scene.id}`);
          // Use local state to track initiated storage
          setStoringMediaStatus(prev => ({ ...prev, [scene.id]: true })); 
          storeSceneMedia(scene, project, updateSceneMedia)
            .catch(error => {
              console.error(`[useInitialMediaStorage] Error storing media for scene ${scene.id}:`, error);
              // Reset status on error
              setStoringMediaStatus(prev => ({ ...prev, [scene.id]: false })); 
            });
        } else if (needsStorage && isStoring) {
          console.log(`[useInitialMediaStorage] Storage already in progress for pre-existing scene ${scene.id}`);
        }
      });
    }

    // Update the ref with the current _id for the next render
    prevProjectIdRef.current = currentId;

  // Depend on the project object (or _id/scenes specifically if stable), status map, and callbacks
  // Using project?._id and project?.scenes ensures stability if the project object reference changes unnecessarily
  }, [project?._id, project?.scenes, storingMediaStatus, setStoringMediaStatus, updateSceneMedia]);
} 