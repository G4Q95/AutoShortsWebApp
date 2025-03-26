# Adaptive Scene-Based Aspect Ratio Implementation Plan

This document outlines the implementation plan for adapting each scene to maintain its media's original aspect ratio while providing a consistent project-wide output format with letterboxing/pillarboxing.

## Overview

The core concept is to preserve each media's natural aspect ratio while giving users control over the final output format:

1. Each scene's canvas adapts to its media's native aspect ratio
2. Letterboxing/pillarboxing is applied based on the project-wide aspect ratio setting
3. Preview displays the same letterboxing/pillarboxing that will appear in the final export

## 1. Data Model Updates

### Scene Model Enhancement
```typescript
interface Scene {
  // existing fields
  mediaUrl: string;
  mediaType: 'video' | 'image';
  
  // New fields
  mediaAspectRatio: number;        // Numerical ratio (e.g., 1.78 for 16:9)
  mediaOriginalWidth: number;      // Original width in pixels
  mediaOriginalHeight: number;     // Original height in pixels
}
```

### Project Model Update
```typescript
interface Project {
  // existing fields
  aspectRatio: '9:16' | '16:9' | '1:1' | '4:5'; // Output aspect ratio
  showLetterboxing: boolean;       // Whether to show letterboxing in preview
}
```

## 2. Media Upload Process Changes

1. **Media Analysis on Upload**
   - When media is uploaded/added to a scene:
     ```typescript
     // After media upload completes
     const analyzeMedia = async (mediaUrl, sceneId) => {
       // For images
       if (isImage(mediaUrl)) {
         const img = new Image();
         img.onload = () => {
           const aspectRatio = img.width / img.height;
           updateSceneMetadata(sceneId, {
             mediaAspectRatio: aspectRatio,
             mediaOriginalWidth: img.width,
             mediaOriginalHeight: img.height
           });
         };
         img.src = mediaUrl;
       }
       
       // For videos
       if (isVideo(mediaUrl)) {
         const video = document.createElement('video');
         video.onloadedmetadata = () => {
           const aspectRatio = video.videoWidth / video.videoHeight;
           updateSceneMetadata(sceneId, {
             mediaAspectRatio: aspectRatio,
             mediaOriginalWidth: video.videoWidth,
             mediaOriginalHeight: video.videoHeight
           });
         };
         video.src = mediaUrl;
       }
     };
     ```

## 3. VideoContextScenePreviewPlayer Modifications

1. **Canvas Sizing Based on Media**
   ```typescript
   // In VideoContextScenePreviewPlayer.tsx
   
   // Add props for original media dimensions
   interface VideoContextScenePreviewPlayerProps {
     // existing props
     mediaAspectRatio: number;
     projectAspectRatio: string;
     showLetterboxing: boolean;
   }
   
   // Determine canvas size based on media aspect ratio
   const getCanvasDimensions = () => {
     // Base size for quality
     const baseSize = 1920;
     
     if (mediaAspectRatio >= 1) {
       // Landscape or square
       return {
         width: baseSize,
         height: baseSize / mediaAspectRatio
       };
     } else {
       // Portrait
       return {
         width: baseSize * mediaAspectRatio,
         height: baseSize
       };
     }
   };
   
   // Apply canvas dimensions
   useEffect(() => {
     if (!canvasRef.current) return;
     
     const { width, height } = getCanvasDimensions();
     canvasRef.current.width = width;
     canvasRef.current.height = height;
     
     console.log(`Canvas sized to ${width}x${height} for media with aspect ratio ${mediaAspectRatio}`);
   }, [canvasRef, mediaAspectRatio]);
   ```

2. **Container Styling with Letterboxing/Pillarboxing**
   ```typescript
   // Add containerRef to track the parent container
   const containerRef = useRef<HTMLDivElement>(null);
   
   // Calculate letterboxing/pillarboxing styles
   const getContainerStyle = () => {
     if (!showLetterboxing) {
       // Without letterboxing, just center the content
       return {
         position: 'relative',
         display: 'flex',
         justifyContent: 'center',
         alignItems: 'center',
         width: '100%',
         height: '100%',
         backgroundColor: '#000'
       };
     }
     
     // Parse project aspect ratio
     const [projectWidth, projectHeight] = projectAspectRatio.split(':').map(Number);
     const projectRatio = projectWidth / projectHeight;
     
     // Compare with media aspect ratio
     const containerWidth = '100%';
     let containerHeight = '100%';
     
     if (mediaAspectRatio > projectRatio) {
       // Media is wider than project - add letterboxing
       // Calculate percentage height based on aspect ratios
       const heightPercentage = (projectRatio / mediaAspectRatio) * 100;
       containerHeight = `${heightPercentage}%`;
     } else if (mediaAspectRatio < projectRatio) {
       // Media is taller than project - add pillarboxing
       // Calculate percentage width based on aspect ratios
       const widthPercentage = (mediaAspectRatio / projectRatio) * 100;
       containerWidth = `${widthPercentage}%`;
     }
     
     return {
       position: 'relative',
       width: containerWidth,
       height: containerHeight,
       margin: '0 auto',
       display: 'flex',
       justifyContent: 'center',
       alignItems: 'center',
       backgroundColor: '#000',
       overflow: 'hidden'
     };
   };
   ```

