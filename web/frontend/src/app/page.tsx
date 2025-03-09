import Link from 'next/link';
import { ArrowRight, VideoIcon, PencilIcon, VolumeIcon, SparklesIcon } from 'lucide-react';
import Image from 'next/image';

export default function Home() {
  return (
    <div className="space-y-24">
      {/* Hero Section */}
      <section className="py-12 md:py-24">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center">
            <div className="md:w-1/2 md:pr-12">
              <h1 className="text-4xl md:text-6xl font-bold text-gray-900 leading-tight mb-6">
                Transform Content into <span className="text-blue-600">Engaging Short Videos</span>
              </h1>
              <p className="text-xl text-gray-600 mb-8">
                Auto Shorts automatically creates engaging short-form videos from your online content in minutes. Perfect for social media, marketing, and more.
              </p>
              <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4">
                <Link 
                  href="/create" 
                  className="px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-center font-medium flex items-center justify-center"
                >
                  Create Your First Video
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
                <Link 
                  href="/demo" 
                  className="px-6 py-3 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors text-center font-medium"
                >
                  Watch Demo
                </Link>
              </div>
            </div>
            <div className="md:w-1/2 mt-12 md:mt-0">
              <div className="relative h-64 md:h-96 w-full rounded-lg overflow-hidden shadow-2xl">
                <div className="absolute inset-0 bg-gradient-to-r from-blue-600/20 to-purple-600/20 z-10"></div>
                {/* Placeholder for actual video/image */}
                <div className="absolute inset-0 bg-gray-200 flex items-center justify-center">
                  <VideoIcon className="h-20 w-20 text-gray-400" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How it Works Section */}
      <section className="py-12 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">How It Works</h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Create videos in just a few simple steps. No technical skills required.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-white p-8 rounded-lg shadow-md">
              <div className="h-14 w-14 bg-blue-100 rounded-full flex items-center justify-center mb-6">
                <PencilIcon className="h-7 w-7 text-blue-600" />
              </div>
              <h3 className="text-xl font-semibold mb-4">1. Submit Content</h3>
              <p className="text-gray-600">
                Paste a URL from your favorite platform or enter your own text.
              </p>
            </div>
            
            <div className="bg-white p-8 rounded-lg shadow-md">
              <div className="h-14 w-14 bg-blue-100 rounded-full flex items-center justify-center mb-6">
                <SparklesIcon className="h-7 w-7 text-blue-600" />
              </div>
              <h3 className="text-xl font-semibold mb-4">2. AI Enhancement</h3>
              <p className="text-gray-600">
                Our AI rewrites your content for maximum engagement and generates a natural-sounding voiceover.
              </p>
            </div>
            
            <div className="bg-white p-8 rounded-lg shadow-md">
              <div className="h-14 w-14 bg-blue-100 rounded-full flex items-center justify-center mb-6">
                <VideoIcon className="h-7 w-7 text-blue-600" />
              </div>
              <h3 className="text-xl font-semibold mb-4">3. Get Your Video</h3>
              <p className="text-gray-600">
                Download your completed video, ready to share on TikTok, Instagram, YouTube and more.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-12">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">Features</h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Everything you need to create professional short-form videos without the hassle.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            <div className="flex space-x-4">
              <div className="h-12 w-12 bg-blue-100 rounded-lg flex items-center justify-center shrink-0">
                <SparklesIcon className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <h3 className="text-xl font-semibold mb-2">AI-Powered Text Optimization</h3>
                <p className="text-gray-600">
                  Our AI rewrites your content to make it more engaging and suitable for short-form videos.
                </p>
              </div>
            </div>
            
            <div className="flex space-x-4">
              <div className="h-12 w-12 bg-blue-100 rounded-lg flex items-center justify-center shrink-0">
                <VolumeIcon className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <h3 className="text-xl font-semibold mb-2">Natural Voice Generation</h3>
                <p className="text-gray-600">
                  Convert your text to natural-sounding speech with a variety of voices and languages.
                </p>
              </div>
            </div>
            
            <div className="flex space-x-4">
              <div className="h-12 w-12 bg-blue-100 rounded-lg flex items-center justify-center shrink-0">
                <VideoIcon className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <h3 className="text-xl font-semibold mb-2">Automated Video Assembly</h3>
                <p className="text-gray-600">
                  Our system automatically combines visuals, text, and audio into a cohesive video.
                </p>
              </div>
            </div>
            
            <div className="flex space-x-4">
              <div className="h-12 w-12 bg-blue-100 rounded-lg flex items-center justify-center shrink-0">
                <ArrowRight className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <h3 className="text-xl font-semibold mb-2">One-Click Publishing</h3>
                <p className="text-gray-600">
                  Download your videos in multiple formats ready for any platform.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
      
      {/* CTA Section */}
      <section className="py-12 bg-blue-600 text-white">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Ready to create your first video?</h2>
          <p className="text-xl mb-8 opacity-90 max-w-2xl mx-auto">
            Join thousands of creators making engaging videos in minutes, not hours.
          </p>
          <Link 
            href="/create" 
            className="px-8 py-4 bg-white text-blue-600 rounded-md hover:bg-gray-100 transition-colors text-center font-medium inline-block"
          >
            Get Started for Free
          </Link>
        </div>
      </section>
    </div>
  );
}
