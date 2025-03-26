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
- Initial implementation will focus on these four most common aspect ratios:
  - **9:16** (Vertical/TikTok/Instagram Stories/Reels)
  - **16:9** (Landscape/YouTube/Standard widescreen)
  - **1:1** (Square/Instagram traditional)
  - **4:5** (Instagram portrait)
- Design the system to handle any aspect ratio, making it easy to add more options in the future
- This setting will be stored in project metadata and apply to all scenes
- Allow users to change this setting after project creation, with a warning about potential cropping

### 2. UI Implementation

- **In-Project Placement**: 
  - Place the aspect ratio selector on the project page, next to the project title (between the project title and the Save button)
  - Implement as a dropdown menu showing both the current ratio and a visual representation of its shape
  - Make it easily accessible within the project workspace, not during initial project creation
- **Real-Time Updates**:
  - When a user changes the aspect ratio, all scene cards should update immediately to show the new ratio
  - Show letterboxing/pillarboxing applied in real-time across all scenes
  - Provide visual feedback as the ratio changes to help users visualize the final output
- **Visual Selector**: Similar to CapCut's implementation, show a visual representation of each ratio
- **Display Format**: Show both the numerical ratio (e.g., "9:16") and a common name/use case (e.g., "TikTok")
- **Clearly indicate the currently selected aspect ratio**

### 3. Letterboxing/Pillarboxing Implementation

- The key functionality is to preserve original media proportions without stretching/distorting
- For videos that don't match the project aspect ratio:
  - Add black bars above/below (letterboxing) for content too wide for container
  - Add black bars on sides (pillarboxing) for content too tall for container
- Never stretch or distort the original content - maintain its original aspect ratio
- Apply this consistently across thumbnails, preview, and final export

### 4. Consistent Container Approach

- Create fixed-ratio containers for all video elements based on the project setting
- Use modern CSS `aspect-ratio` property to maintain consistent container shapes
- Apply consistent letterboxing/pillarboxing within these containers
- Ensure the same container proportions are used in:
  - Scene thumbnails
  - Scene preview player
  - Final video export

### 5. Future Enhancements (Post Initial Implementation)

- Add ability to reposition/zoom content within the frame for better framing
- Add more aspect ratio options (4:3, 2:1, 3:4, 5:4, etc.)
- Add custom aspect ratio input
- Visual indicators showing how content will be letterboxed/pillarboxed

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

1. Implement aspect ratio selector in the active project view, not in the initial project creation flow
2. Position the selector between the project title and Save button for easy access
3. Provide visual previews of each aspect ratio option similar to CapCut's implementation
4. Display a warning when changing aspect ratios on projects with existing content

### Database Schema Updates

```typescript
interface Project {
  // existing fields
  aspectRatio: '9:16' | '16:9' | '1:1' | '4:5';
}
```

## Implementation Priority

1. Update project schema to include aspect ratio setting
2. Create UI component for the aspect ratio selector in the project header
3. Modify VideoContextScenePreviewPlayer to read and respect project aspect ratio
4. Implement real-time updating of all scene thumbnails when aspect ratio changes
5. Add visual indicators for letterboxing/pillarboxing

## Expected Outcome

- Users can select and change their desired aspect ratio directly within the project
- All scenes maintain consistent aspect ratio throughout the application
- Videos don't stretch or distort regardless of their original dimensions
- Letterboxing/pillarboxing is applied consistently and aesthetically
- Scene thumbnails update in real-time when the aspect ratio is changed
- Smooth transitions between thumbnail and video playback views 

## Aspect Ratio Troubleshooting

### Initial Investigation
We initially attempted to control aspect ratio by setting fixed canvas dimensions and using VideoContext's source node scaling:

```typescript
// Initial attempt - proved ineffective
canvas.width = 1920; 
canvas.height = 1080;
source.scale(scaleX, scaleY);     // These methods don't persist
source.position(x, y, 0);         // These methods don't persist
```

### Key Findings
1. **VideoContext Limitations**:
   - VideoContext doesn't have native support for `object-fit: contain` equivalent
   - The `scale()` and `position()` methods on source nodes don't persist during playback
   - Scaling values become `undefined` during video playback
   - This is a known limitation (see [VideoContext Issue #56](https://github.com/bbc/VideoContext/issues/56))

2. **Current Behavior**:
   - Thumbnail view maintains aspect ratio using CSS `object-fit: contain`
   - During playback, VideoContext stretches content to fill canvas
   - No built-in method to maintain aspect ratio in VideoContext

### Potential Solutions

1. **Custom WebGL Shader Approach** (Most Promising):
   - Create a custom shader in VideoContext
   - Handle aspect ratio preservation in the WebGL rendering pipeline
   - Maintain proper scaling and positioning through shader uniforms
   - Benefits:
     - Works at the rendering level
     - Consistent across all playback states

## Implementation Status

### ✅ Successfully Implemented (March 2024)

The aspect ratio handling issues have been successfully resolved. The application now properly maintains each media's original aspect ratio while providing consistent output formatting.

### Key Accomplishments:

1. **Root Cause Identified and Fixed**:
   - Discovered that aspect ratio information was being lost during the component chain handoff
   - Fixed by ensuring proper aspect ratio detection during media upload
   - Added persistence of aspect ratio data throughout the component hierarchy

2. **Enhanced Logging System**:
   - Implemented extensive logging across multiple components:
     - `SceneComponent` - For media upload and analysis
     - `SceneVideoPlayerWrapper` - For passing aspect ratio data
     - `SceneMediaPlayer` - For component props
     - `VideoContextScenePreviewPlayer` - For canvas sizing and media rendering
   - Log points capture aspect ratio values at each stage of processing
   - Warnings for potential aspect ratio mismatches

3. **VideoContext Player Improvements**:
   - Canvas now properly sizes based on original media aspect ratio
   - Container styling with dynamic letterboxing/pillarboxing
   - Source nodes correctly configured with appropriate dimensions
   - Corrected positioning and scaling logic

4. **Testing Scenarios Validated**:
   - Vertical videos (9:16) now display correctly without stretching
   - Horizontal videos (16:9) display with proper letterboxing
   - Mixed aspect ratios in the same project maintain individual proportions
   - Consistent rendering between thumbnails and full preview

This implementation ensures that videos now display in their natural aspect ratios with proper letterboxing/pillarboxing, eliminating stretching or distortion issues previously observed. Users can confidently work with media of varying dimensions while maintaining visual quality.

The solution focused on careful preservation of aspect ratio metadata throughout the system rather than complex shader approaches, proving that proper data management was the key to resolving the issues.

### Next Steps
1. Implement custom WebGL shader solution:
   - Research VideoContext shader implementation
   - Create aspect-ratio-preserving fragment shader
   - Add shader uniforms for aspect ratio control
   - Test with various video dimensions

2. Fallback considerations:
   - Implement container-based solution as temporary measure
   - Document limitations for future reference
   - Plan for proper shader-based implementation

### Implementation Notes
- Keep canvas dimensions consistent (1920x1080)
- Calculate aspect ratios early in video loading
- Apply letterboxing/pillarboxing through shaders
- Maintain separate thumbnail and playback solutions until shader implementation is complete

### Testing Strategy
1. Test with multiple aspect ratios:
   - Vertical (9:16)
   - Horizontal (16:9)
   - Square (1:1)
   - Non-standard ratios

2. Verify consistent behavior:
   - During thumbnail display
   - During playback
   - During transitions
   - After seeking/trimming

3. Monitor performance:
   - Shader compilation time
   - Rendering performance
   - Memory usage
   - CPU/GPU utilization 