## 4. Scene Thumbnails Component Update

1. **Adjust Thumbnail Rendering**
   ```typescript
   // In SceneThumbnail.tsx
   
   // Add props for aspect ratio
   interface SceneThumbnailProps {
     // existing props
     mediaAspectRatio: number;
     projectAspectRatio: string;
   }
   
   // Thumbnail container with letterboxing/pillarboxing
   const getThumbnailStyle = () => {
     // Similar logic to getContainerStyle above
     // Parse project aspect ratio
     const [projectWidth, projectHeight] = projectAspectRatio.split(':').map(Number);
     const projectRatio = projectWidth / projectHeight;
     
     // Container always maintains project aspect ratio
     const containerStyle = {
       position: 'relative',
       width: '100%',
       aspectRatio: projectAspectRatio.replace(':', '/'),
       display: 'flex',
       justifyContent: 'center',
       alignItems: 'center',
       backgroundColor: '#000',
       overflow: 'hidden'
     };
     
     // Media element style with letterboxing/pillarboxing
     const mediaStyle = {
       width: mediaAspectRatio > projectRatio ? '100%' : 'auto',
       height: mediaAspectRatio < projectRatio ? '100%' : 'auto',
       objectFit: 'contain'
     };
     
     return { containerStyle, mediaStyle };
   };
   ```

## 5. Project Aspect Ratio Selector Component

1. **Create UI Component**
   ```tsx
   // In AspectRatioSelector.tsx
   
   const AspectRatioSelector = ({ 
     currentRatio, 
     onChange,
     showLetterboxing,
     onToggleLetterboxing
   }) => {
     const ratioOptions = [
       { value: '9:16', label: 'Vertical (9:16)', icon: 'vertical-icon' },
       { value: '16:9', label: 'Landscape (16:9)', icon: 'landscape-icon' },
       { value: '1:1', label: 'Square (1:1)', icon: 'square-icon' },
       { value: '4:5', label: 'Instagram (4:5)', icon: 'instagram-icon' }
     ];
     
     return (
       <div className="aspect-ratio-selector">
         <div className="selector-label">Aspect Ratio</div>
         <div className="ratio-options">
           {ratioOptions.map(option => (
             <button 
               key={option.value}
               className={`ratio-option ${currentRatio === option.value ? 'selected' : ''}`}
               onClick={() => onChange(option.value)}
             >
               <div className={`ratio-icon ${option.icon}`} />
               <div className="ratio-label">{option.label}</div>
             </button>
           ))}
         </div>
         
         <div className="letterboxing-toggle">
           <label>
             <input 
               type="checkbox"
               checked={showLetterboxing}
               onChange={() => onToggleLetterboxing(!showLetterboxing)}
             />
             Show letterboxing/pillarboxing
           </label>
         </div>
       </div>
     );
   };
   ```

## 6. Export Process Integration

1. **FFmpeg Adaptation to Apply Letterboxing/Pillarboxing**
   ```typescript
   // In video-export-service.ts
   
   const applyAspectRatioToExport = (
     inputFile: string, 
     outputFile: string, 
     projectAspectRatio: string
   ) => {
     // Parse project aspect ratio
     const [projectWidth, projectHeight] = projectAspectRatio.split(':').map(Number);
     
     // Set output dimensions based on project ratio (maintain HD quality)
     let outputWidth, outputHeight;
     if (projectWidth > projectHeight) {
       // Landscape output
       outputWidth = 1920;
       outputHeight = Math.round(1920 * (projectHeight / projectWidth));
     } else {
       // Portrait or square output
       outputHeight = 1920;
       outputWidth = Math.round(1920 * (projectWidth / projectHeight));
     }
     
     // FFmpeg command to apply proper aspect ratio with letterboxing/pillarboxing
     return `ffmpeg -i ${inputFile} -vf "scale=${outputWidth}:${outputHeight}:force_original_aspect_ratio=decrease,pad=${outputWidth}:${outputHeight}:(ow-iw)/2:(oh-ih)/2:black" ${outputFile}`;
   };
   ```

