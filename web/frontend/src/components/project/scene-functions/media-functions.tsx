'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Scene } from '../ProjectProvider';
import { ImageIcon, TrashIcon, Film, GalleryHorizontalEnd } from 'lucide-react';
import Image from 'next/image';

/**
 * Types of media a scene can contain
 */
export enum MediaType {
  None = 'none',
  Image = 'image',
  Video = 'video',
  Gallery = 'gallery'
}

/**
 * Custom hook for media handling in scene card
 * 
 * @param scene The scene data containing media
 * @param updateSceneMedia Function to update scene media
 * @returns Media-related state and handlers
 */
export function useMediaLogic(
  scene: Scene,
  updateSceneMedia: (id: string, mediaData: any) => void
) {
  // Media state
  const [mediaType, setMediaType] = useState<MediaType>(
    scene.media?.type === 'gallery' ? MediaType.Gallery :
    scene.media?.type === 'image' ? MediaType.Image :
    scene.media?.type === 'video' ? MediaType.Video :
    MediaType.None
  );
  const [mediaUrl, setMediaUrl] = useState<string | null>(
    scene.media?.url || null
  );
  const [galleryImages, setGalleryImages] = useState<Array<{url: string, alt?: string}>>(
    scene.media?.type === 'gallery' && scene.media.url ? 
      [{ url: scene.media.url, alt: 'Gallery image' }] : 
      []
  );
  const [activeGalleryIndex, setActiveGalleryIndex] = useState(0);
  const [showMediaControls, setShowMediaControls] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Update media type when scene changes
  useEffect(() => {
    if (scene.media?.type === 'gallery') {
      setMediaType(MediaType.Gallery);
      if (scene.media.url) {
        setGalleryImages([{ url: scene.media.url, alt: 'Gallery image' }]);
      }
    } else if (scene.media?.type === 'image') {
      setMediaType(MediaType.Image);
      setMediaUrl(scene.media.url);
    } else if (scene.media?.type === 'video') {
      setMediaType(MediaType.Video);
      setMediaUrl(scene.media.url);
    } else {
      setMediaType(MediaType.None);
      setMediaUrl(null);
    }
  }, [scene.media]);
  
  // Toggle media controls visibility
  const toggleMediaControls = useCallback(() => {
    setShowMediaControls(!showMediaControls);
  }, [showMediaControls]);
  
  // Open file picker for media upload
  const handleAddMedia = useCallback((type: MediaType) => {
    if (fileInputRef.current) {
      // Set accepted file types based on media type
      if (type === MediaType.Image || type === MediaType.Gallery) {
        fileInputRef.current.accept = 'image/*';
      } else if (type === MediaType.Video) {
        fileInputRef.current.accept = 'video/*';
      }
      
      fileInputRef.current.click();
    }
  }, []);
  
  // Handle file selection from file picker
  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    // Reset the input so the same file can be selected again if needed
    e.target.value = '';
    
    // For gallery mode, handle multiple files
    if (mediaType === MediaType.Gallery && files.length > 1) {
      const newGalleryImages = Array.from(files).map(file => ({
        url: URL.createObjectURL(file),
        blob: file,
        alt: file.name
      }));
      
      setGalleryImages(newGalleryImages);
      setActiveGalleryIndex(0);
      
      // Update scene with new gallery - use the first image as the main URL
      updateSceneMedia(scene.id, {
        media: {
          type: 'gallery',
          url: newGalleryImages[0].url,
          thumbnailUrl: newGalleryImages[0].url,
          width: 800,
          height: 600,
          contentType: 'image/jpeg'
        }
      });
      
      return;
    }
    
    // Handle single file for image or video
    const file = files[0];
    const objectUrl = URL.createObjectURL(file);
    
    // Determine if it's an image or video
    const isImage = file.type.startsWith('image/');
    const isVideo = file.type.startsWith('video/');
    
    if (isImage) {
      setMediaType(MediaType.Image);
      setMediaUrl(objectUrl);
      
      // Update scene with new image
      updateSceneMedia(scene.id, {
        media: {
          type: 'image',
          url: objectUrl,
          thumbnailUrl: objectUrl,
          width: 800,
          height: 600,
          contentType: 'image/jpeg'
        }
      });
    } else if (isVideo) {
      setMediaType(MediaType.Video);
      setMediaUrl(objectUrl);
      
      // Update scene with new video
      updateSceneMedia(scene.id, {
        media: {
          type: 'video',
          url: objectUrl,
          thumbnailUrl: objectUrl,
          width: 800,
          height: 600,
          contentType: 'video/mp4'
        }
      });
    }
  }, [mediaType, scene.id, updateSceneMedia]);
  
  // Remove media from scene
  const handleRemoveMedia = useCallback(() => {
    if (mediaType === MediaType.Gallery) {
      setGalleryImages([]);
    }
    
    setMediaType(MediaType.None);
    setMediaUrl(null);
    
    // Update scene to remove all media
    updateSceneMedia(scene.id, {
      media: null
    });
  }, [mediaType, scene.id, updateSceneMedia]);
  
  // Navigate gallery images
  const goToNextImage = useCallback(() => {
    if (galleryImages.length > 0) {
      setActiveGalleryIndex((activeGalleryIndex + 1) % galleryImages.length);
    }
  }, [activeGalleryIndex, galleryImages.length]);
  
  const goToPrevImage = useCallback(() => {
    if (galleryImages.length > 0) {
      setActiveGalleryIndex((activeGalleryIndex - 1 + galleryImages.length) % galleryImages.length);
    }
  }, [activeGalleryIndex, galleryImages.length]);
  
  // Clean up any created object URLs when component unmounts
  useEffect(() => {
    return () => {
      if (mediaUrl && (mediaUrl.startsWith('blob:') || mediaUrl.startsWith('data:'))) {
        URL.revokeObjectURL(mediaUrl);
      }
      
      galleryImages.forEach(img => {
        if (img.url && (img.url.startsWith('blob:') || img.url.startsWith('data:'))) {
          URL.revokeObjectURL(img.url);
        }
      });
    };
  }, [mediaUrl, galleryImages]);
  
  // Add sample media for testing
  const addSampleMedia = useCallback(() => {
    // Sample image URLs for testing
    const sampleImages = [
      'https://source.unsplash.com/random/800x600/?nature',
      'https://source.unsplash.com/random/800x600/?city',
      'https://source.unsplash.com/random/800x600/?animals',
      'https://source.unsplash.com/random/800x600/?technology',
      'https://source.unsplash.com/random/800x600/?food'
    ];
    
    // Select a random image
    const randomIndex = Math.floor(Math.random() * sampleImages.length);
    const imageUrl = sampleImages[randomIndex];
    
    setMediaType(MediaType.Image);
    setMediaUrl(imageUrl);
    
    // Update scene with new image
    updateSceneMedia(scene.id, {
      media: {
        type: 'image',
        url: imageUrl,
        thumbnailUrl: imageUrl,
        width: 800,
        height: 600,
        contentType: 'image/jpeg'
      }
    });
    
    console.log(`Added sample image to scene ${scene.id}: ${imageUrl}`);
  }, [scene.id, updateSceneMedia]);
  
  return {
    mediaType,
    setMediaType,
    mediaUrl,
    setMediaUrl,
    galleryImages,
    setGalleryImages,
    activeGalleryIndex,
    setActiveGalleryIndex,
    showMediaControls,
    setShowMediaControls,
    fileInputRef,
    toggleMediaControls,
    handleAddMedia,
    handleFileChange,
    handleRemoveMedia,
    goToNextImage,
    goToPrevImage,
    addSampleMedia
  };
}

