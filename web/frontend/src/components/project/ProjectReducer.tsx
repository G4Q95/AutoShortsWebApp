import { ProjectState, Project, Scene } from './ProjectTypes';

type ProjectAction =
  | { type: 'CREATE_PROJECT'; payload: { title: string } }
  | { type: 'SET_CURRENT_PROJECT'; payload: { projectId: string | null } }
  | { type: 'ADD_SCENE'; payload: { url: string } }
  | { type: 'ADD_SCENE_LOADING'; payload: { sceneId: string; url: string } }
  | { type: 'ADD_SCENE_SUCCESS'; payload: { scene: Scene } }
  | { type: 'ADD_SCENE_ERROR'; payload: { sceneId: string; error: string } }
  | { type: 'REMOVE_SCENE'; payload: { sceneId: string } }
  | { type: 'REORDER_SCENES'; payload: { sceneIds: string[] } }
  | { type: 'UPDATE_SCENE_TEXT'; payload: { sceneId: string; text: string } }
  | { type: 'UPDATE_SCENE_AUDIO'; payload: { sceneId: string; audioData: Scene['audio']; voiceSettings: Scene['voice_settings'] } }
  | { type: 'UPDATE_SCENE_MEDIA'; payload: { sceneId: string; mediaData: Partial<Scene['media']> } }
  | { type: 'SET_PROJECT_TITLE'; payload: { title: string } }
  | { type: 'SET_ERROR'; payload: { error: string | null } }
  | { type: 'SET_SAVING'; payload: { isSaving: boolean } }
  | { type: 'SET_LAST_SAVED'; payload: { timestamp: number } }
  | { type: 'LOAD_PROJECT_SUCCESS'; payload: { project: Project } }
  | { type: 'DUPLICATE_PROJECT_SUCCESS'; payload: { projectId: string } }
  | { type: 'CLEAR_ALL_PROJECTS' }
  | { type: 'LOAD_PROJECTS'; payload: { projects: Project[] } }
  | { type: 'SET_LOADING'; payload: { isLoading: boolean } }
  | { type: 'SET_MODE'; payload: { mode: 'organization' | 'voice-enabled' | 'preview' } }
  | { type: 'SET_SCENE_STORING_MEDIA'; payload: { sceneId: string; isStoringMedia: boolean } }
  | { type: 'UPDATE_PROJECT_METADATA'; payload: { projectId: string; changes: Partial<Pick<Project, 'title' | 'aspectRatio' /* | Add other updatable fields */>> } }
  | { type: 'UPDATE_SCENE_STORAGE_INFO'; payload: { sceneId: string; storageKey: string; thumbnailUrl?: string } };

