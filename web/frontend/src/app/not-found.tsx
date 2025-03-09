import Link from 'next/link';
import { HomeIcon, VideoIcon } from 'lucide-react';

export default function NotFoundPage() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-4">
      <VideoIcon className="h-16 w-16 text-blue-600 mb-6" />
      <h1 className="text-4xl font-bold text-gray-900 mb-2">Page Not Found</h1>
      <p className="text-xl text-gray-600 mb-8 max-w-md">
        The page you're looking for doesn't exist or is still under development.
      </p>
      <div className="flex space-x-4">
        <Link
          href="/"
          className="px-5 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors inline-flex items-center"
        >
          <HomeIcon className="h-5 w-5 mr-2" />
          Back to Home
        </Link>
        <Link
          href="/create"
          className="px-5 py-3 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
        >
          Create a Video
        </Link>
      </div>
    </div>
  );
} 