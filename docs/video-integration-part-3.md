# Video Integration - Part 3: Consistent Aspect Ratio Handling

## Problem Statement

Currently, the application has issues maintaining consistent aspect ratios for videos when switching between thumbnail view and playback mode. Videos, especially any none 9:16 ratio videos, get stretched or distorted when they're displayed in different contexts. Users need to be able to set a consistent project-wide aspect ratio that all scenes will adhere to, regardless of the original media aspect ratio.

## Screenshots of Current Issues

1. **Thumbnail vs Playback Mismatch** - The thumbnail shows content in one aspect ratio, but when played, the video gets letterboxed or stretched differently
2. **Square Video Distortion** - Square videos (1:1) get stretched into rectangles during playback
3. **Inconsistent Sizing** - Videos resize inconsistently between thumbnail view and full playback

## Proposed Solution

### 1. Project-Level Aspect Ratio Setting

- Add a project configuration setting where users can select the desired output aspect ratio
- Common presets will include:
  - 9:16 (Vertical/Stories/TikTok)
  - 16:9 (Landscape/YouTube)
  - 1:1 (Square/Instagram)
  - 4:5 (Instagram portrait)
- This setting will be stored in project metadata and apply to all scenes
- Allow users to change this setting after project creation, with a warning about potential cropping

### 2. Consistent Container Approach

- Create fixed-ratio containers for all video elements based on the project setting
- Use modern CSS `aspect-ratio` property to maintain consistent container shapes
- Apply consistent letterboxing/pillarboxing within these containers
- Ensure the same container proportions are used in:
  - Scene thumbnails
  - Scene preview player
  - Final video export

### 3. Proper Media Rendering

- Use `object-fit: contain` to ensure videos maintain their original aspect ratio
- Center all media content within the fixed containers
- Add letterbox/pillarbox bars automatically as needed
- Ensure transitions between thumbnail and video playback are smooth and maintain aspect ratio

### 4. VideoContext Implementation

For the VideoContext implementation specifically:

- Modify canvas initialization to respect the project's aspect ratio setting
- Handle WebGL viewport configuration to ensure content renders at the correct dimensions
- Separate the styling of the player container from the actual media content
- Ensure both first-frame preview and canvas playback maintain identical positioning

## Technical Implementation

### VideoContextScenePreviewPlayer Modifications

1. **Project Aspect Ratio Integration**:
   ```typescript
   interface VideoContextScenePreviewPlayerProps {
     // existing props
     projectAspectRatio?: '9:16' | '16:9' | '1:1' | '4:5';
   }
   ```

2. **Container CSS Approach**:
   ```tsx
   const getContainerAspectRatio = () => {
     switch (projectAspectRatio) {
       case '16:9': return '16/9';
       case '9:16': return '9/16';
       case '1:1': return '1/1';
       case '4:5': return '4/5';
       default: return '16/9'; // default fallback
     }
   };
   
   // Container style with fixed aspect ratio
   const containerStyle = {
     aspectRatio: getContainerAspectRatio(),
     width: isCompactView ? '110px' : '100%',
     height: 'auto',
     position: 'relative',
     overflow: 'hidden',
     backgroundColor: '#000',
   };
   ```

3. **Media Content Style**:
   ```tsx
   // Media style that ensures content is contained without stretching
   const mediaStyle = {
     position: 'absolute',
     width: '100%',
     height: '100%',
     objectFit: 'contain',
   };
   ```

4. **Canvas Initialization**:
   ```typescript
   // Set canvas dimensions based on project aspect ratio
   const setCanvasDimensions = (canvas: HTMLCanvasElement) => {
     const aspectRatio = projectAspectRatio.split(':').map(Number);
     const ratio = aspectRatio[0] / aspectRatio[1];
     
     if (ratio > 1) {
       // Wider than tall (landscape)
       canvas.width = 1920;
       canvas.height = 1920 / ratio;
     } else {
       // Taller than wide (portrait or square)
       canvas.height = 1920;
       canvas.width = 1920 * ratio;
     }
     
     console.log(`Canvas dimensions set to ${canvas.width}x${canvas.height} for aspect ratio ${projectAspectRatio}`);
   };
   ```

### Project Settings UI

1. Add an aspect ratio selector to the project creation form
2. Create a project settings modal that includes aspect ratio selection
3. Provide visual previews of each aspect ratio option
4. Warn users about potential cropping when changing aspect ratios for existing projects

### Database Schema Updates

```typescript
interface Project {
  // existing fields
  aspectRatio: '9:16' | '16:9' | '1:1' | '4:5';
}
```

## Implementation Priority

1. Update project schema to include aspect ratio setting
2. Modify VideoContextScenePreviewPlayer to read and respect project aspect ratio
3. Create UI for selecting aspect ratio in project settings
4. Ensure consistent rendering across all views (thumbnail, preview, export)
5. Add visual indicators for letterboxing/pillarboxing

## Expected Outcome

- Users can select their desired aspect ratio at the project level
- All scenes maintain consistent aspect ratio throughout the application
- Videos don't stretch or distort regardless of their original dimensions
- Letterboxing/pillarboxing is applied consistently and aesthetically
- Smooth transitions between thumbnail and playback views 