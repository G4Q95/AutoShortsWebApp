import Link from 'next/link';
import { ArrowRight, VideoIcon, Layers as LayersIcon } from 'lucide-react';

export default function Home() {
  return (
    <div>
      {/* Simplified Hero Section */}
      <section className="py-12 md:py-24">
        <div className="container mx-auto px-4">
          <div className="flex flex-col items-center text-center max-w-3xl mx-auto">
            <h1 className="text-4xl md:text-6xl font-bold text-gray-900 leading-tight mb-6">
              Transform Content into <span className="text-blue-600">Engaging Short Videos</span>
            </h1>
            <p className="text-xl text-gray-600 mb-8">
              Auto Shorts automatically creates short-form videos from Reddit posts in minutes. Perfect for TikTok, Instagram, and YouTube Shorts.
            </p>
            <div className="w-full max-w-md flex flex-col gap-4 md:flex-row">
              <Link 
                href="/create" 
                className="w-full px-6 py-4 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-center font-medium flex items-center justify-center"
              >
                Create Video
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
              <Link
                href="/projects"
                className="w-full px-6 py-4 bg-white border border-gray-300 text-gray-800 rounded-md hover:bg-gray-50 transition-colors text-center font-medium flex items-center justify-center"
              >
                Try Projects
                <LayersIcon className="ml-2 h-5 w-5" />
              </Link>
            </div>
            
            {/* Simple visual indicator */}
            <div className="mt-16 relative w-full max-w-2xl">
              <div className="aspect-video bg-gray-100 rounded-lg shadow-lg border border-gray-200 overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-blue-600/5 to-purple-600/5"></div>
                <div className="h-full flex flex-col items-center justify-center p-8">
                  <VideoIcon className="h-12 w-12 text-blue-600 mb-4" />
                  <div className="text-center">
                    <h3 className="text-xl font-semibold mb-2">How it works:</h3>
                    <ol className="text-left text-gray-700 space-y-2 max-w-md mx-auto">
                      <li className="flex items-start">
                        <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-blue-100 text-blue-800 font-semibold text-sm mr-2 mt-0.5">1</span>
                        <span>Create a project with multiple scenes from Reddit URLs</span>
                      </li>
                      <li className="flex items-start">
                        <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-blue-100 text-blue-800 font-semibold text-sm mr-2 mt-0.5">2</span>
                        <span>Arrange and edit your scenes in any order</span>
                      </li>
                      <li className="flex items-start">
                        <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-blue-100 text-blue-800 font-semibold text-sm mr-2 mt-0.5">3</span>
                        <span>Generate and download your custom video</span>
                      </li>
                    </ol>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
