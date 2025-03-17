/**
 * @fileoverview Project management API client for interacting with the backend
 * 
 * This module provides functions for project management:
 * - Creating, updating, and deleting projects
 * - Managing project scenes and content
 * - Handling project metadata
 */

import { fetchAPI } from './core';
import { ApiResponse, SaveAudioRequest, SaveAudioResponse } from '../api-types';
import { Project, Scene } from '../../components/project/ProjectTypes';
import { 
  CreateProjectRequest, 
  UpdateProjectRequest,
  ReorderScenesRequest
} from './types';

/**
 * Create a new project
 * 
 * @param {CreateProjectRequest} request - Project creation request
 * @returns {Promise<ApiResponse<Project>>} Promise with created project
 */
export async function createProject(
  request: CreateProjectRequest
): Promise<ApiResponse<Project>> {
  return fetchAPI<Project>('/projects', {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

/**
 * Get all projects for the current user
 * 
 * @returns {Promise<ApiResponse<Project[]>>} Promise with list of projects
 */
export async function getProjects(): Promise<ApiResponse<Project[]>> {
  return fetchAPI<Project[]>('/projects', { method: 'GET' });
}

/**
 * Get a project by ID
 * 
 * @param {string} projectId - ID of the project to retrieve
 * @returns {Promise<ApiResponse<Project>>} Promise with project data
 */
export async function getProject(projectId: string): Promise<ApiResponse<Project>> {
  return fetchAPI<Project>(`/projects/${projectId}`, { method: 'GET' });
}

/**
 * Update a project
 * 
 * @param {string} projectId - ID of the project to update
 * @param {UpdateProjectRequest} request - Project update request
 * @returns {Promise<ApiResponse<Project>>} Promise with updated project
 */
export async function updateProject(
  projectId: string,
  request: UpdateProjectRequest
): Promise<ApiResponse<Project>> {
  return fetchAPI<Project>(`/projects/${projectId}`, {
    method: 'PUT',
    body: JSON.stringify(request),
  });
}

/**
 * Delete a project
 * 
 * @param {string} projectId - ID of the project to delete
 * @returns {Promise<ApiResponse<{ success: boolean }>>} Promise with deletion result
 */
export async function deleteProject(
  projectId: string
): Promise<ApiResponse<{ success: boolean }>> {
  return fetchAPI<{ success: boolean }>(`/projects/${projectId}`, {
    method: 'DELETE',
  });
}

/**
 * Update project metadata
 * 
 * @param {string} projectId - ID of the project to update
 * @param {Record<string, any>} metadata - Project metadata to update
 * @returns {Promise<ApiResponse<Project>>} Promise with updated project
 */
export async function updateProjectMetadata(
  projectId: string,
  metadata: Record<string, any>
): Promise<ApiResponse<Project>> {
  return fetchAPI<Project>(`/projects/${projectId}/metadata`, {
    method: 'PUT',
    body: JSON.stringify(metadata),
  });
}

/**
 * Add a scene to a project
 * 
 * @param {string} projectId - ID of the project to add the scene to
 * @param {Scene} scene - Scene to add
 * @returns {Promise<ApiResponse<Project>>} Promise with updated project
 */
export async function addScene(
  projectId: string,
  scene: Scene
): Promise<ApiResponse<Project>> {
  return fetchAPI<Project>(`/projects/${projectId}/scenes`, {
    method: 'POST',
    body: JSON.stringify(scene),
  });
}

/**
 * Update a scene in a project
 * 
 * @param {string} projectId - ID of the project containing the scene
 * @param {string} sceneId - ID of the scene to update
 * @param {Partial<Scene>} scene - Scene data to update
 * @returns {Promise<ApiResponse<Project>>} Promise with updated project
 */
export async function updateScene(
  projectId: string,
  sceneId: string,
  scene: Partial<Scene>
): Promise<ApiResponse<Project>> {
  return fetchAPI<Project>(`/projects/${projectId}/scenes/${sceneId}`, {
    method: 'PUT',
    body: JSON.stringify(scene),
  });
}

/**
 * Delete a scene from a project
 * 
 * @param {string} projectId - ID of the project containing the scene
 * @param {string} sceneId - ID of the scene to delete
 * @returns {Promise<ApiResponse<Project>>} Promise with updated project
 */
export async function deleteScene(
  projectId: string,
  sceneId: string
): Promise<ApiResponse<Project>> {
  return fetchAPI<Project>(`/projects/${projectId}/scenes/${sceneId}`, {
    method: 'DELETE',
  });
}

/**
 * Reorder scenes in a project
 * 
 * @param {string} projectId - ID of the project to reorder scenes in
 * @param {string[]} sceneIds - Ordered list of scene IDs
 * @returns {Promise<ApiResponse<Project>>} Promise with updated project
 */
export async function reorderScenes(
  projectId: string,
  sceneIds: string[]
): Promise<ApiResponse<Project>> {
  const request: ReorderScenesRequest = { scene_ids: sceneIds };
  
  return fetchAPI<Project>(`/projects/${projectId}/scenes/reorder`, {
    method: 'PUT',
    body: JSON.stringify(request),
  });
}

/**
 * Save audio to persistent storage
 * 
 * @param {SaveAudioRequest} request - Audio save request
 * @returns {Promise<ApiResponse<SaveAudioResponse>>} Promise with save result
 */
export async function saveAudio(
  request: SaveAudioRequest
): Promise<ApiResponse<SaveAudioResponse>> {
  return fetchAPI<SaveAudioResponse>('/projects/audio', {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

/**
 * Generate a video from a project
 * 
 * @param {string} projectId - ID of the project to generate video from
 * @returns {Promise<ApiResponse<{ job_id: string }>>} Promise with job ID
 */
export async function generateVideo(
  projectId: string
): Promise<ApiResponse<{ job_id: string }>> {
  return fetchAPI<{ job_id: string }>(`/projects/${projectId}/generate-video`, {
    method: 'POST',
  }, 30000); // 30 second timeout
}

/**
 * Get video generation status
 * 
 * @param {string} jobId - ID of the video generation job
 * @returns {Promise<ApiResponse<{ status: string, progress: number, video_url?: string, error?: string }>>} Promise with job status
 */
export async function getVideoStatus(
  jobId: string
): Promise<ApiResponse<{ status: string, progress: number, video_url?: string, error?: string }>> {
  return fetchAPI<{ status: string, progress: number, video_url?: string, error?: string }>(
    `/projects/video-status/${jobId}`,
    { method: 'GET' }
  );
} 