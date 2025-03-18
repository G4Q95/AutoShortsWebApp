# Video Integration - Part 1: Preview Playback

## Overview

This document outlines the first phase of the video processing pipeline implementation, focusing on the preview playback functionality. This feature will allow users to preview scenes individually or all scenes sequentially, with proper synchronization between media (images/videos) and generated voiceovers.

## Current Status

- ✅ Voice generation is fully functional with ElevenLabs integration
- ✅ Audio files are being stored in Cloudflare R2
- ✅ Scene management with drag-and-drop reordering is complete
- ✅ ScenePreviewPlayer component implemented
- ✅ TrimControls component implemented
- ✅ Playwright testing configuration updated for headless mode
- ✅ Media files (Reddit content) are now properly stored in Cloudflare R2
- 🔄 Video processing pipeline is partially implemented (40%)

## Implementation Goals

1. **Media Storage**
   - Download and store Reddit media content in Cloudflare R2
   - Implement proper pairing between media files and generated audio
   - Create organized storage structure in R2

2. **Preview Playback**
   - Create individual scene previews with synchronized audio
   - Implement sequential playback of all scenes
   - Add basic play/pause controls

3. **Media Trimming**
   - Add ability to trim the beginning and end of media
   - Set appropriate default durations:
     - Photos: Length of the generated voiceover
     - Videos: Original video length with voiceover at the beginning

## Technical Approach

### Phase 1: Media Storage Implementation

1. **R2 Storage Integration** ✅
   - Create dedicated media storage service for R2
   - Implement upload functionality for Reddit media
   - Generate unique identifiers for each media file
   - Set up proper error handling and retry mechanisms

2. **Media-Audio Pairing** ✅
   - Create data structure linking media and audio files
   - Store pairing information in MongoDB
   - Implement metadata tracking for content types and durations

### Phase 2: Basic Preview Player

1. **Scene Player Component** ✅
   - Create `ScenePreviewPlayer` component for individual scenes
   - Implement HTML5 video/audio elements with controls
   - Add proper handling for different media types (images vs videos)
   - Synchronize media playback with audio

2. **Project Player Component**
   - Create `ProjectPreviewPlayer` for sequential playback
   - Implement scene transition logic
   - Add playlist functionality for all scenes
   - Create playback controls (play, pause, next, previous)

### Phase 3: Trimming Controls

1. **Trimming UI** ✅
   - Create scrubbing interface with customizable brackets
   - Implement visual indicators for trim points
   - Add duration display and timing controls

2. **Duration Logic**
   - Implement logic for default durations based on content type
   - Create separate handling for images and videos
   - Store and retrieve trim settings from project data

## Testing Plan

To ensure the quality and reliability of the video integration features, we have established a comprehensive testing plan:

### Test Execution Environment

- All tests run in headless mode by default
- Debug mode only used with explicit `--debug` flag
- Video recordings enabled for failed tests
- Automatic screenshots on failures

### Media Storage Testing

- Monitor network requests for media uploads
- Verify successful storage in R2
- Check response status codes and payloads
- Validate media metadata and storage keys

### Preview Playback Testing

- Test media synchronization
- Verify trim controls functionality
- Check loading states and error handling
- Test different media types (image, video, gallery)

### Test Command Reference

```bash
# Run all tests in headless mode
npm test

# Run tests with debug mode (manual intervention)
npm run test:debug

# Run tests with mock audio
NEXT_PUBLIC_MOCK_AUDIO=true npm test

# Run tests with real API calls
NEXT_PUBLIC_MOCK_AUDIO=false npm test
```

## FFMPEG Integration

For the backend video processing, we'll use FFMPEG:

1. **Basic Implementation**
   - Set up FFMPEG in Docker container for development
   - Create basic command wrappers for common operations
   - Test with sample media for processing capability

2. **Video Processing Service**
   - Create backend endpoints for video operations
   - Implement progress tracking and status updates
   - Configure proper error handling and logging

## Alternative Considerations

### BBC VideoContext Option

As noted in the project documentation, BBC's VideoContext library provides an alternative implementation approach:

- **Potential Benefits**:
  - Professional-grade compositing with WebGL acceleration
  - Real-time preview of effects and transitions
  - Pre-built timeline functionality
  - Open-source with no licensing costs

- **Implementation Requirements**:
  - React wrapper components for VideoContext
  - Custom timeline UI mapped to VideoContext nodes
  - Backend integration to convert timeline data to FFmpeg commands

