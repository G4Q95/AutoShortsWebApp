/**
 * @fileoverview Type definitions for the API client modules
 * 
 * This module provides shared type definitions used across the API client modules.
 * It includes request and response types for various API endpoints.
 */

import { Project, ProjectMetadata, Scene } from '../../components/project/ProjectTypes';

/**
 * Request to create a new project
 */
export interface CreateProjectRequest {
  /** Title of the project */
  title: string;
  /** Optional initial scenes */
  scenes?: Scene[];
  /** Optional metadata */
  metadata?: Record<string, any>;
}

/**
 * Request to update an existing project
 */
export interface UpdateProjectRequest {
  /** Updated title (optional) */
  title?: string;
  /** Updated scenes (optional) */
  scenes?: Scene[];
  /** Updated status (optional) */
  status?: 'draft' | 'processing' | 'completed' | 'error';
  /** Updated metadata (optional) */
  metadata?: Record<string, any>;
}

/**
 * Request to reorder scenes in a project
 */
export interface ReorderScenesRequest {
  /** Ordered array of scene IDs */
  scene_ids: string[];
}

/**
 * Response for project listing
 */
export interface ProjectListResponse {
  /** Array of projects */
  projects: Project[];
  /** Total count of projects */
  total: number;
}

/**
 * Response for project metadata listing
 */
export interface ProjectMetadataListResponse {
  /** Array of project metadata */
  projects: ProjectMetadata[];
  /** Total count of projects */
  total: number;
}

/**
 * Request to generate a video from a project
 */
export interface GenerateVideoRequest {
  /** Project ID to generate video from */
  project_id: string;
  /** Optional video settings */
  settings?: {
    /** Video resolution */
    resolution?: '720p' | '1080p';
    /** Video format */
    format?: 'mp4' | 'webm';
    /** Video quality (0-100) */
    quality?: number;
  };
}

/**
 * Response for video generation request
 */
export interface GenerateVideoResponse {
  /** Job ID for tracking video generation progress */
  job_id: string;
  /** Estimated completion time in seconds */
  estimated_time?: number;
}

/**
 * Response for video generation status
 */
export interface VideoStatusResponse {
  /** Current status of the video generation */
  status: 'queued' | 'processing' | 'completed' | 'failed';
  /** Progress percentage (0-100) */
  progress: number;
  /** URL to the generated video (if completed) */
  video_url?: string;
  /** Error message (if failed) */
  error?: string;
  /** Estimated time remaining in seconds */
  estimated_time_remaining?: number;
}

/**
 * Response for updating scene trim values
 */
export interface SceneTrimUpdateResponse {
  /** Scene ID that was updated */
  scene_id: string;
  /** Updated trim start value in seconds */
  trim_start: number;
  /** Updated trim end value in seconds */
  trim_end: number | null;
  /** Project ID containing the scene */
  project_id: string;
  /** Operation success status */
  success: boolean;
} 