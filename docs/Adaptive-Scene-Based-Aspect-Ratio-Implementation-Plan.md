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