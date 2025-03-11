import { 
  ProjectState, 
  ProjectAction, 
  Project, 
  Scene, 
  generateId 
} from './ProjectTypes';

/**
 * Project state reducer
 * Handles all project state updates in a predictable way
 */
export function projectReducer(state: ProjectState, action: ProjectAction): ProjectState {
  switch (action.type) {
    case 'CREATE_PROJECT': {
      const newProject: Project = {
        id: generateId(),
        title: action.payload.title,
        scenes: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        status: 'draft',
      };

      return {
        ...state,
        projects: [...state.projects, newProject],
        currentProject: newProject,
        error: null,
      };
    }

    case 'SET_CURRENT_PROJECT': {
      const project = state.projects.find((p) => p && p.id === action.payload.projectId) || null;
      return {
        ...state,
        currentProject: project,
        error: project ? null : 'Project not found',
      };
    }

    case 'ADD_SCENE_LOADING': {
      if (!state.currentProject) {
        return {
          ...state,
          error: 'No active project to add scene to',
        };
      }

      const newScene: Scene = {
        id: action.payload.sceneId,
        url: action.payload.url,
        text: '',
        source: {
          platform: 'reddit', // Default to reddit for now
        },
        createdAt: Date.now(),
        isLoading: true,
      };

      const updatedProject: Project = {
        ...state.currentProject,
        scenes: [...state.currentProject.scenes, newScene],
        updatedAt: Date.now(),
      };

      // Create updated projects array, safely handling null projects
      const updatedProjects = state.projects.map(p => 
        p && p.id === updatedProject.id ? updatedProject : p
      );

      return {
        ...state,
        currentProject: updatedProject,
        projects: updatedProjects,
        error: null,
      };
    }

    case 'ADD_SCENE_SUCCESS': {
      if (!state.currentProject) {
        return {
          ...state,
          error: 'No active project to update scene in',
        };
      }

      const updatedScenes = state.currentProject.scenes.map((scene) =>
        scene.id === action.payload.sceneId
          ? { ...scene, ...action.payload.sceneData, isLoading: false, error: undefined }
          : scene
      );

      const updatedProject: Project = {
        ...state.currentProject,
        scenes: updatedScenes,
        updatedAt: Date.now(),
      };

      // Safely update projects array
      const updatedProjects = state.projects.map((p) => 
        p && p.id === updatedProject.id ? updatedProject : p
      );

      return {
        ...state,
        currentProject: updatedProject,
        projects: updatedProjects,
        error: null,
      };
    }

    case 'ADD_SCENE_ERROR': {
      if (!state.currentProject) {
        return {
          ...state,
          error: 'No active project to update scene in',
        };
      }

      const updatedScenes = state.currentProject.scenes.map((scene) =>
        scene.id === action.payload.sceneId
          ? { ...scene, isLoading: false, error: action.payload.error }
          : scene
      );

      const updatedProject: Project = {
        ...state.currentProject,
        scenes: updatedScenes,
        updatedAt: Date.now(),
      };

      // Safely update projects array
      const updatedProjects = state.projects.map((p) => 
        p && p.id === updatedProject.id ? updatedProject : p
      );

      return {
        ...state,
        currentProject: updatedProject,
        projects: updatedProjects,
      };
    }

    case 'REMOVE_SCENE': {
      if (!state.currentProject) {
        console.error('REMOVE_SCENE action failed: No active project in state');
        return {
          ...state,
          error: 'No active project to remove scene from',
        };
      }

      const sceneId = action.payload.sceneId;
      console.log(`Reducer: Removing scene ${sceneId} from project ${state.currentProject.id}`);

      // Verify the scene exists and log scene IDs for debugging
      const projectScenes = state.currentProject.scenes || [];
      const currentSceneIds = projectScenes.map(s => s.id);
      const sceneExists = currentSceneIds.includes(sceneId);
      
      if (!sceneExists) {
        console.warn(`Scene with ID ${sceneId} not found in project ${state.currentProject.id}. Available scenes: ${JSON.stringify(currentSceneIds)}`);
      }

      // Remove the scene from the array even if it doesn't exist (idempotent operation)
      const updatedScenes = projectScenes.filter(
        (scene) => scene.id !== sceneId
      );

      const updatedProject: Project = {
        ...state.currentProject,
        scenes: updatedScenes,
        updatedAt: Date.now(),
      };

      console.log(`Reducer: Project updated after scene removal. Original count: ${projectScenes.length}, New count: ${updatedScenes.length}`);

      // Safely update projects array
      const updatedProjects = state.projects.map((p) => 
        p && p.id === updatedProject.id ? updatedProject : p
      );

      return {
        ...state,
        currentProject: updatedProject,
        projects: updatedProjects,
        error: null, // Clear any previous errors
      };
    }

    case 'REORDER_SCENES': {
      if (!state.currentProject) {
        return {
          ...state,
          error: 'No active project to reorder scenes in',
        };
      }

      // Create a map of id -> scene for quick lookup
      const sceneMap = new Map(
        state.currentProject.scenes.map((scene) => [scene.id, scene])
      );

      // Create new scenes array based on sceneIds order
      const updatedScenes = action.payload.sceneIds
        .map((id) => sceneMap.get(id))
        .filter(Boolean) as Scene[];

      const updatedProject: Project = {
        ...state.currentProject,
        scenes: updatedScenes,
        updatedAt: Date.now(),
      };

      // Safely update projects array
      const updatedProjects = state.projects.map((p) => 
        p && p.id === updatedProject.id ? updatedProject : p
      );

      return {
        ...state,
        currentProject: updatedProject,
        projects: updatedProjects,
      };
    }

    case 'UPDATE_SCENE_TEXT': {
      if (!state.currentProject) {
        return {
          ...state,
          error: 'No active project to update scene in',
        };
      }

      const updatedScenes = state.currentProject.scenes.map((scene) =>
        scene.id === action.payload.sceneId
          ? { ...scene, text: action.payload.text }
          : scene
      );

      const updatedProject: Project = {
        ...state.currentProject,
        scenes: updatedScenes,
        updatedAt: Date.now(),
      };

      // Safely update projects array
      const updatedProjects = state.projects.map((p) => 
        p && p.id === updatedProject.id ? updatedProject : p
      );

      return {
        ...state,
        currentProject: updatedProject,
        projects: updatedProjects,
      };
    }

    case 'SET_PROJECT_TITLE': {
      if (!state.currentProject) {
        return {
          ...state,
          error: 'No active project to update title for',
        };
      }

      const updatedProject: Project = {
        ...state.currentProject,
        title: action.payload.title,
        updatedAt: Date.now(),
      };

      // Safely update projects array
      const updatedProjects = state.projects.map((p) => 
        p && p.id === updatedProject.id ? updatedProject : p
      );

      return {
        ...state,
        currentProject: updatedProject,
        projects: updatedProjects,
      };
    }

    case 'SET_ERROR':
      return {
        ...state,
        error: action.payload.error,
      };

    case 'CLEAR_ERROR':
      return {
        ...state,
        error: null,
      };

    case 'SET_LOADING':
      return {
        ...state,
        isLoading: action.payload.isLoading,
      };

    case 'LOAD_PROJECTS':
      return {
        ...state,
        projects: action.payload.projects,
        error: null,
      };

    case 'SET_SAVING':
      return {
        ...state,
        isSaving: action.payload.isSaving,
      };

    case 'SET_LAST_SAVED':
      return {
        ...state,
        lastSaved: action.payload.timestamp,
      };

    case 'LOAD_PROJECT_SUCCESS':
      return {
        ...state,
        currentProject: action.payload.project,
        projects: [
          ...state.projects.filter((p) => p && p.id !== action.payload.project.id),
          action.payload.project,
        ],
        error: null,
      };

    case 'DUPLICATE_PROJECT_SUCCESS':
      return {
        ...state,
        currentProject: action.payload.project,
        projects: [...state.projects, action.payload.project],
        error: null,
      };

    case 'DELETE_ALL_PROJECTS_SUCCESS':
      return {
        ...state,
        projects: [],
        currentProject: null,
        error: null,
      };

    default:
      // Just return the state for unhandled action types
      return state;
  }
} 