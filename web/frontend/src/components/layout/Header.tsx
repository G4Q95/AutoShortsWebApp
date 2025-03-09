import Link from 'next/link';
import { VideoIcon } from 'lucide-react';

export default function Header() {
  return (
    <header className="bg-white border-b border-gray-200">
      <div className="container mx-auto px-4 py-4">
        <div className="flex justify-between items-center">
          <Link href="/" className="flex items-center space-x-2">
            <VideoIcon className="h-8 w-8 text-blue-600" />
            <span className="text-xl font-bold">Auto Shorts</span>
          </Link>
          
          <div className="flex items-center space-x-4">
            <button 
              disabled
              className="hidden md:inline-block px-4 py-2 border border-gray-300 text-gray-400 rounded-md cursor-not-allowed"
              title="Login functionality coming soon"
            >
              Log In
            </button>
            <Link 
              href="/create" 
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              Create Video
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
} 