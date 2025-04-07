import React from 'react';
import TestBridgePlayer from '../hooks/new/TestBridge';

export default function TestBridgePage() {
  return (
    <div className="container mx-auto p-8">
      <h1 className="text-2xl font-bold mb-6">Video Context Bridge Test</h1>
      <p className="mb-4 text-gray-700">
        This page tests the new VideoContextBridge implementation with a single source of truth and
        improved coordination between the bridge and component.
      </p>
      
      <div className="mb-8">
        <TestBridgePlayer 
          mediaUrl="https://storage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4"
          localMediaUrl="https://storage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4"
        />
      </div>
      
      <div className="mt-8 bg-gray-100 p-4 rounded-lg">
        <h2 className="text-lg font-semibold mb-2">Implementation Notes</h2>
        <ul className="list-disc pl-5 space-y-2">
          <li>The new bridge uses a single source of truth for state</li>
          <li>All methods return Promises for proper async handling</li>
          <li>The component ensures canvas is visible before attempting playback</li>
          <li>Canvas visibility is coordinated through the showFirstFrame prop</li>
          <li>The bridge exposes minimal state - just initialization and error status</li>
        </ul>
      </div>
    </div>
  );
} 