## 7. Testing Strategy

1. **Test Media Types**
   - Vertical videos (e.g., 9:16)
   - Horizontal videos (e.g., 16:9)
   - Square videos (1:1)
   - Non-standard aspect ratios (e.g., 4:3, 2.39:1)
   - Images of various dimensions

2. **Test Preview Scenarios**
   - Verify preview with letterboxing/pillarboxing enabled
   - Verify preview with letterboxing/pillarboxing disabled
   - Check thumbnail rendering matches preview rendering
   - Test switching between project aspect ratios

3. **Test Export Results**
   - Verify exported video maintains proper aspect ratio
   - Check that letterboxing/pillarboxing is applied correctly
   - Verify video quality is maintained
   - Test all project aspect ratio options

## 8. Implementation Timeline

1. **Phase 1: Data Model & Analysis** (2-3 days)
   - Update scene and project models
   - Implement media analysis on upload
   - Add aspect ratio metadata to existing scenes

2. **Phase 2: Preview Player Updates** (3-4 days)
   - Modify canvas sizing logic
   - Implement letterboxing/pillarboxing container
   - Update scene thumbnails

3. **Phase 3: UI Component** (1-2 days)
   - Create aspect ratio selector
   - Implement letterboxing toggle
   - Add to project header

4. **Phase 4: Export Integration** (2-3 days)
   - Modify export process to respect aspect ratio
   - Implement FFmpeg commands for letterboxing/pillarboxing
   - Test export results

5. **Phase 5: Testing & Refinement** (2-3 days)
   - Test across all media types
   - Fix any rendering issues
   - Optimize performance

## Key Benefits

1. **Preserves Original Content Integrity**
   - Each media element maintains its native aspect ratio
   - No stretching or distortion of content

2. **Consistent Output Format**
   - Project-wide setting determines final output dimensions
   - Letterboxing/pillarboxing applied consistently

3. **WYSIWYG Preview**
   - Preview shows the exact letterboxing/pillarboxing that will appear in export
   - Users can visualize the final result before exporting

4. **Flexible Export Options**
   - Users can change project aspect ratio at any time
   - Output format can be adjusted without modifying individual scenes

## Conclusion

This implementation plan ensures that each scene maintains its original aspect ratio while allowing a consistent project-wide output format. The letterboxing/pillarboxing will be visible both in preview and in the final exported video, providing users with an accurate representation of the final result throughout the editing process. 

## Implementation Status

### ✅ Successfully Implemented (March 2024)

The adaptive aspect ratio support has been successfully implemented in the application. The system now:

1. **Media Analysis**: Properly analyzes uploaded media to detect its original aspect ratio.
   - Images and videos are analyzed on upload to calculate their aspect ratio
   - Metadata is stored with each scene for consistent display

2. **Correct Aspect Ratio Presentation**: Maintains consistent aspect ratios across:
   - Scene previews
   - Full-screen playback
   - Exported videos

3. **VideoContextScenePreviewPlayer Enhancements**:
   - Canvas is properly sized based on media's original aspect ratio
   - Letterboxing/pillarboxing is applied consistently based on project settings
   - Supports both vertical (9:16) and horizontal (16:9) media display
   - Provides proper rendering for both videos and images
   - Dynamic container style calculation with correct proportions

4. **Key Technical Improvements**:
   - Maintained aspect ratio data through the component chain
   - Added detailed logging throughout the media pipeline
   - Fixed aspect ratio detection and preservation during media uploads
   - Implemented automatic letterboxing/pillarboxing when aspect ratios don't match
   - Ensured alignment between preview display and final output

This implementation ensures users can now confidently mix media with different aspect ratios in the same project, knowing that each piece of content will be displayed appropriately without stretching or distortion. 

## Solution Implementation Details

The successful implementation of adaptive aspect ratio handling required several coordinated technical components working together. Here's how the solution was actually implemented:

### 1. Media Analysis Process

The core of the solution starts with analyzing each media file at upload time:

```typescript
// Media Analysis Utilities
const analyzeImageDimensions = (url: string): Promise<MediaAnalysisResult> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const width = img.naturalWidth;
      const height = img.naturalHeight;
      const aspectRatio = width / height;
      resolve({ width, height, aspectRatio });
    };
    img.onerror = () => reject(new Error('Failed to load image for analysis'));
    img.src = url;
  });
};

const analyzeVideoDimensions = (url: string): Promise<MediaAnalysisResult> => {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.onloadedmetadata = () => {
      const width = video.videoWidth;
      const height = video.videoHeight;
      const aspectRatio = width / height;
      resolve({ width, height, aspectRatio });
    };
    video.onerror = () => reject(new Error('Failed to load video for analysis'));
    video.src = url;
  });
};
```

