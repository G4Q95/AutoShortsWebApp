import { useState, useEffect, useMemo, CSSProperties } from 'react';

// Define the hook's props interface
interface UseMediaAspectRatioProps {
  initialMediaAspectRatio?: number;
  projectAspectRatio: '9:16' | '16:9' | '1:1' | '4:5';
  showLetterboxing: boolean;
  mediaType: 'image' | 'video' | 'gallery';
  // Pass dimensions when video metadata is loaded
  videoDimensions?: { width: number; height: number } | null;
}

// Define the hook's return type
interface UseMediaAspectRatioReturn {
  mediaStyle: CSSProperties;
  calculatedAspectRatio: number;
  isVertical: boolean;
  isSquare: boolean;
}

// Default aspect ratio if nothing else is available (fallback)
const DEFAULT_ASPECT_RATIO = 9 / 16;

/**
 * Custom hook to calculate media aspect ratio and styling.
 * Handles initial aspect ratio, updates from video dimensions,
 * and calculates CSS for letterboxing/pillarboxing.
 */
export function useMediaAspectRatio({
  initialMediaAspectRatio,
  projectAspectRatio,
  showLetterboxing,
  mediaType,
  videoDimensions,
}: UseMediaAspectRatioProps): UseMediaAspectRatioReturn {
  const [calculatedAspectRatio, setCalculatedAspectRatio] = useState<number>(DEFAULT_ASPECT_RATIO);
  const [isVertical, setIsVertical] = useState<boolean>(true);
  const [isSquare, setIsSquare] = useState<boolean>(false);

  // Effect 1: Update aspect ratio based on loaded video dimensions
  useEffect(() => {
    if (mediaType === 'video' && videoDimensions && videoDimensions.width > 0 && videoDimensions.height > 0) {
      const videoRatio = videoDimensions.width / videoDimensions.height;
      console.log(`[useMediaAspectRatio] Updating from video dimensions: ${videoDimensions.width}x${videoDimensions.height}, Ratio: ${videoRatio.toFixed(4)}`);
      setCalculatedAspectRatio(videoRatio);
      setIsVertical(videoRatio < 1);
      setIsSquare(videoRatio === 1);
    } else if (mediaType === 'image' || mediaType === 'gallery') {
      // For images, use initial prop or default
      const initialRatio = initialMediaAspectRatio || DEFAULT_ASPECT_RATIO;
      console.log(`[useMediaAspectRatio] Using initial/default for image: ${initialRatio.toFixed(4)}`);
      setCalculatedAspectRatio(initialRatio);
      setIsVertical(initialRatio < 1);
      setIsSquare(initialRatio === 1);
    } else if (mediaType === 'video' && !videoDimensions) {
        // Video not loaded yet, use initial if available, otherwise default
        const initialOrProjectRatio = initialMediaAspectRatio || DEFAULT_ASPECT_RATIO;
        console.log(`[useMediaAspectRatio] Using initial/default for unloaded video: ${initialOrProjectRatio.toFixed(4)}`);
        setCalculatedAspectRatio(initialOrProjectRatio);
        setIsVertical(initialOrProjectRatio < 1);
        setIsSquare(initialOrProjectRatio === 1);
    }

  }, [mediaType, videoDimensions, initialMediaAspectRatio]);

  // Effect 2: Recalculate if project aspect ratio changes (might influence default)
  // This might be redundant if the default logic is handled above, but keep for safety
  useEffect(() => {
    // If aspect ratio is still the default and project aspect ratio changes, update
    // This ensures if initialMediaAspectRatio was undefined, we adjust the default
    if (calculatedAspectRatio === DEFAULT_ASPECT_RATIO && (!initialMediaAspectRatio || mediaType === 'video' && !videoDimensions)) {
        const [projWidth, projHeight] = projectAspectRatio.split(':').map(Number);
        const projectRatioNumber = projWidth / projHeight;
        console.log(`[useMediaAspectRatio] Project aspect ratio changed, updating default baseline to: ${projectRatioNumber.toFixed(4)}`);
        // Consider if we should actually use projectRatioNumber as the default?
        // For now, let's stick to 9:16 as the ultimate fallback.
        // setCalculatedAspectRatio(projectRatioNumber);
        // setIsVertical(projectRatioNumber < 1);
        // setIsSquare(projectRatioNumber === 1);
    }
  }, [projectAspectRatio]);

  // Memoized calculation for the media element's style
  const mediaStyle: CSSProperties = useMemo(() => {
    const [projWidth, projHeight] = projectAspectRatio.split(':').map(Number);
    const projectRatio = projWidth / projHeight;
    const mediaRatio = calculatedAspectRatio;

    console.log(`[useMediaAspectRatio] Calculating mediaStyle: Media Ratio=${mediaRatio.toFixed(4)}, Project Ratio=${projectRatio.toFixed(4)}, Letterbox=${showLetterboxing}`);

    let style: CSSProperties = {
      display: 'block', // Use block for canvas/img
      objectFit: 'contain',
      maxWidth: '100%',
      maxHeight: '100%',
      width: 'auto',
      height: 'auto',
      margin: 'auto', // Center the media element
    };

    if (showLetterboxing) {
      if (Math.abs(mediaRatio - projectRatio) < 0.01) {
        // Ratios are very close - treat as perfect match
        style.width = '100%';
        style.height = '100%';
        console.log(`[useMediaAspectRatio] Style: PERFECT MATCH`);
      } else if (mediaRatio > projectRatio) {
        // Media is wider than project (needs letterboxing)
        style.width = '100%';
        style.height = 'auto'; // Height adjusts based on width and media ratio
        console.log(`[useMediaAspectRatio] Style: LETTERBOXING (Wide Media)`);
      } else {
        // Media is taller than project (needs pillarboxing)
        style.height = '100%';
        style.width = 'auto'; // Width adjusts based on height and media ratio
        console.log(`[useMediaAspectRatio] Style: PILLARBOXING (Tall Media)`);
      }
    } else {
      // No letterboxing - stretch to cover
      style.width = '100%';
      style.height = '100%';
      style.objectFit = 'cover';
      console.log(`[useMediaAspectRatio] Style: COVER (No Letterboxing)`);
    }

    return style;
  }, [calculatedAspectRatio, projectAspectRatio, showLetterboxing]);

  return {
    mediaStyle,
    calculatedAspectRatio,
    isVertical,
    isSquare,
  };
} 