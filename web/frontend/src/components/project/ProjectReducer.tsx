import { ProjectState, Project, Scene } from './ProjectTypes';

type ProjectAction =
  | { type: 'CREATE_PROJECT'; payload: { title: string } }
  | { type: 'SET_CURRENT_PROJECT'; payload: { projectId: string } }
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
  | { type: 'SET_SCENE_STORING_MEDIA'; payload: { sceneId: string; isStoringMedia: boolean } };

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
      // Reorder scenes in the current project
      if (!state.currentProject) return state;

      // Get current scenes
      const currentScenes = state.currentProject.scenes;

      // Create a map for quick lookup
      const scenesMap = new Map(currentScenes.map(scene => [scene.id, scene]));

      // Reorder scenes based on the new order
      const reorderedScenes = action.payload.sceneIds
        .map(id => scenesMap.get(id))
        .filter((scene): scene is Scene => scene !== undefined);

      // Create updated project
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
      // Update media data of a scene
      if (!state.currentProject) return state;

      // Update the specific scene
      const updatedScenes = state.currentProject.scenes.map((scene) => {
        if (scene.id === action.payload.sceneId) {
          // Merge existing media with new media data
          const updatedMedia = {
            ...scene.media,
            ...action.payload.mediaData,
          };

          return {
            ...scene,
            media: updatedMedia,
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

    case 'SET_PROJECT_TITLE': {
      // Update the title of the current project
      if (!state.currentProject) return state;

      // Create updated project
      const updatedProject: Project = {
        ...state.currentProject,
        title: action.payload.title,
        updatedAt: Date.now(),
      };

      // Update in the projects list as well
      const updatedProjects = state.projects.map((p) =>
        p.id === updatedProject.id ? updatedProject : p
      );

      return {
        ...state,
        currentProject: updatedProject,
        projects: updatedProjects,
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

    default:
      return state;
  }
} 