These utility functions examine the actual dimensions of the media file to calculate the precise aspect ratio. This is critical because relying on file metadata or assumptions about aspect ratios is unreliable.

### 2. Enhanced Scene Data Model

The scene data model was extended to store the aspect ratio information:

```typescript
interface SceneMediaData {
  // Existing properties
  mediaUrl: string;
  mediaType: 'image' | 'video' | 'gallery';
  
  // New properties for aspect ratio support
  mediaWidth: number;        // Original width in pixels
  mediaHeight: number;       // Original height in pixels
  mediaAspectRatio: number;  // Calculated ratio (width/height)
}
```

These additions to the data model ensure that the original media dimensions and aspect ratio are preserved throughout the application lifecycle.

### 3. Integration with Media Upload Process

The media upload process was enhanced to perform analysis and store the results:

```typescript
// In SceneComponent.tsx - handleFileChange function
const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  if (!file) return;
  
  try {
    // Determine media type
    const mediaType = determineMediaType(file.type);
    
    // Upload file and get URL
    const mediaUrl = await uploadMedia(file, projectId);
    
    // Analyze media to get dimensions and aspect ratio
    const mediaAnalysis = await analyzeMedia(file, mediaType);
    console.log(`Media analysis complete: ${mediaAnalysis.width}x${mediaAnalysis.height}, ratio: ${mediaAnalysis.aspectRatio}`);
    
    // Update scene with complete media data including dimensions
    const updatedMedia = {
      mediaUrl,
      mediaType,
      mediaWidth: mediaAnalysis.width,
      mediaHeight: mediaAnalysis.height,
      mediaAspectRatio: mediaAnalysis.aspectRatio
    };
    
    // Update the scene with the new media data
    updateScene(sceneId, { media: updatedMedia });
    
  } catch (error) {
    console.error('Error handling file upload:', error);
  }
};
```

This ensures that every uploaded media file is properly analyzed, and the resulting dimensions and aspect ratio are stored with the scene data.

### 4. VideoContext Canvas Sizing

A critical part of the solution was modifying the VideoContextScenePreviewPlayer to properly size its canvas based on the media's aspect ratio:

```typescript
// In VideoContextScenePreviewPlayer.tsx
useEffect(() => {
  // Don't initialize until we have local media URL
  if (typeof window === 'undefined' || !canvasRef.current || !localMediaUrl) return;
  
  // Calculate canvas dimensions based on media aspect ratio
  const baseSize = 1920; // Base size for quality
  let canvasWidth, canvasHeight;
  
  if (initialMediaAspectRatio) {
    // Use provided media aspect ratio
    if (initialMediaAspectRatio >= 1) {
      // Landscape or square
      canvasWidth = baseSize;
      canvasHeight = Math.round(baseSize / initialMediaAspectRatio);
    } else {
      // Portrait
      canvasHeight = baseSize;
      canvasWidth = Math.round(baseSize * initialMediaAspectRatio);
    }
  } else {
    // Default to 16:9 if no aspect ratio is provided
    canvasWidth = 1920;
    canvasHeight = 1080;
  }
  
  // Set canvas dimensions
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;
  
  // Create VideoContext instance after setting canvas dimensions
  const ctx = new VideoContext(canvas);
  setVideoContext(ctx);
  
  // Create source node with correct dimensions
  // ... rest of initialization code
}, [localMediaUrl, mediaType, initialMediaAspectRatio]);
```

This ensures that the canvas used for rendering has the correct dimensions for the media's aspect ratio before any content is displayed.

### 5. Container Styling for Letterboxing/Pillarboxing

To ensure proper display with letterboxing/pillarboxing, the container styling was implemented as a dynamic function:

```typescript
const getContainerStyle = useCallback(() => {
  // Default style
  const baseStyle = {
    backgroundColor: '#000',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'relative',
  };

  if (!showLetterboxing) {
    // Without letterboxing, use standard styles
    return baseStyle;
  }

  // With letterboxing enabled, calculate dimensions
  const projectRatio = getProjectAspectRatioNumber();
  const mediaRatio = aspectRatio;
  
  let containerStyle = { ...baseStyle };
  
  // Set container to match project aspect ratio
  if (isCompactView) {
    // Compact view style calculations...
  } else {
    // Full view - use container with proper aspect ratio
    containerStyle = {
      ...containerStyle,
      width: '100%',
      aspectRatio: projectAspectRatio.replace(':', '/'),
    };
  }

  return containerStyle;
}, [isCompactView, showLetterboxing, aspectRatio, projectAspectRatio]);
```