### Decision Factors

For the initial implementation (Part 1), we'll proceed with the direct FFMPEG approach for simplicity, but will:
- Prototype minimal BBC VideoContext implementation to evaluate potential benefits
- Compare performance and development effort between approaches
- Make final architecture decision based on prototype results

## Implementation Sequence

1. **Media Storage (Week 1)**
   - R2 storage service integration
   - Media download implementation
   - Proper error handling and metadata

2. **Basic Player (Week 2)** ✅
   - Individual scene preview functionality
   - Basic playback controls
   - Media type-specific handling

3. **Sequential Playback (Week 3)**
   - Multi-scene playback
   - Transition handling
   - Player controls and timeline

4. **Trimming Interface (Week 4)** ✅
   - Trim controls implementation
   - Duration logic
   - Settings persistence

## API Requirements

New backend endpoints needed:

1. **Media Storage**
   - `POST /api/media/store` - Store media file in R2
   - `GET /api/media/{mediaId}` - Retrieve media file
   - `DELETE /api/media/{mediaId}` - Remove media file

2. **Project Preview**
   - `POST /api/projects/{projectId}/preview` - Generate preview data
   - `GET /api/projects/{projectId}/scenes/{sceneId}/preview` - Get scene preview

3. **Trim Settings**
   - `POST /api/projects/{projectId}/scenes/{sceneId}/trim` - Update trim settings
   - `GET /api/projects/{projectId}/scenes/{sceneId}/trim` - Get trim settings

## Frontend Components

New components needed:

1. **Player Components**
   - `ScenePreviewPlayer` - Individual scene playback ✅
   - `ProjectPreviewPlayer` - Full project playback
   - `MediaControls` - Reusable playback controls ✅
   - `TrimControls` - Interface for adjusting timing ✅

2. **UI Enhancements**
   - Scene duration indicators
   - Progress bar for playback
   - Timeline view for project
   - Visual trim indicators

## Next Steps

1. **Verify R2 Storage Integration**
   - Add logging for R2 operations
   - Monitor network requests
   - Implement proper error handling
   - Add retry mechanisms for transient failures

2. **Complete Preview Integration**
   - Add ScenePreviewPlayer to Scene component
   - Test media synchronization
   - Add loading states
   - Add error handling for media failures

3. **Enhance Testing**
   - Add media storage tests
   - Add preview playback tests
   - Implement proper mocking
   - Create comprehensive test coverage

4. **Apply FFMPEG Integration**
   - Set up FFMPEG in development container
   - Create basic command wrappers
   - Test with sample media
   - Implement progress tracking 

## Detailed Implementation Plan

### Step 1: Assess Existing Components (1-2 days)
- Examine the ScenePreviewPlayer component code
- Review the TrimControls implementation
- Identify connection points between media and audio components
- Evaluate existing FFmpeg scripts for media processing

### Step 2: Scene Player Integration (2-3 days)
- Replace black square media display with ScenePreviewPlayer in Scene card
- Connect player to R2-stored media files
- Implement audio-video synchronization logic
- Add play/pause controls for combined media and audio
- Handle different media types (images vs videos)

### Step 3: Timeline & Trimming (2-3 days)
- Implement timeline scrubber UI
- Add visual position indicators for voiceover relative to video
- Connect TrimControls to Scene player
- Implement trim point visualization
- Create backend endpoints to persist trim settings
- Store trim data in project metadata

### Step 4: Scene Duration Logic (1-2 days)
- Implement default duration logic:
  - Images: match audio duration
  - Videos: respect trim points
- Add visual indicators for recommended durations
- Create UI for adjusting durations

### Step 5: Sequential Playback (2-3 days)
- Develop ProjectPreviewPlayer component
- Implement scene transition logic
- Create playlist functionality for all scenes
- Add overall project controls (play all, pause, next, previous)
- Build progress tracking across multiple scenes

### Step 6: FFmpeg Integration (3-4 days)
- Set up backend endpoints for FFmpeg operations
- Implement media + audio merging functionality
- Create progress tracking for processing
- Add error handling for media operations
- Implement background processing for video generation

### Step 7: Testing & Refinement (1-2 days)
- Develop comprehensive tests for media playback
- Test trimming functionality across media types
- Verify audio synchronization
- Test sequential playback
- Ensure trim settings persist correctly 