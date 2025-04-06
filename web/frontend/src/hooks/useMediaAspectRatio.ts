import { useMemo } from 'react';
import { CSSProperties } from 'react';

// Define the hook's props interface
interface UseMediaAspectRatioProps {
  initialMediaAspectRatio?: number;
  projectAspectRatio?: '9:16' | '16:9' | '1:1' | '4:5';
  showLetterboxing?: boolean;
  mediaType?: 'image' | 'video' | 'gallery';
  videoContext?: any;
}

// Define the hook's return type
interface UseMediaAspectRatioReturn {
  // This style is intended for the media element itself (img, video, canvas)
  mediaElementStyle: CSSProperties;
  calculatedAspectRatio: number;
}

// Default aspect ratio if nothing else is available (fallback)
const DEFAULT_ASPECT_RATIO = 9 / 16;

/**
 * Custom hook to calculate media aspect ratio and styling.
 * Handles initial aspect ratio, updates from video dimensions,
 * and calculates CSS for letterboxing/pillarboxing.
 */
export const useMediaAspectRatio = ({
  initialMediaAspectRatio,
  projectAspectRatio,
  showLetterboxing,
  mediaType,
  videoContext,
}: UseMediaAspectRatioProps): UseMediaAspectRatioReturn => {

  const calculatedAspectRatio = useMemo(() => {
    // Priority: 1. Dimensions from videoContext if available
    if (videoContext?.sourceNode?.element && videoContext.sourceNode.element.videoWidth > 0) {
      const videoElement = videoContext.sourceNode.element as HTMLVideoElement;
      return videoElement.videoWidth / videoElement.videoHeight;
    }
    // Priority: 2. Initial aspect ratio from props
    if (initialMediaAspectRatio && initialMediaAspectRatio > 0) {
      return initialMediaAspectRatio;
    }
    // Fallback logic might need refinement, but let's use project for images for now
    if (mediaType !== 'video') {
        const [projWidth, projHeight] = projectAspectRatio?.split(':').map(Number) || [9, 16];
        return projWidth / projHeight;
    }
    return DEFAULT_ASPECT_RATIO;
  }, [initialMediaAspectRatio, mediaType, projectAspectRatio, videoContext]);

  // Calculate the style FOR THE MEDIA ELEMENT, replicating original getMediaStyle logic
  const mediaElementStyle = useMemo(() => {
    const [projWidth, projHeight] = projectAspectRatio?.split(':').map(Number) || [9, 16];
    const projectRatio = projWidth / projHeight;
    const mediaRatio = calculatedAspectRatio;

    // Type matching original getMediaStyle internal type
    type MediaElementStyleInternal = {
        objectFit: 'contain' | 'cover';
        maxWidth: string;
        maxHeight: string;
        width?: string;
        height?: string;
    } & CSSProperties;

    let style: MediaElementStyleInternal = {
      objectFit: 'contain',
      maxWidth: '100%',
      maxHeight: '100%',
      // Default width/height for objectFit: contain to work within container
      width: '100%', 
      height: '100%', 
    };

    if (showLetterboxing) {
       if (Math.abs(mediaRatio - projectRatio) < 0.01) {
         style = { ...style, width: '100%', height: '100%' };
         // console.log(`[useMediaAspectRatio] Style: PERFECT MATCH`);
       } else if (mediaRatio > projectRatio) {
         style = { ...style, width: '100%', height: 'auto' }; // Height adjusts
         // console.log(`[useMediaAspectRatio] Style: LETTERBOXING`);
       } else {
         style = { ...style, width: 'auto', height: '100%' }; // Width adjusts
         // console.log(`[useMediaAspectRatio] Style: PILLARBOXING`);
       }
       style.objectFit = 'contain'; // Force contain when letterboxing
     } else {
       style = { ...style, width: '100%', height: '100%', objectFit: 'cover' };
       // console.log(`[useMediaAspectRatio] Style: COVER`);
     }

    return style;
  }, [calculatedAspectRatio, projectAspectRatio, showLetterboxing]);

  return {
    mediaElementStyle, // Renamed for clarity
    calculatedAspectRatio,
  };
}; 