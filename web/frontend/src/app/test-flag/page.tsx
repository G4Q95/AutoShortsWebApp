'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';

export default function TestFlagPage() {
  const [clientFlag, setClientFlag] = useState<string>('loading...');
  const [testingMode, setTestingMode] = useState<string>('loading...');
  
  useEffect(() => {
    setClientFlag(process.env.NEXT_PUBLIC_USE_NEW_VIDEO_PLAYER || 'undefined');
    setTestingMode(process.env.NEXT_PUBLIC_TESTING_MODE || 'undefined');
  }, []);
  
  return (
    <div className="container mx-auto p-8">
      <h1 className="text-2xl font-bold mb-4">Feature Flag Test Page</h1>
      
      <div className="bg-white p-4 shadow rounded mb-4">
        <h2 className="text-xl font-semibold mb-2">Environment Variables</h2>
        <ul className="space-y-2">
          <li>
            <strong>NEXT_PUBLIC_USE_NEW_VIDEO_PLAYER:</strong> 
            <span className={`ml-2 px-2 py-1 rounded ${clientFlag === 'true' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
              {clientFlag}
            </span>
          </li>
          <li>
            <strong>NEXT_PUBLIC_TESTING_MODE:</strong> 
            <span className={`ml-2 px-2 py-1 rounded ${testingMode === 'true' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'}`}>
              {testingMode}
            </span>
          </li>
          <li>
            <strong>useNewVideoPlayer evaluation:</strong> 
            <span className={`ml-2 px-2 py-1 rounded ${
              clientFlag === 'true' && testingMode !== 'true' 
                ? 'bg-green-100 text-green-800' 
                : 'bg-red-100 text-red-800'
            }`}>
              {clientFlag === 'true' && testingMode !== 'true' ? 'true' : 'false'}
            </span>
          </li>
        </ul>
      </div>
      
      <div className="mt-4">
        <Link href="/" className="text-blue-600 hover:text-blue-800">
          Back to home
        </Link>
      </div>
    </div>
  );
} 