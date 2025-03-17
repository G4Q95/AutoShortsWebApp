import Link from 'next/link';
import { VideoIcon, Layers as LayersIcon, PlusCircle as PlusCircleIcon } from 'lucide-react';

/**
 * Main application header component that provides navigation and branding.
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
  return (
    <header className="bg-white border-b border-gray-200" data-testid="main-header">
      <div className="container mx-auto px-4 py-4">
        <div className="flex justify-between items-center">
          <Link href="/" className="flex items-center space-x-2" data-testid="home-link">
            <VideoIcon className="h-8 w-8 text-blue-600" data-testid="app-logo" />
            <span className="text-xl font-bold text-gray-900" data-testid="app-title">Auto Shorts</span>
          </Link>

          <div className="flex items-center space-x-4" data-testid="nav-actions">
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
            {/* Points to COMPLEX video creation flow */}
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
