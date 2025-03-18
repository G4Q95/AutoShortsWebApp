/**
 * @fileoverview Video API module for video processing operations
 * 
 * This module provides dedicated functions for video creation and status tracking.
 * It handles:
 * - Video creation requests
 * - Status monitoring and polling
 * - Cancellation operations
 * - Error handling specific to video processing
 * 
 * @module api/video
 */

import { 
  ApiResponse, 
  VideoCreationResponse, 
  VideoStatusResponse 
} from '../api-types';
import { fetchAPI } from '../api-client';

// Validation constants
const MIN_TITLE_LENGTH = 3;
const MAX_TITLE_LENGTH = 100;
const VALID_TEXT_STYLES = ['engaging', 'professional', 'casual', 'dramatic', 'educational'];

/**
 * Validates video creation parameters
 * 
 * @param {string} sourceUrl - URL of content to process
 * @param {string} title - Title for the video
 * @param {string} voiceId - ID of voice to use
 * @param {string} textStyle - Style for text rewriting
 * @returns {string|null} Error message if validation fails, null if validation passes
 */
function validateVideoCreationParams(
  sourceUrl: string,
  title: string,
  voiceId: string,
  textStyle: string
): string | null {
  // Validate required fields
  if (!sourceUrl) return 'Source URL is required';
  if (!title) return 'Title is required';
  
  // Validate URL format
  try {
    new URL(sourceUrl);
  } catch (e) {
    return 'Invalid URL format';
  }
  
  // Validate title length
  if (title.length < MIN_TITLE_LENGTH) {
    return `Title must be at least ${MIN_TITLE_LENGTH} characters`;
  }
  if (title.length > MAX_TITLE_LENGTH) {
    return `Title must not exceed ${MAX_TITLE_LENGTH} characters`;
  }
  
  // Validate text style if provided
  if (textStyle && !VALID_TEXT_STYLES.includes(textStyle)) {
    return `Text style must be one of: ${VALID_TEXT_STYLES.join(', ')}`;
  }
  
  return null;
}

/**
 * Create a new video from content at the provided URL
 * 
 * @param {string} sourceUrl - URL of content to process into video
 * @param {string} title - Title for the video
 * @param {string} [voiceId='default'] - ID of voice to use for narration
 * @param {string} [textStyle='engaging'] - Style for text rewriting
 * @returns {Promise<ApiResponse<VideoCreationResponse>>} Promise with video creation result
 * 
 * @example
 * const result = await createVideo(
 *   'https://www.reddit.com/r/example/comments/abc123/example_post',
 *   'My Amazing Video',
 *   'voice123',
 *   'engaging'
 * );
 * if (!result.error) {
 *   console.log('Video creation started with ID:', result.data.videoId);
 * }
 */
export async function createVideo(
  sourceUrl: string,
  title: string,
  voiceId: string = 'default',
  textStyle: string = 'engaging'
): Promise<ApiResponse<VideoCreationResponse>> {
  console.log('Starting video creation process:', { sourceUrl, title, voiceId, textStyle });
  
  // Input validation
  const validationError = validateVideoCreationParams(sourceUrl, title, voiceId, textStyle);
  if (validationError) {
    console.error('Video creation validation error:', validationError);
    
    return {
      data: null as any,
      error: {
        message: validationError,
        status_code: 400,
        error_code: 'VALIDATION_ERROR'
      },
      timing: {
        start: Date.now(),
        end: Date.now(),
        duration: 0
      },
      connectionInfo: {
        success: false,
        server: '',
        status: 400,
        statusText: 'Bad Request'
      }
    };
  }

  try {
    return fetchAPI('/video-creation/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        source_url: sourceUrl,
        title,
        voice_id: voiceId,
        text_style: textStyle,
      }),
    }, 30000); // 30s timeout for video creation requests
  } catch (error) {
    console.error('Unexpected error in video creation:', error);
    
    return {
      data: null as any,
      error: {
        message: `Unexpected error in video creation: ${error instanceof Error ? error.message : 'Unknown error'}`,
        status_code: 500,
        error_code: 'VIDEO_CREATION_UNEXPECTED_ERROR'
      },
      timing: {
        start: Date.now(),
        end: Date.now(),
        duration: 0
      },
      connectionInfo: {
        success: false,
        server: '',
        status: 500,
        statusText: 'Internal Server Error'
      }
    };
  }
}

/**
 * Retrieves the current status of a video creation task
 * 
 * @param {string} taskId - ID of the video creation task to check
 * @returns {Promise<ApiResponse<VideoStatusResponse>>} Promise with current task status
 * 
 * @example
 * const status = await getVideoCreationStatus('task-123');
 * if (!status.error) {
 *   console.log('Current status:', status.data.status);
 *   console.log('Progress:', status.data.progress);
 * }
 */
export async function getVideoCreationStatus(taskId: string): Promise<ApiResponse<VideoStatusResponse>> {
  if (!taskId) {
    console.error('Video status check missing task ID');
    
    return {
      data: null as any,
      error: {
        message: 'Task ID is required',
        status_code: 400,
        error_code: 'MISSING_TASK_ID'
      },
      timing: {
        start: Date.now(),
        end: Date.now(),
        duration: 0
      },
      connectionInfo: {
        success: false,
        server: '',
        status: 400,
        statusText: 'Bad Request'
      }
    };
  }

  try {
    console.log(`Checking status for video creation task: ${taskId}`);
    return fetchAPI(`/video-creation/status/${taskId}`);
  } catch (error) {
    console.error(`Error checking video creation status for task ${taskId}:`, error);
    
    return {
      data: null as any,
      error: {
        message: `Error checking video creation status: ${error instanceof Error ? error.message : 'Unknown error'}`,
        status_code: 500,
        error_code: 'VIDEO_STATUS_ERROR'
      },
      timing: {
        start: Date.now(),
        end: Date.now(),
        duration: 0
      },
      connectionInfo: {
        success: false,
        server: '',
        status: 500,
        statusText: 'Internal Server Error'
      }
    };
  }
}

/**
 * Cancels an in-progress video creation task
 * 
 * @param {string} taskId - ID of the video creation task to cancel
 * @returns {Promise<ApiResponse<{success: boolean}>>} Promise with cancellation result
 * 
 * @example
 * const result = await cancelVideoCreation('task-123');
 * if (!result.error) {
 *   console.log('Video creation cancelled successfully');
 * }
 */
export async function cancelVideoCreation(taskId: string): Promise<ApiResponse<{success: boolean}>> {
  if (!taskId) {
    console.error('Video cancellation missing task ID');
    
    return {
      data: null as any,
      error: {
        message: 'Task ID is required',
        status_code: 400,
        error_code: 'MISSING_TASK_ID'
      },
      timing: {
        start: Date.now(),
        end: Date.now(),
        duration: 0
      },
      connectionInfo: {
        success: false,
        server: '',
        status: 400,
        statusText: 'Bad Request'
      }
    };
  }

  try {
    console.log(`Cancelling video creation task: ${taskId}`);
    
    return fetchAPI(`/video-creation/cancel/${taskId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      }
    });
  } catch (error) {
    console.error(`Error cancelling video task ${taskId}:`, error);
    
    return {
      data: null as any,
      error: {
        message: `Error cancelling video: ${error instanceof Error ? error.message : 'Unknown error'}`,
        status_code: 500,
        error_code: 'VIDEO_CANCELLATION_ERROR'
      },
      timing: {
        start: Date.now(),
        end: Date.now(),
        duration: 0
      },
      connectionInfo: {
        success: false,
        server: '',
        status: 500,
        statusText: 'Internal Server Error'
      }
    };
  }
} 