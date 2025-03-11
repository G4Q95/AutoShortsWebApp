import Link from 'next/link';
import { VideoIcon, Layers as LayersIcon, PlusCircle as PlusCircleIcon } from 'lucide-react';

/**
 * Main application header with navigation links.
 * Note: "Create Video" buttons point to the COMPLEX flow
 */
export default function Header() {
  return (
    <header className="bg-white border-b border-gray-200">
      <div className="container mx-auto px-4 py-4">
        <div className="flex justify-between items-center">
          <Link href="/" className="flex items-center space-x-2">
            <VideoIcon className="h-8 w-8 text-blue-600" />
            <span className="text-xl font-bold text-gray-900">Auto Shorts</span>
          </Link>
          
          <nav className="hidden md:flex items-center space-x-6">
            {/* Points to COMPLEX video creation flow */}
            <Link href="/projects/create" className="text-gray-600 hover:text-blue-600">
              Create Video
            </Link>
            <Link href="/projects" className="text-gray-600 hover:text-blue-600 flex items-center">
              <LayersIcon className="h-4 w-4 mr-1" />
              Projects
            </Link>
          </nav>
          
          <div className="flex items-center space-x-4">
            <button 
              disabled
              className="hidden md:inline-block px-4 py-2 border border-gray-300 text-gray-400 rounded-md cursor-not-allowed"
              title="Login functionality coming soon"
            >
              Log In
            </button>
            <Link 
              href="/projects" 
              className="hidden sm:inline-flex items-center px-4 py-2 border border-blue-600 text-blue-600 rounded-md hover:bg-blue-50 transition-colors"
            >
              <LayersIcon className="h-4 w-4 mr-1" />
              My Projects
            </Link>
            {/* Points to COMPLEX video creation flow */}
            <Link 
              href="/projects/create" 
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors flex items-center"
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