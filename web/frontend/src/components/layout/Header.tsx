'use client'; // Required for hooks

import Link from 'next/link';
import { usePathname } from 'next/navigation'; // Added import
import { VideoIcon, Layers as LayersIcon, PlusCircle as PlusCircleIcon, Save as SaveIcon } from 'lucide-react'; // Added SaveIcon
import { useProject } from '@/components/project/ProjectProvider'; // Added import
import AspectRatioDropdown from '@/components/ui/AspectRatioDropdown'; // Added import
import SaveStatusIndicator from '@/components/project/SaveStatusIndicator'; // Added import
import { type AspectRatioOption } from '@/components/ui/AspectRatioIcon'; // Added import
import { useEffect, useRef, useState } from 'react';

/**
 * Main application header component that provides navigation and branding.
 * Includes project-specific controls when on a project page.
 * 
 * Features:
 * - Responsive design with mobile-friendly navigation
 * - App logo and branding
 * - Navigation links to key app features
 * - Disabled login button (placeholder for future auth)
 * - Create Video button for main app functionality
 * 
 * Layout:
 * - Left side: App logo and name
 * - Right side: Navigation buttons
 *   - Login (disabled)
 *   - My Projects (hidden on mobile)
 *   - Create Video (primary action)
 * 
 * Accessibility:
 * - Uses semantic header tag
 * - Proper button/link roles
 * - Clear visual hierarchy
 * - Descriptive button titles
 * 
 * @example
 * ```tsx
 * // Basic usage in app layout
 * <Header />
 * ```
 */
export default function Header() {
  const pathname = usePathname();
  const {
    currentProject,
    setProjectTitle,
    setProjectAspectRatio,
    toggleLetterboxing,
    isSaving,
    lastSaved,
    saveCurrentProject,
  } = useProject();
  
  // Refs for measuring element widths
  const headerContainerRef = useRef<HTMLDivElement>(null);
  const logoRef = useRef<HTMLAnchorElement>(null);
  const controlsRef = useRef<HTMLDivElement>(null);
  const [useCenteredLayout, setUseCenteredLayout] = useState(true);
  
  const isProjectPage = pathname?.startsWith('/projects/') && pathname.split('/').length === 3;

  // Function to check available space and determine layout
  const checkSpaceAndUpdateLayout = () => {
    if (!isProjectPage || !headerContainerRef.current || !logoRef.current || !controlsRef.current) return;
    
    const headerWidth = headerContainerRef.current.offsetWidth;
    const logoWidth = logoRef.current.offsetWidth;
    const controlsWidth = controlsRef.current.offsetWidth;
    
    // Calculate the space available for the title
    // Use a larger buffer (200px) to account for any elements that might not be properly measured
    const availableSpace = headerWidth - logoWidth - controlsWidth - 200;
    
    // More aggressive threshold (400px) to switch layouts earlier
    setUseCenteredLayout(availableSpace >= 400);
    
    // Force an immediate check on mount and when dimensions change
    console.log('Header layout check:', { 
      headerWidth, 
      logoWidth, 
      controlsWidth, 
      availableSpace, 
      useCenteredLayout: availableSpace >= 400 
    });
  };
  
  // Add resize listener
  useEffect(() => {
    if (!isProjectPage) return;
    
    checkSpaceAndUpdateLayout();
    
    const handleResize = () => {
      checkSpaceAndUpdateLayout();
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isProjectPage, currentProject]);

  const handleManualSave = () => {
    if (saveCurrentProject) {
      saveCurrentProject();
    }
  };

  const handleAspectRatioChange = async (ratio: AspectRatioOption) => {
    if (setProjectAspectRatio) {
      await setProjectAspectRatio(ratio);
      handleManualSave();
    }
  };

  const handleToggleLetterboxing = async (show: boolean) => {
    if (toggleLetterboxing) {
      await toggleLetterboxing(show);
      handleManualSave();
    }
  };

  return (
    <header className="bg-white border-b border-gray-200" data-testid="main-header">
      <div className="px-4 py-4 relative">
        <div className="flex items-center space-x-4" ref={headerContainerRef}>
          <Link 
            href="/" 
            className="flex items-center space-x-2 flex-shrink-0" 
            data-testid="home-link"
            ref={logoRef}
          >
            <VideoIcon className="h-8 w-8 text-blue-600" data-testid="app-logo" />
            <span className="text-xl font-bold text-gray-900" data-testid="app-title">Auto Shorts</span>
          </Link>

          {isProjectPage && currentProject ? (
            <>
              {/* Centered title for larger screens with sufficient space */}
              {useCenteredLayout && (
                <div className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2">
                  <input
                    type="text"
                    value={currentProject.title}
                    onChange={(e) => setProjectTitle && setProjectTitle(e.target.value)}
                    className="text-xl font-semibold bg-transparent border-b border-transparent hover:border-gray-300 focus:border-blue-500 focus:outline-none px-1 py-0.5 text-gray-800 text-center truncate max-w-[400px]"
                    aria-label="Project title"
                    data-testid="project-title-header-centered"
                  />
                </div>
              )}
              
              {/* Left-aligned title for smaller screens or when space is limited */}
              {!useCenteredLayout && (
                <div className="ml-4 mr-4 flex-grow flex justify-start items-center">
                  <input
                    type="text"
                    value={currentProject.title}
                    onChange={(e) => setProjectTitle && setProjectTitle(e.target.value)}
                    className="text-xl font-semibold bg-transparent border-b border-transparent hover:border-gray-300 focus:border-blue-500 focus:outline-none px-1 py-0.5 text-gray-800 truncate max-w-[200px]"
                    aria-label="Project title"
                    data-testid="project-title-header-responsive"
                  />
                </div>
              )}
              
              <div className="flex-1"></div>
            </>
          ) : (
            <div className="flex-1"></div>
          )}
          
          <div className="flex items-center space-x-4 flex-shrink-0" ref={controlsRef}>
            {isProjectPage && currentProject && (
              <>
                <AspectRatioDropdown
                  currentRatio={currentProject.aspectRatio || '9:16'}
                  onChange={handleAspectRatioChange}
                  showLetterboxing={currentProject.showLetterboxing || true}
                  onToggleLetterboxing={handleToggleLetterboxing}
                  className="flex-shrink-0"
                />
                <div className="flex flex-col items-end flex-shrink-0 space-y-1">
                  <button
                    onClick={handleManualSave}
                    className="flex items-center px-2 py-0.5 bg-gray-100 hover:bg-gray-200 rounded text-xs"
                    disabled={isSaving}
                    data-testid="save-project-button-header"
                  >
                    <SaveIcon className="h-3 w-3 mr-1" />
                    Save
                  </button>
                  <SaveStatusIndicator isSaving={isSaving} lastSaved={lastSaved} />
                </div>
              </>
            )}

            <button
              disabled
              className="hidden md:inline-block px-4 py-2 border border-gray-300 text-gray-400 rounded-md cursor-not-allowed"
              title="Login functionality coming soon"
              data-testid="login-button"
            >
              Log In
            </button>
            <Link
              href="/projects"
              className="hidden sm:inline-flex items-center px-4 py-2 border border-blue-600 text-blue-600 rounded-md hover:bg-blue-50 transition-colors"
              data-testid="my-projects-link"
            >
              <LayersIcon className="h-4 w-4 mr-1" />
              My Projects
            </Link>
            <Link
              href="/projects/create"
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors flex items-center"
              data-testid="create-video-button"
            >
              <PlusCircleIcon className="h-4 w-4 mr-1" />
              Create Video
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}