// Implement the project reducer to handle state updates
export function projectReducer(state: ProjectState, action: ProjectAction): ProjectState {
  console.log(`REDUCER: Processing action type: ${action.type}`);
  
  switch (action.type) {
    case 'CREATE_PROJECT': {
      // Generate a new project with a unique ID
      const currentDate = new Date();
      const newProject: Project = {
        id: `proj_${currentDate.getTime().toString(36)}`,
        title: action.payload.title,
        scenes: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        lastModified: Date.now(),
        status: 'draft',
        aspectRatio: '9:16',
        showLetterboxing: true,
      };

      // Add the new project to the projects list and set it as current
      return {
        ...state,
        projects: [...state.projects, newProject],
        currentProject: newProject,
      };
    }

    case 'SET_CURRENT_PROJECT': {
      // Find the project with the given ID
      const project = state.projects.find(
        (p) => p.id === action.payload.projectId
      );

      // If project found, set it as current
      if (project) {
        console.log(`REDUCER: Setting project ${project.id} as current, scenes: ${project.scenes.length}`);
        return {
          ...state,
          currentProject: project,
        };
      }

      // If not found, don't change state but log error
      console.error(`Project with ID ${action.payload.projectId} not found`);
      return state;
    }

    case 'ADD_SCENE_LOADING': {
      // Create a new scene with loading state
      const newScene: Scene = {
        id: action.payload.sceneId,
        url: action.payload.url,
        text: '',
        isLoading: true,
        createdAt: Date.now(),
        source: {
          platform: 'reddit',
        },
      };

      // Ensure current project exists
      if (!state.currentProject) {
        console.error('No active project to add scene to');
        return {
          ...state,
          error: 'No active project to add scene to',
        };
      }

      // Log the scene being added
      console.log(`REDUCER: Adding scene ${newScene.id} to project. Current scenes count: ${state.currentProject.scenes.length}`);

      // Create updated scenes array with the new scene appended
      const updatedScenes = [...state.currentProject.scenes, newScene];

      // Create updated project with the new scenes array
      const updatedProject: Project = {
        ...state.currentProject,
        scenes: updatedScenes,
        updatedAt: Date.now(),
      };

      // Log the updated project
      console.log(`REDUCER: Updated project now has ${updatedProject.scenes.length} scenes`);

      // Return updated state
      return {
        ...state,
        currentProject: updatedProject,
      };
    }

    case 'LOAD_PROJECT_SUCCESS': {
      const loadedProject = action.payload.project;
      
      console.log(`REDUCER: Loaded project ${loadedProject.id} with ${loadedProject.scenes.length} scenes`);
      
      // Find if this project already exists in the projects list
      const existingProjectIndex = state.projects.findIndex(
        (p) => p.id === loadedProject.id
      );

      // Create a new projects array with the loaded project
      let updatedProjects = [...state.projects];

      if (existingProjectIndex >= 0) {
        // Replace existing project
        updatedProjects[existingProjectIndex] = loadedProject;
      } else {
        // Add as a new project
        updatedProjects = [...updatedProjects, loadedProject];
      }

      return {
        ...state,
        projects: updatedProjects,
        currentProject: loadedProject,
      };
    }

    case 'ADD_SCENE_ERROR': {
      // Handle error for scene loading
      if (!state.currentProject) return state;

      // Find and update the scene with error state
      const updatedScenes = state.currentProject.scenes.map((scene) => {
        if (scene.id === action.payload.sceneId) {
          return {
            ...scene,
            isLoading: false,
            error: action.payload.error,
          };
        }
        return scene;
      });

      // Create updated project
      const updatedProject: Project = {
        ...state.currentProject,
        scenes: updatedScenes,
        updatedAt: Date.now(),
      };

      return {
        ...state,
        currentProject: updatedProject,
        error: `Error adding scene: ${action.payload.error}`,
      };
    }

    case 'REMOVE_SCENE': {
      // Remove a scene from the current project
      if (!state.currentProject) return state;

      // Filter out the scene to remove
      const updatedScenes = state.currentProject.scenes.filter(
        (scene) => scene.id !== action.payload.sceneId
      );

      // Create updated project
      const updatedProject: Project = {
        ...state.currentProject,
        scenes: updatedScenes,
        updatedAt: Date.now(),
      };

      return {
        ...state,
        currentProject: updatedProject,
      };
    }

    case 'REORDER_SCENES': {
      if (!state.currentProject) return state;

      const sceneMap = new Map(state.currentProject.scenes.map(scene => [scene.id, scene]));
      const reorderedScenes = action.payload.sceneIds
        .map(id => sceneMap.get(id))
        .filter((scene): scene is Scene => scene !== undefined);

      if (reorderedScenes.length !== state.currentProject.scenes.length) {
        console.error("Reducer: Scene count mismatch during reorder");
        // Avoid partial updates if something went wrong
        return state; 
      }

      const updatedProject: Project = {
        ...state.currentProject,
        scenes: reorderedScenes,
        updatedAt: Date.now(),
      };

      return {
        ...state,
        currentProject: updatedProject,
      };
    }

    case 'UPDATE_SCENE_TEXT': {
      // Update text content of a scene
      if (!state.currentProject) return state;

      // Update the specific scene
      const updatedScenes = state.currentProject.scenes.map((scene) => {
        if (scene.id === action.payload.sceneId) {
          return {
            ...scene,
            text: action.payload.text,
          };
        }
        return scene;
      });

      // Create updated project
      const updatedProject: Project = {
        ...state.currentProject,
        scenes: updatedScenes,
        updatedAt: Date.now(),
      };

      return {
        ...state,
        currentProject: updatedProject,
      };
    }

    case 'UPDATE_SCENE_AUDIO': {
      // Update audio data of a scene
      if (!state.currentProject) return state;

      // Update the specific scene
      const updatedScenes = state.currentProject.scenes.map((scene) => {
        if (scene.id === action.payload.sceneId) {
          return {
            ...scene,
            audio: action.payload.audioData,
            voice_settings: action.payload.voiceSettings,
          };
        }
        return scene;
      });

      // Create updated project
      const updatedProject: Project = {
        ...state.currentProject,
        scenes: updatedScenes,
        updatedAt: Date.now(),
      };

      return {
        ...state,
        currentProject: updatedProject,
      };
    }

    case 'UPDATE_SCENE_MEDIA': {
      // Update media data for a specific scene
      if (!state.currentProject) return state;

      const updatedScenes = state.currentProject.scenes.map((scene) => {
        if (scene.id === action.payload.sceneId) {
          // Ensure we handle the media object update carefully
          const existingMedia = scene.media;
          const newMediaData = action.payload.mediaData;

          // If new media data is provided, merge it with existing or create new
          let updatedMedia: Scene['media'] | undefined = undefined;
          if (newMediaData) {
            if (existingMedia) {
              // Merge new data into existing media
              updatedMedia = { ...existingMedia, ...newMediaData };
            } else {
              // If no existing media, new data MUST contain a type
              if (newMediaData.type) {
                updatedMedia = { ...newMediaData } as Scene['media']; // Assert type if necessary, assuming payload is correct
              } else {
                console.error('Cannot update scene media without a type if no existing media exists');
                // Decide how to handle: skip update, set error, etc.
                // For now, we skip the media update for this scene if type is missing.
                updatedMedia = existingMedia; // Keep existing (which is undefined)
              }
            }
          } else {
            // If no new media data, keep existing
            updatedMedia = existingMedia;
          }

          return {
            ...scene,
            media: updatedMedia,
            updatedAt: Date.now(), // Update scene timestamp
          };
        }
        return scene;
      });

      // Create updated project with updated scenes
      const updatedProject: Project = {
        ...state.currentProject,
        scenes: updatedScenes,
        updatedAt: Date.now(),
      };

      return {
        ...state,
        currentProject: updatedProject,
      };
    }

    case 'SET_ERROR': {
      // Set error state
      return {
        ...state,
        error: action.payload.error,
      };
    }

    case 'SET_SAVING': {
      // Set saving state
      return {
        ...state,
        isSaving: action.payload.isSaving,
      };
    }

    case 'SET_LAST_SAVED': {
      // Update last saved timestamp
      return {
        ...state,
        lastSaved: action.payload.timestamp,
      };
    }

    case 'LOAD_PROJECTS': {
      // Update projects list
      return {
        ...state,
        projects: action.payload.projects,
      };
    }

    case 'SET_LOADING': {
      // Set loading state
      return {
        ...state,
        isLoading: action.payload.isLoading,
      };
    }

    case 'DUPLICATE_PROJECT_SUCCESS': {
      // Handle successful project duplication
      // The actual project will be loaded via LOAD_PROJECT_SUCCESS
      return state;
    }

    case 'CLEAR_ALL_PROJECTS': {
      // Clear all projects
      return {
        ...state,
        projects: [],
        currentProject: null,
      };
    }

    case 'SET_MODE': {
      // Update UI mode
      return {
        ...state,
        mode: action.payload.mode,
      };
    }

    case 'SET_SCENE_STORING_MEDIA': {
      // Update storing media flag for a scene
      if (!state.currentProject) return state;

      // Update the specific scene
      const updatedScenes = state.currentProject.scenes.map((scene) => {
        if (scene.id === action.payload.sceneId) {
          return {
            ...scene,
            isStoringMedia: action.payload.isStoringMedia,
          };
        }
        return scene;
      });

      // Create updated project
      const updatedProject: Project = {
        ...state.currentProject,
        scenes: updatedScenes,
        updatedAt: Date.now(),
      };

      return {
        ...state,
        currentProject: updatedProject,
      };
    }

    case 'UPDATE_PROJECT_METADATA': {
      // Update metadata (like title, aspectRatio) for a specific project in the main list
      const updatedProjects = state.projects.map(project => {
        if (project.id === action.payload.projectId) {
          return {
            ...project,
            ...action.payload.changes, // Apply changes (e.g., { title: 'New Title' })
            updatedAt: Date.now(), // Always update timestamp
          };
        }
        return project;
      });

      // Also update currentProject if it\'s the one being modified
      let updatedCurrentProject = state.currentProject;
      if (state.currentProject && state.currentProject.id === action.payload.projectId) {
        updatedCurrentProject = {
          ...state.currentProject,
          ...action.payload.changes,
          updatedAt: Date.now(),
        };
      }

      return {
        ...state,
        projects: updatedProjects,
        currentProject: updatedCurrentProject,
      };
    }

    case 'UPDATE_SCENE_STORAGE_INFO': {
      if (!state.currentProject) return state;

      const { sceneId, storageKey, thumbnailUrl } = action.payload;

      console.log(`REDUCER: Updating storage info for scene ${sceneId} with key ${storageKey}`);

      const updatedScenes = state.currentProject.scenes.map((scene) => {
        if (scene.id === sceneId) {
          // Define the type for the updated media object explicitly
          const updatedMedia: Scene['media'] = {
            ...(scene.media || { type: 'video', url: '' }), // Provide default structure if media was null
            storageKey: storageKey,
            storedUrl: `/api/v1/storage/${storageKey}`, // Construct the URL
            thumbnailUrl: thumbnailUrl || scene.media?.thumbnailUrl, // Update thumbnail if provided
            isStorageBacked: true, // Mark as stored
          };

          // Ensure essential properties from the original media are kept if they existed
          // No need to re-check these if we spread `scene.media` which already has them
          // if (!updatedMedia.url && scene.media?.url) updatedMedia.url = scene.media.url;
          // if (!updatedMedia.type && scene.media?.type) updatedMedia.type = scene.media.type;
          // if (!updatedMedia.mediaAspectRatio && scene.media?.mediaAspectRatio) updatedMedia.mediaAspectRatio = scene.media.mediaAspectRatio;
          // if (!updatedMedia.trim && scene.media?.trim) updatedMedia.trim = scene.media.trim;
          
          // Assign the strictly typed media object back
          return {
            ...scene,
            media: updatedMedia,
            isStoringMedia: false, // Indicate storage process is complete for this scene
          };
        }
        return scene;
      });

      const updatedProject: Project = {
        ...state.currentProject,
        scenes: updatedScenes,
        updatedAt: Date.now(), // Mark project as updated
      };

      return {
        ...state,
        currentProject: updatedProject,
      };
    }

    case 'SET_PROJECT_TITLE': {
      // Update the title of the current project
      if (!state.currentProject) return state;

      return {
        ...state,
        currentProject: {
          ...state.currentProject,
          title: action.payload.title,
          updatedAt: Date.now(),
        },
      };
    }

    default:
      return state;
  }
} 