/**
 * Project utility functions for processing videos
 */

/**
 * Process a video with customization options
 * @param projectId - The ID of the project to process
 * @returns Promise that resolves when processing is started
 */
export async function processVideoWithCustomization(projectId: string) {
  try {
    const response = await fetch(`/api/projects/${projectId}/process`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        mode: 'custom',
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to start video processing');
    }

    return await response.json();
  } catch (error) {
    console.error('Error starting video processing:', error);
    throw error;
  }
}

/**
 * Process a video with fast automated options
 * @param projectId - The ID of the project to process
 * @returns Promise that resolves when processing is started
 */
export async function processVideoFast(projectId: string) {
  try {
    const response = await fetch(`/api/projects/${projectId}/process`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        mode: 'fast',
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to start fast video processing');
    }

    return await response.json();
  } catch (error) {
    console.error('Error starting fast video processing:', error);
    throw error;
  }
}

/**
 * Get the current processing status of a project
 * @param projectId - The ID of the project to check
 * @returns Promise that resolves with the current status
 */
export async function getProcessingStatus(projectId: string) {
  try {
    const response = await fetch(`/api/projects/${projectId}/status`);

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to check processing status');
    }

    return await response.json();
  } catch (error) {
    console.error('Error checking processing status:', error);
    throw error;
  }
}

/**
 * Cancel an ongoing video processing job
 * @param projectId - The ID of the project to cancel
 * @returns Promise that resolves when cancellation is successful
 */
export async function cancelProcessing(projectId: string) {
  try {
    const response = await fetch(`/api/projects/${projectId}/cancel`, {
      method: 'POST',
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to cancel processing');
    }

    return await response.json();
  } catch (error) {
    console.error('Error canceling processing:', error);
    throw error;
  }
}

/**
 * Get preview data for a URL
 * @param url - The URL to get a preview for
 * @returns Promise that resolves with the preview data
 */
export async function getUrlPreview(url: string) {
  try {
    // Validate URL format before sending to API
    new URL(url); // This will throw if URL is invalid

    console.log(`Fetching preview for URL: ${url}`);
    const response = await fetch(`/api/preview?url=${encodeURIComponent(url)}`);

    if (!response.ok) {
      const errorText = await response.text();
      let errorMsg = 'Failed to fetch preview';

      try {
        // Try to parse error as JSON
        const errorData = JSON.parse(errorText);
        errorMsg = errorData.detail || errorData.message || errorMsg;
      } catch (e) {
        // If not JSON, use text as is
        if (errorText) errorMsg = errorText;
      }

      throw new Error(errorMsg);
    }

    const data = await response.json();
    console.log('Preview data received:', data);
    return data;
  } catch (error) {
    console.error('Error fetching URL preview:', error);
    if (error instanceof TypeError && error.message.includes('URL')) {
      throw new Error('Invalid URL format. Please enter a valid URL.');
    }
    throw error;
  }
}