### 6. Media Styling with Object-Fit Containment

Finally, the media styling was implemented to ensure content displays correctly within the container:

```typescript
const getMediaStyle = useCallback(() => {
  if (!showLetterboxing) {
    // Without letterboxing styles...
  }

  // With letterboxing, compare media ratio to project ratio
  const projectRatio = getProjectAspectRatioNumber();
  const mediaRatio = aspectRatio;
  
  // Calculate proper scaling for letterboxing/pillarboxing
  if (mediaRatio > projectRatio) {
    // Media is wider than project - add letterboxing
    return {
      width: '100%',
      height: 'auto',
      objectFit: 'contain',
      maxHeight: '100%',
    };
  } else if (mediaRatio < projectRatio) {
    // Media is taller than project - add pillarboxing
    return {
      width: 'auto',
      height: '100%',
      objectFit: 'contain',
      maxWidth: '100%',
    };
  } else {
    // Perfect match - no letterboxing or pillarboxing needed
    return {
      width: '100%',
      height: '100%',
      objectFit: 'contain',
    };
  }
}, [aspectRatio, showLetterboxing, getProjectAspectRatioNumber]);
```

This styling approach ensures that media is displayed with its natural aspect ratio preserved, using letterboxing or pillarboxing as needed to maintain proper proportions.

### 7. Component Props Chain

A critical part of the implementation was ensuring that aspect ratio information was properly passed through the component chain:

```typescript
// Scene component passing aspect ratio to SceneMediaPlayer
<SceneMediaPlayer
  media={scene.media}
  mediaAspectRatio={scene.media.mediaAspectRatio}
  projectAspectRatio={projectAspectRatio}
/>

// SceneMediaPlayer passing to VideoContextScenePreviewPlayer
<VideoContextScenePreviewPlayer
  mediaUrl={mediaUrl}
  mediaType={mediaType}
  mediaAspectRatio={mediaAspectRatio}
  projectAspectRatio={projectAspectRatio}
/>
```

This ensured that the aspect ratio information detected during upload was properly passed down to the components that needed it for proper rendering.

While logging was added to verify this implementation and identify potential issues, the actual solution was the complete chain of media analysis, data storage, and proper aspect ratio-aware rendering described above. 

## Next Steps

### Phase 1: Aspect Ratio Switching (1-2 weeks)
1. **Project Settings Enhancement**
   - Add aspect ratio selection to project settings
   - Support for 9:16, 16:9, 1:1, and 4:5 ratios
   - Store selection in project metadata
   - Add UI for ratio selection in project header

2. **VideoContextScenePreviewPlayer Updates**
   - Enhance existing letterboxing/pillarboxing logic to handle ratio changes
   - Update container styling for new aspect ratios
   - Ensure smooth transitions between ratios
   - Maintain proper media scaling during ratio changes

3. **Scene Card Adaptations**
   - Update scene card sizing logic for different ratios
   - Implement proper thumbnail scaling
   - Add visual indicators for current ratio
   - Ensure consistent preview across all views

4. **Testing & Validation**
   - Test ratio switching with various media types
   - Verify proper letterboxing/pillarboxing
   - Ensure consistent rendering across components
   - Validate export with different ratios

### Phase 2: Zoom Controls (2-3 weeks)
1. **Zoom Implementation**
   - Add zoom level state management
   - Implement zoom controls UI
   - Create smooth zoom transitions
   - Handle zoom boundaries and limits

2. **Media Positioning**
   - Add pan controls for zoomed content
   - Implement position persistence
   - Create reset functionality
   - Add position boundary checking

3. **Integration with Aspect Ratios**
   - Ensure zoom works correctly with all aspect ratios
   - Maintain zoom state during ratio changes
   - Implement proper scaling calculations
   - Add position normalization for different ratios

4. **UI/UX Enhancements**
   - Add visual zoom level indicator
   - Implement zoom gestures (pinch/scroll)
   - Create intuitive zoom controls
   - Add keyboard shortcuts

### Implementation Priority
1. **Aspect Ratio Switching First**
   - Builds on existing letterboxing/pillarboxing system
   - Provides immediate value for different output formats
   - Simpler to implement than zoom controls
   - Natural extension of current functionality

2. **Zoom Controls Second**
   - More complex interaction model
   - Requires new state management
   - Builds on stable aspect ratio foundation
   - Adds advanced editing capabilities

This phased approach ensures we maintain stability while adding powerful new features. The aspect ratio switching implementation will provide a solid foundation for the more complex zoom control system. 