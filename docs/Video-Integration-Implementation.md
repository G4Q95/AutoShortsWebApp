# Video Integration Implementation Plan

## Overview

This document outlines the technical implementation for the video preview playback feature in the Auto Shorts Web App. This feature will enable users to:

1. Play individual scenes with synchronized audio
2. View a sequential playback of all scenes in a project
3. Trim the beginning and end of media content
4. Configure default durations based on content type (photos vs videos)

## Current Architecture Analysis

### Media Content Flow

Currently, the application:
1. Extracts content from Reddit URLs via `content_retrieval.py`
2. Displays media content by streaming it directly from source URLs
3. Stores generated audio in Cloudflare R2 storage
4. Does not persist media content to R2 storage

### Storage Implementation

The application has a functioning R2 storage implementation in `app/services/storage.py` that:
- Uploads files to Cloudflare R2
- Generates presigned URLs for accessing content
- Provides fallback to mock storage for testing
- Is currently used only for audio content

### Audio Implementation

Audio is handled via:
1. Generation through ElevenLabs API
2. Persistence to R2 storage using the `/voice/persist` endpoint
3. Retrieval via `/voice/audio/{project_id}/{scene_id}`

## Implementation Strategy

### Phase 1: Media Content Persistence ✅ (Completed)

1. **Implement Media Download Service** ✅:
   - Create a new module `app/services/media_service.py` to handle media download and storage
   - Add functionality to download media content from source URLs
   - Support multiple media types (images, videos, galleries)
   - Implement proper error handling and retries

2. **Add Media Persistence Endpoint** ✅:
   - Create `/api/v1/media/store` endpoint that:
     - Accepts URL and metadata
     - Downloads media from source
     - Stores in R2 with proper naming conventions
     - Returns storage keys and URLs

3. **Update Storage Structure** ✅:
   - Implement organized directory structure in R2:
     ```
     bucket_name/
     ├── projects/
     │   └── {projectId}/
     │       ├── scenes/
     │       │   └── {sceneId}/
     │       │       ├── media.{ext}
     │       │       └── thumbnails/
     │       │           └── thumbnail.jpg
     │       └── audio/
     │           └── {sceneId}/
     │               └── voice.mp3
     ```

4. **Content Type Detection** ✅:
   - Implement robust media type detection
   - Create proper metadata storage for video dimensions, duration, etc.
   - Support common formats (jpg, png, mp4, webm)

### Phase 2: Media-Audio Pairing ✅ (Completed)

1. **Create Scene Metadata Model** ✅:
   - Implement `SceneMetadata` schema with:
     - Media information (type, duration, dimensions)
     - Audio information (duration, voice ID)
     - Trim settings (start time, end time)

2. **Update Project Model** ✅:
   - Extend project schema to include media storage information
   - Add fields to track processing status
   - Store media-audio pairing information

3. **Implement Content Processing Pipeline** ✅:
   - Create background task system for media processing
   - Add media extraction and analysis
   - Generate thumbnails for videos
   - Calculate default durations

### Phase 3: Scene Player Component

1. **Create Core Player Components**:
   - Implement `SceneMediaPlayer` component for media playback
   - Create `SceneAudioPlayer` component for audio playback
   - Build `SceneTrimControls` for trimming functionality

2. **Media Type Handling**:
   - Implement specialized rendering for different media types:
     - Images: static display with pan/zoom capabilities
     - Videos: HTML5 video player with controls
     - Galleries: carousel with navigation

3. **Synchronization Logic**:
   - Create controller to synchronize media and audio playback
   - Implement event-based communication between components
   - Handle different timing scenarios for photos vs videos

4. **Interactive Controls**:
   - Add play/pause buttons
   - Implement timeline scrubber
   - Create time display and duration indicators
   - Add volume controls that affect all playback

### Phase 4: Project Preview Player

1. **Implement Sequential Playback**:
   - Create playlist system for multiple scenes
   - Add automatic scene transitions
   - Implement progress tracking across scenes

2. **Create Trimming Interface**:
   - Design UI for trim handles on timeline
   - Implement drag controls for trim points
   - Create preview of trimmed output
   - Add reset and apply buttons

3. **Scene Duration Logic**:
   - For photos: default to audio duration
   - For videos: default to video duration or audio duration (whichever is longer)
   - Implement min/max duration constraints
   - Add visual indicators for recommended durations

## API Implementation

### New Endpoints

1. **Media Download and Storage**:
   ```
   POST /api/media/store
   Body: {
     "url": "https://example.com/image.jpg",
     "project_id": "123",
     "scene_id": "456",
     "media_type": "image"
   }
   Response: {
     "success": true,
     "url": "https://r2.url/projects/123/scenes/456/media.jpg",
     "storage_key": "projects/123/scenes/456/media.jpg",
     "metadata": {
       "width": 1280,
       "height": 720,
       "duration": null,
       "content_type": "image/jpeg"
     }
   }
   ```

2. **Scene Metadata**:
   ```
   GET /api/projects/{project_id}/scenes/{scene_id}/metadata
   Response: {
     "scene_id": "456",
     "media": {
       "type": "video",
       "url": "https://r2.url/projects/123/scenes/456/media.mp4",
       "duration": 15.5,
       "width": 1280,
       "height": 720
     },
     "audio": {
       "url": "https://r2.url/projects/123/audio/456/voice.mp3",
       "duration": 8.2,
       "voice_id": "voice_id"
     },
     "trim": {
       "start": 0,
       "end": 15.5
     }
   }
   ```

3. **Trim Settings**:
   ```
   PUT /api/projects/{project_id}/scenes/{scene_id}/trim
   Body: {
     "start": 1.5,
     "end": 10.0
   }
   Response: {
     "success": true,
     "trim": {
       "start": 1.5,
       "end": 10.0
     }
   }
   ```

4. **Project Preview**:
   ```
   GET /api/projects/{project_id}/preview
   Response: {
     "scenes": [
       {
         "scene_id": "456",
         "media_url": "https://r2.url/projects/123/scenes/456/media.mp4",
         "audio_url": "https://r2.url/projects/123/audio/456/voice.mp3",
         "duration": 10.0,
         "trim": { "start": 0, "end": 10.0 }
       },
       // More scenes...
     ],
     "total_duration": 45.5
   }
   ```

## Frontend Components

### Core Components

1. **ScenePreviewPlayer**:
   - Props:
     - `sceneId`: string
     - `projectId`: string
     - `mediaUrl`: string
     - `audioUrl`: string
     - `mediaType`: "image" | "video" | "gallery"
     - `trim`: { start: number, end: number }
     - `onTrimChange`: (start: number, end: number) => void
   - State:
     - `isPlaying`: boolean
     - `currentTime`: number
     - `duration`: number
     - `isMuted`: boolean
     - `volume`: number

2. **TrimControls**:
   - Props:
     - `duration`: number
     - `trimStart`: number
     - `trimEnd`: number
     - `onChange`: (start: number, end: number) => void
   - Features:
     - Draggable handles for trim points
     - Visual timeline with progress indicator
     - Start/end time display

3. **ProjectPreviewPlayer**:
   - Props:
     - `projectId`: string
     - `scenes`: Array<ScenePreviewData>
   - State:
     - `currentSceneIndex`: number
     - `