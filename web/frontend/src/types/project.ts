/**
 * Project and scene related type definitions
 */

export interface SceneData {
  id: string;
  mediaUrl: string;
  audioUrl?: string;
  trimStart?: number;
  trimEnd?: number;
  duration?: number;
  title?: string;
  description?: string;
  order?: number;
  status?: 'pending' | 'processing' | 'ready' | 'error';
}

export interface ProjectData {
  id: string;
  title: string;
  description?: string;
  scenes: SceneData[];
  createdAt: string;
  updatedAt: string;
  status: 'draft' | 'processing' | 'ready' | 'error';
}

export interface ProjectMetadata {
  id: string;
  title: string;
  sceneCount: number;
  createdAt: string;
  updatedAt: string;
  status: ProjectData['status'];
}

export interface ProjectSettings {
  autoSave: boolean;
  defaultDuration: number;
  maxScenes: number;
  outputFormat: 'mp4' | 'webm';
  outputQuality: 'low' | 'medium' | 'high';
} 