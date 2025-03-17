# API Function Inventory

This document lists all functions in `api-client.ts` with a particular focus on voice-related functionality that requires refactoring.

## Core API Functions

### `fetchAPI<T>`
- **Purpose**: Base HTTP request function with error handling and timeouts
- **Parameters**: 
  - `endpoint: string` - The API endpoint to call
  - `options: RequestInit = {}` - Fetch options (method, headers, body, etc.)
  - `timeoutMs: number = DEFAULT_TIMEOUT_MS` - Request timeout in milliseconds
- **Returns**: `Promise<ApiResponse<T>>` - Standardized API response
- **Used By**: All other API functions
- **Test Coverage**: Indirect (tested via other functions)
- **Notes**: Core building block for all API requests

### `checkApiHealth`
- **Purpose**: Checks if the API server is available
- **Parameters**: None
- **Returns**: `Promise<ApiResponse<{ status: string }>>` - API health status
- **Used By**: Unknown (needs investigation)
- **Test Coverage**: Unknown (needs investigation)

### `extractContent`
- **Purpose**: Extracts content from a URL (usually Reddit)
- **Parameters**: `url: string` - URL to extract content from
- **Returns**: `Promise<ApiResponse<any>>` - Extracted content data
- **Used By**: 
  - ProjectProvider.tsx (direct import)
  - api-test/page.tsx (direct import)
- **Test Coverage**: E2E tests for content extraction

## Voice-Related Functions

### `getAvailableVoices`
- **Purpose**: Retrieves list of available TTS voices
- **Parameters**: None
- **Returns**: `Promise<ApiResponse<VoiceListResponse>>` - List of available voices
- **Used By**: 
  - SceneComponent.tsx
  - voice-test/page.tsx
- **Test Coverage**: 
  - E2E tests in `audio-generation.spec.ts`
  - Component tests indirectly via scene operations
- **Dependencies**: `fetchAPI`
- **Endpoint**: `/voice/voices`

### `getVoiceById`
- **Purpose**: Retrieves details of a specific voice
- **Parameters**: `voiceId: string` - ID of the voice to retrieve
- **Returns**: `Promise<ApiResponse<Voice>>` - Voice details
- **Used By**: No direct imports found (may be used via variable reference)
- **Test Coverage**: Unknown (needs verification)
- **Dependencies**: `fetchAPI`
- **Endpoint**: `/voice/voices/${voiceId}`

### `generateVoice`
- **Purpose**: Generates audio from text using ElevenLabs API
- **Parameters**: 
  - `requestData: GenerateVoiceRequest` - Request data including text and voice settings
- **Returns**: `Promise<ApiResponse<GenerateVoiceResponse>>` - Generated audio as base64
- **Used By**:
  - SceneComponent.tsx
  - voice-test/page.tsx
  - Used internally by `generateVoiceAudio` and `downloadVoiceAudio`
- **Test Coverage**: 
  - E2E tests in `audio-generation.spec.ts`
  - Mock implementation in tests via `setupMockAudio`
- **Dependencies**: `fetchAPI`
- **Endpoint**: `/voice/generate`
- **Complexity**: High (contains mock audio logic for testing)

### `generateVoiceAudio`
- **Purpose**: Generates audio and creates an Audio element for playback
- **Parameters**: 
  - `request: GenerateVoiceRequest` - Voice generation request data
- **Returns**: `Promise<{audio: HTMLAudioElement | null, error: ApiError | null, characterCount: number, processingTime: number}>` - Audio element with generated audio
- **Used By**: No direct imports found (may be used via variable reference)
- **Test Coverage**: Indirectly via `generateVoice` tests
- **Dependencies**: `generateVoice`
- **Notes**: Helper function that wraps `generateVoice` and creates an Audio element

### `downloadVoiceAudio`
- **Purpose**: Downloads generated audio as a file
- **Parameters**: 
  - `text: string` - Text to convert to speech
  - `voiceId: string` - ID of the voice to use
  - `filename: string = 'voice-audio.mp3'` - Filename for downloaded file
  - `settings?: Partial<VoiceSettings>` - Voice settings
- **Returns**: `Promise<{success: boolean, error: ApiError | null}>` - Download status
- **Used By**: No direct imports found (may be used via variable reference)
- **Test Coverage**: Unknown (needs verification)
- **Dependencies**: `generateVoice`
- **Notes**: Helper function that wraps `generateVoice` and creates a download link

### `persistVoiceAudio`
- **Purpose**: Saves voice audio to persistent storage (R2)
- **Parameters**: 
  - `requestData: SaveAudioRequest` - Audio data to persist
- **Returns**: `Promise<ApiResponse<SaveAudioResponse>>` - Storage result
- **Used By**: SceneComponent.tsx
- **Test Coverage**: Indirectly via E2E tests
- **Dependencies**: `fetchAPI`
- **Endpoint**: `/voice/persist`

### `getStoredAudio`
- **Purpose**: Retrieves stored audio from R2 by project ID and scene ID
- **Parameters**: 
  - `projectId: string` - Project ID
  - `sceneId: string` - Scene ID
- **Returns**: `Promise<ApiResponse<GetAudioResponse>>` - Stored audio info
- **Used By**: SceneComponent.tsx
- **Test Coverage**: Indirectly via E2E tests
- **Dependencies**: `fetchAPI`
- **Endpoint**: `/voice/audio/${projectId}/${sceneId}`

## Usage Patterns

### Voice Generation Flow
1. Get available voices via `getAvailableVoices()`
2. User selects a voice
3. Generate voice via `generateVoice()` with text and selected voice
4. Create audio element for playback
5. Optionally persist audio via `persistVoiceAudio()`

### Component Dependencies
- **SceneComponent.tsx**: Uses most voice-related functions
  - `getAvailableVoices` - To populate voice selection dropdown
  - `generateVoice` - To generate voice audio for scene text
  - `persistVoiceAudio` - To save generated audio
  - `getStoredAudio` - To retrieve previously generated audio

- **voice-test/page.tsx**: Testing page for voice generation
  - `getAvailableVoices` - To list available voices
  - `generateVoice` - To test voice generation

## Test Coverage Assessment

### Well-Tested Functions
- `generateVoice`: Extensively tested in E2E tests with mock implementation
- `getAvailableVoices`: Tested in audio generation tests

### Functions Needing More Test Coverage
- `getVoiceById`: No direct tests found
- `downloadVoiceAudio`: No direct tests found
- `persistVoiceAudio`: Only indirectly tested
- `getStoredAudio`: Only indirectly tested

## Refactoring Strategy

1. Create new domain-specific file (`api/voice.ts`) for voice-related functions
2. Implement feature flags for each function
3. Start with low-risk functions: `getAvailableVoices` and `getVoiceById`
4. Add more tests for less-tested functions
5. Migrate core function `generateVoice` with careful testing
6. Migrate helper functions that depend on `generateVoice` 