import Link from 'next/link';
import { VideoIcon, Layers as LayersIcon, PlusCircle as PlusCircleIcon } from 'lucide-react';

export default function Header() {
  return (
    <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
      <div className="container mx-auto px-4 py-4">
        <div className="flex justify-between items-center">
          <Link href="/" className="flex items-center space-x-2">
            <VideoIcon className="h-8 w-8 text-blue-600 dark-mode-compatible-logo" />
            <span className="text-xl font-bold text-gray-900 dark:text-gray-100">Auto Shorts</span>
          </Link>
          
          <nav className="hidden md:flex items-center space-x-6">
            <Link href="/create-video" className="text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400">
              Create Video
            </Link>
            <Link href="/projects" className="text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 flex items-center">
              <LayersIcon className="h-4 w-4 mr-1" />
              Projects
            </Link>
          </nav>
          
          <div className="flex items-center space-x-4">
            <button 
              disabled
              className="hidden md:inline-block px-4 py-2 border border-gray-300 dark:border-gray-700 text-gray-400 rounded-md cursor-not-allowed"
              title="Login functionality coming soon"
            >
              Log In
            </button>
            <Link 
              href="/projects" 
              className="hidden sm:inline-flex items-center px-4 py-2 border border-blue-600 text-blue-600 dark:text-blue-400 rounded-md hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors"
            >
              <LayersIcon className="h-4 w-4 mr-1" />
              My Projects
            </Link>
            <Link 
              href="/create-video" 
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