/**
 * Renders the media section of the scene card
 * 
 * @param mediaState State and handlers from useMediaLogic
 * @returns JSX for media section
 */
export function renderMediaSection(mediaState: ReturnType<typeof useMediaLogic>) {
  const {
    mediaType,
    mediaUrl,
    galleryImages,
    activeGalleryIndex,
    showMediaControls,
    fileInputRef,
    toggleMediaControls,
    handleAddMedia,
    handleFileChange,
    handleRemoveMedia,
    goToNextImage,
    goToPrevImage,
    addSampleMedia
  } = mediaState;

  return (
    <div className="relative group media-container">
      {/* File input (hidden) */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
        accept="image/*,video/*"
        multiple={mediaType === MediaType.Gallery}
      />
      
      {/* Media display area */}
      <div
        className={`media-area overflow-hidden ${mediaType === MediaType.None ? 'bg-gray-100 border-2 border-dashed border-gray-300' : ''}`}
        style={{ height: '200px' }}
        onClick={toggleMediaControls}
        data-testid="scene-media-area"
      >
        {mediaType === MediaType.None && (
          <div className="h-full w-full flex flex-col items-center justify-center">
            <ImageIcon className="h-8 w-8 text-gray-400 mb-2" />
            <p className="text-gray-500 text-sm">No media</p>
            <p className="text-gray-400 text-xs mb-4">Click to add media</p>
            <button 
              className="bg-blue-500 hover:bg-blue-600 text-white text-sm px-4 py-2 rounded-lg shadow-md transition-colors duration-200 transform hover:scale-105"
              onClick={(e) => {
                e.stopPropagation();
                addSampleMedia();
              }}
              data-testid="add-sample-media-button"
            >
              Add Sample Image
            </button>
          </div>
        )}
        
        {mediaType === MediaType.Image && mediaUrl && (
          <div className="relative h-full w-full">
            <Image 
              src={mediaUrl}
              alt="Scene image"
              fill
              style={{ objectFit: 'cover' }}
              sizes="(max-width: 768px) 100vw, 600px"
              priority
              data-testid="scene-image"
            />
          </div>
        )}
        
        {mediaType === MediaType.Video && mediaUrl && (
          <div className="relative h-full w-full">
            <video
              src={mediaUrl}
              className="h-full w-full object-cover"
              controls
              data-testid="scene-video"
            />
          </div>
        )}
        
        {mediaType === MediaType.Gallery && galleryImages.length > 0 && (
          <div className="relative h-full w-full">
            <Image 
              src={galleryImages[activeGalleryIndex].url}
              alt={galleryImages[activeGalleryIndex].alt || `Gallery image ${activeGalleryIndex + 1}`}
              fill
              style={{ objectFit: 'cover' }}
              sizes="(max-width: 768px) 100vw, 600px"
              priority
              data-testid="scene-gallery-image"
            />
            
            {/* Gallery navigation buttons */}
            {galleryImages.length > 1 && (
              <>
                <button
                  onClick={(e) => { e.stopPropagation(); goToPrevImage(); }}
                  className="absolute left-2 top-1/2 transform -translate-y-1/2 bg-black bg-opacity-50 rounded-full p-1 text-white"
                  aria-label="Previous image"
                >
                  &lt;
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); goToNextImage(); }}
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-black bg-opacity-50 rounded-full p-1 text-white"
                  aria-label="Next image"
                >
                  &gt;
                </button>
                <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 flex space-x-1">
                  {galleryImages.map((_, index) => (
                    <div
                      key={index}
                      className={`h-1.5 w-1.5 rounded-full ${index === activeGalleryIndex ? 'bg-white' : 'bg-gray-400'}`}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>
      
      {/* Media controls overlay */}
      {showMediaControls && (
        <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center gap-4">
          <button
            onClick={() => handleAddMedia(MediaType.Image)}
            className="bg-white p-2 rounded-full text-gray-800"
            aria-label="Add image"
          >
            <ImageIcon className="h-5 w-5" />
          </button>
          <button
            onClick={() => handleAddMedia(MediaType.Video)}
            className="bg-white p-2 rounded-full text-gray-800"
            aria-label="Add video"
          >
            <Film className="h-5 w-5" />
          </button>
          <button
            onClick={() => handleAddMedia(MediaType.Gallery)}
            className="bg-white p-2 rounded-full text-gray-800"
            aria-label="Add gallery"
          >
            <GalleryHorizontalEnd className="h-5 w-5" />
          </button>
          {mediaType !== MediaType.None && (
            <button
              onClick={handleRemoveMedia}
              className="bg-red-500 p-2 rounded-full text-white"
              aria-label="Remove media"
            >
              <TrashIcon className="h-5 w-5" />
            </button>
          )}
        </div>
      )}
    </div>
  );
} 