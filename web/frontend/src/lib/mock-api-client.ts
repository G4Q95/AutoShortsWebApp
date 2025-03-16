/**
 * Mock API client for testing
 * Returns pre-recorded audio files instead of calling ElevenLabs API
 */

import { ApiResponse, GenerateVoiceRequest, GenerateVoiceResponse } from './api-types';

// Pre-recorded audio file paths (these files should be created and stored in public/mocks)
const MOCK_AUDIO_FILES = {
  // Base64 encoded prerecorded MP3 files - we'll create these later
  photo: '/mocks/photo-scene-audio.txt', // Will contain base64 encoded MP3
  video: '/mocks/video-scene-audio.txt', // Will contain base64 encoded MP3
  default: '/mocks/default-audio.txt'
};

/**
 * Mock implementation of generateVoice
 * Returns pre-recorded audio instead of calling the ElevenLabs API
 */
export async function mockGenerateVoice(
  requestData: GenerateVoiceRequest
): Promise<ApiResponse<GenerateVoiceResponse>> {
  console.log('MOCK API: Generating voice with mock data', requestData);
  
  // Add a realistic delay to simulate API call
  await new Promise(resolve => setTimeout(resolve, 1500));
  
  try {
    // Determine which mock audio file to use based on the text content
    let audioFile = MOCK_AUDIO_FILES.default;
    const text = requestData.text.toLowerCase();
    
    if (text.includes('slug') || text.includes('wall') || text.includes('triangle')) {
      audioFile = MOCK_AUDIO_FILES.photo; // Text from photo test content
    } else if (text.includes('sand') || text.includes('water') || text.includes('desert')) {
      audioFile = MOCK_AUDIO_FILES.video; // Text from video test content
    }
    
    // Fetch the pre-recorded base64 audio data
    const response = await fetch(audioFile);
    if (!response.ok) {
      throw new Error(`Failed to load mock audio file: ${audioFile}`);
    }
    
    const audio_base64 = await response.text();
    
    // Return a successful response with the mock audio data
    return {
      success: true,
      data: {
        audio_base64,
        content_type: 'audio/mpeg',
        character_count: requestData.text.length,
        processing_time: 0.75, // Mock processing time
        voice_id: requestData.voice_id || 'mock-voice',
      },
      status_code: 200,
    };
  } catch (error) {
    console.error('Error in mock generateVoice:', error);
    
    // Return a standardized error response
    return {
      success: false,
      error: {
        status_code: 500,
        message: `Mock API error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error_code: 'mock_api_error'
      },
      status_code: 500,
    };
  }
} 