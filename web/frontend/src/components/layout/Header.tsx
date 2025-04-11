'use client'; // Required for hooks

import Link from 'next/link';
import { usePathname } from 'next/navigation'; // Added import
import { VideoIcon, Layers as LayersIcon, PlusCircle as PlusCircleIcon, Save as SaveIcon } from 'lucide-react'; // Added SaveIcon
import { useProject } from '@/components/project/ProjectProvider'; // Added import
import AspectRatioDropdown from '@/components/ui/AspectRatioDropdown'; // Added import
import SaveStatusIndicator from '@/components/project/SaveStatusIndicator'; // Added import
import { type AspectRatioOption } from '@/components/ui/AspectRatioIcon'; // Added import
import { useEffect, useRef, useState } from 'react';

// Add DEBUG constant at the top - change to true to show debug info
const DEBUG = false;
// Fixed breakpoint value - adjust this to your desired value
const FIXED_BREAKPOINT = 1487; // in pixels - ADJUST THIS VALUE

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
  
  // Refs to measure actual elements for precise positioning
  const headerRef = useRef<HTMLDivElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const controlsRef = useRef<HTMLDivElement>(null);
  const [useCenteredLayout, setUseCenteredLayout] = useState<boolean>(true);
  // Add state to store current measurements for debugging
  const [debugInfo, setDebugInfo] = useState({ width: 0, threshold: 0 });
  
  const isProjectPage = pathname?.startsWith('/projects/') && pathname.split('/').length === 3;

  // Calculate available space and determine layout
  useEffect(() => {
    if (!isProjectPage) return;
    
    const calculateLayout = () => {
      if (!headerRef.current || !controlsRef.current) return;
      
      const headerWidth = headerRef.current.offsetWidth;
      const controlsWidth = controlsRef.current.offsetWidth;
      const titleWidth = titleInputRef.current?.offsetWidth || 200;
      
      // Buffer space to ensure no overlap (100px safety margin)
      const minSpaceNeeded = titleWidth + controlsWidth + 100;
      
      // Option 2: Fixed breakpoint - use this instead and adjust FIXED_BREAKPOINT constant
      const shouldCenter = headerWidth > FIXED_BREAKPOINT;
      
      // Store debug info
      setDebugInfo({ width: headerWidth, threshold: FIXED_BREAKPOINT });
      
      // Update layout status
      setUseCenteredLayout(shouldCenter);
    };
    
    // Initial calculation
    calculateLayout();
    
    // Set up resize listener
    const handleResize = () => calculateLayout();
    window.addEventListener('resize', handleResize);
    
    return () => window.removeEventListener('resize', handleResize);
  }, [isProjectPage, currentProject?.title]);

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
      {/* Debug display - only shown when DEBUG is true */}
      {DEBUG && (
        <div className="fixed bottom-0 left-0 bg-yellow-100 p-2 text-xs z-50 border border-yellow-500">
          Window width: {debugInfo.width}px<br/>
          Breakpoint: {debugInfo.threshold}px<br/>
          Layout: {useCenteredLayout ? 'Centered' : 'Flow'}
        </div>
      )}
      
      <div className="px-4 py-4 relative" ref={headerRef}>
        <div className="flex items-center">
          {/* Logo - always first */}
          <Link 
            href="/" 
            className="flex items-center space-x-2 flex-shrink-0" 
            data-testid="home-link"
          >
            <VideoIcon className="h-8 w-8 text-blue-600" data-testid="app-logo" />
            <span className="text-xl font-bold text-gray-900" data-testid="app-title">Auto Shorts</span>
          </Link>

          {/* Flexible spacer - pushes everything else to the right */}
          <div className="flex-1"></div>
          
          {/* Title and Controls section - grouped together on the right */}
          <div className="flex items-center space-x-4">
            {/* Title - either absolutely centered or next to controls */}
            {isProjectPage && currentProject && (
              useCenteredLayout ? (
                // Centered absolutely in the header
                <div className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 w-full max-w-[500px] px-4">
                  <input
                    ref={titleInputRef}
                    type="text"
                    value={currentProject.title}
                    onChange={(e) => setProjectTitle && setProjectTitle(e.target.value)}
                    className="text-xl font-semibold bg-transparent border-b border-transparent hover:border-gray-300 focus:border-blue-500 focus:outline-none px-1 py-0.5 text-gray-800 text-center truncate w-full max-w-[400px] sm:max-w-[300px] md:max-w-[350px] lg:max-w-[400px] xl:max-w-[500px]"
                    aria-label="Project title"
                    data-testid="project-title-header-centered"
                  />
                </div>
              ) : (
                // In normal flow right before the controls
                <input
                  ref={titleInputRef}
                  type="text"
                  value={currentProject.title}
                  onChange={(e) => setProjectTitle && setProjectTitle(e.target.value)}
                  className="text-xl font-semibold bg-transparent border-b border-transparent hover:border-gray-300 focus:border-blue-500 focus:outline-none px-1 py-0.5 mr-4 text-gray-800 truncate max-w-[200px] sm:max-w-[150px] md:max-w-[180px] lg:max-w-[200px] xl:max-w-[250px]"
                  aria-label="Project title"
                  data-testid="project-title-header-flow"
                />
              )
            )}
          
            {/* Controls section - always last */}
            <div className="flex items-center space-x-3 flex-shrink-0" ref={controlsRef}>
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
      </div>
    </header>
  );
}
