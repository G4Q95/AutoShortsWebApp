import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useBridgeAdapter } from '@/hooks/new/useBridgeAdapter';

export default function TestBridgePage() {
  const [activeTab, setActiveTab] = useState<'html5' | 'bridge' | 'debug'>('html5');
  
  return (
    <div className="container mx-auto p-8">
      <h1 className="text-2xl font-bold mb-6">Video Context Bridge Test</h1>
      
      <div className="mb-4">
        <div className="flex border-b">
          <button 
            className={`py-2 px-4 ${activeTab === 'html5' ? 'border-b-2 border-blue-500 font-medium' : 'text-gray-500'}`}
            onClick={() => setActiveTab('html5')}
            data-tab="html5"
          >
            HTML5 Video
          </button>
          <button 
            className={`py-2 px-4 ${activeTab === 'bridge' ? 'border-b-2 border-blue-500 font-medium' : 'text-gray-500'}`}
            onClick={() => setActiveTab('bridge')}
            data-tab="bridge"
          >
            Bridge Implementation
          </button>
          <button 
            className={`py-2 px-4 ${activeTab === 'debug' ? 'border-b-2 border-blue-500 font-medium' : 'text-gray-500'}`}
            onClick={() => setActiveTab('debug')}
            data-tab="debug"
          >
            Debug Mode
          </button>
        </div>
      </div>
      
      {activeTab === 'html5' ? <Html5VideoTest /> : 
       activeTab === 'bridge' ? <BridgeVideoTest /> : 
       <BridgeDebugTest />}
    </div>
  );
}

function Html5VideoTest() {
  const [videoLoaded, setVideoLoaded] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (video) {
      const handleLoaded = () => {
        console.log('Video loaded successfully');
        setVideoLoaded(true);
      };

      const handleError = (e: any) => {
        console.error('Error loading video:', e);
      };

      video.addEventListener('loadeddata', handleLoaded);
      video.addEventListener('error', handleError);

      return () => {
        video.removeEventListener('loadeddata', handleLoaded);
        video.removeEventListener('error', handleError);
      };
    }
  }, []);

  return (
    <>
      <p className="mb-4 text-gray-700">
        This tab tests video playback using a direct HTML5 video element before
        we move to the more complex VideoContext implementation.
      </p>

      <div className="mb-8 border rounded-lg overflow-hidden">
        <video 
          ref={videoRef}
          className="w-full aspect-video"
          src="https://storage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4"
          poster="https://storage.googleapis.com/gtv-videos-bucket/sample/images/BigBuckBunny.jpg"
          controls
          preload="auto"
        />
      </div>

      <div className="mb-4">
        <h2 className="text-xl font-bold">Video Status</h2>
        <p>Loaded: {videoLoaded ? 'Yes' : 'No'}</p>
        {videoRef.current && (
          <>
            <p>Duration: {videoRef.current.duration?.toFixed(2) || 0} seconds</p>
            <p>Ready State: {videoRef.current.readyState}</p>
          </>
        )}
      </div>

      <div className="mt-8 bg-gray-100 p-4 rounded-lg">
        <h2 className="text-lg font-semibold mb-2">Implementation Notes</h2>
        <ul className="list-disc pl-5 space-y-2">
          <li>We're starting with a direct HTML5 video implementation for baseline testing</li>
          <li>Once this works, we'll move to our custom bridge implementation</li>
          <li>This helps isolate VideoContext issues from basic playback issues</li>
        </ul>
      </div>
    </>
  );
}

function BridgeVideoTest() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  
  // Video configuration
  const mediaUrl = "https://storage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4";
  const localMediaUrl = mediaUrl; // Same URL for local and remote in this test
  
  // Custom callbacks for the bridge
  const handleTimeUpdate = useCallback((time: number) => {
    setCurrentTime(time);
  }, []);
  
  const handleDurationChange = useCallback((newDuration: number) => {
    setDuration(newDuration);
  }, []);
  
  const handleIsReadyChange = useCallback((ready: boolean) => {
    console.log(`Bridge ready state changed to: ${ready}`);
    setIsReady(ready);
  }, []);
  
  const handleError = useCallback((err: Error) => {
    console.error('Bridge error:', err);
    setError(err?.message || 'Unknown error occurred');
    
    // Clear error after 5 seconds
    setTimeout(() => setError(null), 5000);
  }, []);
  
  // Initialize the bridge with required props
  const bridge = useBridgeAdapter({
    canvasRef,
    videoRef,
    mediaUrl,
    localMediaUrl,
    mediaType: "video",
    initialMediaAspectRatio: 16/9,
    showFirstFrame: true,
    onInitialLoad: () => console.log('Initial load complete'),
    onError: handleError,
  });
  
  // Subscribe to bridge state changes
  useEffect(() => {
    setCurrentTime(bridge.currentTime);
  }, [bridge.currentTime]);
  
  useEffect(() => {
    setDuration(bridge.duration);
  }, [bridge.duration]);
  
  useEffect(() => {
    setIsReady(bridge.isReady);
  }, [bridge.isReady]);

  // Custom play/pause handlers
  const handlePlay = () => {
    console.log('Play button clicked');
    if (!isReady) {
      setError('Video is not ready yet. Please wait...');
      setTimeout(() => setError(null), 3000);
      return;
    }
    
    bridge.play().then(() => {
      setIsPlaying(true);
    }).catch(err => {
      console.error('Error playing video:', err);
      setError('Failed to play video');
      setTimeout(() => setError(null), 3000);
    });
  };

  const handlePause = () => {
    console.log('Pause button clicked');
    bridge.pause().then(() => {
      setIsPlaying(false);
    }).catch(err => {
      console.error('Error pausing video:', err);
      setError('Failed to pause video');
      setTimeout(() => setError(null), 3000);
    });
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    bridge.seek(time).catch(err => {
      console.error('Error seeking:', err);
      setError('Failed to seek to position');
      setTimeout(() => setError(null), 3000);
    });
  };

  return (
    <>
      <p className="mb-4 text-gray-700">
        This tab tests video playback using our custom VideoContextBridge implementation.
      </p>

      <div className="mb-8 border rounded-lg overflow-hidden relative">
        {/* Hidden canvas for bridge operations */}
        <canvas 
          ref={canvasRef}
          className="w-full aspect-video"
          style={{ display: isPlaying ? 'block' : 'none' }}
        />
        
        {/* Video element that the bridge will control */}
        <video
          ref={videoRef}
          className="w-full aspect-video"
          style={{ display: !isPlaying ? 'block' : 'none' }}
          poster="https://storage.googleapis.com/gtv-videos-bucket/sample/images/BigBuckBunny.jpg"
          preload="auto"
        />
        
        {error && (
          <div className="absolute inset-x-0 top-0 bg-red-500 text-white p-2 text-center">
            {error}
          </div>
        )}
      </div>

      <div className="mb-6 space-y-4">
        <div className="flex space-x-4">
          {!isPlaying ? (
            <button 
              onClick={handlePlay}
              className={`px-4 py-2 rounded ${isReady ? 'bg-blue-500 hover:bg-blue-600 text-white' : 'bg-gray-300 text-gray-500 cursor-not-allowed'}`}
              disabled={!isReady}
            >
              Play
            </button>
          ) : (
            <button 
              onClick={handlePause}
              className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded"
            >
              Pause
            </button>
          )}
          
          <div className="flex-1 flex items-center space-x-2">
            <span>{Math.floor(currentTime / 60)}:{Math.floor(currentTime % 60).toString().padStart(2, '0')}</span>
            <input
              type="range"
              min="0"
              max={duration || 100}
              value={currentTime}
              onChange={handleSeek}
              className="flex-1"
              disabled={!isReady}
            />
            <span>{Math.floor(duration / 60)}:{Math.floor(duration % 60).toString().padStart(2, '0')}</span>
          </div>
        </div>
      </div>

      <div className="mb-4">
        <h2 className="text-xl font-bold">Bridge Status</h2>
        <p>Ready: {isReady ? 'Yes' : 'No'}</p>
        <p>Playing: {isPlaying ? 'Yes' : 'No'}</p>
        <p>Current Time: {currentTime.toFixed(2)} seconds</p>
        <p>Duration: {duration.toFixed(2)} seconds</p>
        <p>Initializing: {bridge.isInitializing ? 'Yes' : 'No'}</p>
        <p>Has Error: {bridge.hasError ? 'Yes' : 'No'}</p>
        {bridge.errorMessage && <p>Error: {bridge.errorMessage}</p>}
      </div>

      <div className="mt-8 bg-gray-100 p-4 rounded-lg">
        <h2 className="text-lg font-semibold mb-2">Implementation Notes</h2>
        <ul className="list-disc pl-5 space-y-2">
          <li>This implementation uses our custom VideoContextBridge</li>
          <li>It handles play/pause and seeking through the bridge adapter</li>
          <li>The bridge manages the video element and reports its state back</li>
          <li>This simpler implementation helps isolate issues from the complex player UI</li>
        </ul>
      </div>
    </>
  );
}

function BridgeDebugTest() {
  // A simplified version to debug bridge initialization
  const [logs, setLogs] = useState<string[]>([]);
  const [videoContext, setVideoContext] = useState<any>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  
  const addLog = useCallback((message: string) => {
    setLogs(prev => [...prev, `[${new Date().toISOString()}] ${message}`]);
  }, []);

  // Monitor console logs
  useEffect(() => {
    // Save original console methods
    const originalLog = console.log;
    const originalError = console.error;
    const originalWarn = console.warn;
    
    // Override console methods to capture logs
    console.log = (...args) => {
      originalLog.apply(console, args);
      const message = args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
      ).join(' ');
      
      if (message.includes('[Bridge]') || message.includes('[BridgeAdapter]')) {
        addLog(`LOG: ${message}`);
      }
    };
    
    console.error = (...args) => {
      originalError.apply(console, args);
      const message = args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
      ).join(' ');
      
      if (message.includes('[Bridge]') || message.includes('[BridgeAdapter]')) {
        addLog(`ERROR: ${message}`);
      }
    };
    
    console.warn = (...args) => {
      originalWarn.apply(console, args);
      const message = args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
      ).join(' ');
      
      if (message.includes('[Bridge]') || message.includes('[BridgeAdapter]')) {
        addLog(`WARN: ${message}`);
      }
    };
    
    // Restore original methods on cleanup
    return () => {
      console.log = originalLog;
      console.error = originalError;
      console.warn = originalWarn;
    };
  }, [addLog]);

  // Try to load VideoContext directly
  useEffect(() => {
    addLog('Starting VideoContext initialization test');
    
    const initTest = async () => {
      try {
        addLog('Importing VideoContext');
        const VideoContextModule = await import('videocontext');
        const VideoContext = VideoContextModule.default || VideoContextModule;
        addLog('VideoContext imported successfully');
        
        if (!canvasRef.current) {
          addLog('ERROR: Canvas reference is not available');
          return;
        }
        
        addLog('Setting up canvas dimensions');
        const canvas = canvasRef.current;
        canvas.width = 1280;
        canvas.height = 720;
        
        addLog('Creating VideoContext instance');
        const ctx = new VideoContext(canvas);
        if (!ctx) {
          addLog('ERROR: Failed to create VideoContext instance');
          return;
        }
        
        setVideoContext(ctx);
        addLog('VideoContext created successfully');
        
        // Try to create a video source
        const testUrl = 'https://storage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4';
        addLog(`Creating video source with URL: ${testUrl}`);
        
        const source = ctx.video(testUrl);
        if (!source) {
          addLog('ERROR: Failed to create video source');
          return;
        }
        
        addLog('Video source created successfully');
        
        // Register callbacks
        source.registerCallback('loaded', () => {
          addLog('Video source loaded successfully');
          
          if (source && source.element) {
            const videoElement = source.element as HTMLVideoElement;
            addLog(`Video duration: ${videoElement.duration}`);
          }
        });
        
        // Cast the error callback to 'any' to avoid TypeScript errors
        // The VideoContext types are not properly defined
        source.registerCallback('error', (function(err: any) {
          addLog(`ERROR in video source: ${err?.message || 'Unknown error'}`);
        }) as any);
        
        // Connect to destination
        addLog('Connecting source to destination');
        source.connect(ctx.destination);
        source.start(0);
        source.stop(300);
        
        addLog('Source connected and scheduled');
        
        // Add play/pause methods for testing
        window.testPlay = () => {
          addLog('Play method called');
          ctx.play();
          setIsPlaying(true);
        };
        
        window.testPause = () => {
          addLog('Pause method called');
          ctx.pause();
          setIsPlaying(false);
        };
      } catch (error) {
        addLog(`EXCEPTION: ${error instanceof Error ? error.message : String(error)}`);
        console.error('VideoContext test error:', error);
      }
    };
    
    initTest();
    
    // Clean up
    return () => {
      if (window.testPlay) {
        delete window.testPlay;
      }
      if (window.testPause) {
        delete window.testPause;
      }
    };
  }, [addLog]);
  
  // Add test window types
  useEffect(() => {
    if (!window.testPlay && videoContext) {
      window.testPlay = () => {
        addLog('Play method called');
        videoContext.play();
        setIsPlaying(true);
      };
    }
    if (!window.testPause && videoContext) {
      window.testPause = () => {
        addLog('Pause method called');
        videoContext.pause();
        setIsPlaying(false);
      };
    }
    
    return () => {
      if (window.testPlay) {
        delete window.testPlay;
      }
      if (window.testPause) {
        delete window.testPause;
      }
    };
  }, [videoContext, addLog]);
  
  const handlePlay = useCallback(() => {
    if (window.testPlay) {
      window.testPlay();
    }
  }, []);
  
  const handlePause = useCallback(() => {
    if (window.testPause) {
      window.testPause();
    }
  }, []);
  
  const clearLogs = useCallback(() => {
    setLogs([]);
  }, []);
  
  return (
    <>
      <div className="mb-4 p-4 bg-gray-100 rounded">
        <h2 className="text-xl font-bold mb-2">VideoContext Debug Test</h2>
        <p>This test attempts to initialize the VideoContext and logs detailed steps.</p>
        <p className="mt-2 text-sm text-gray-600">It also captures Bridge implementation logs from our custom hook.</p>
      </div>
      
      <div className="mb-4 flex space-x-2">
        {!isPlaying ? (
          <button 
            onClick={handlePlay}
            className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded"
          >
            Test Play
          </button>
        ) : (
          <button 
            onClick={handlePause}
            className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded"
          >
            Test Pause
          </button>
        )}
        
        <button 
          onClick={clearLogs}
          className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded"
        >
          Clear Logs
        </button>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
        <div className="border rounded overflow-hidden">
          <div className="p-2 bg-gray-200 font-medium">Canvas</div>
          <canvas 
            ref={canvasRef}
            className="w-full aspect-video"
          />
        </div>
        
        <div className="border rounded overflow-hidden">
          <div className="p-2 bg-gray-200 font-medium">Debug Logs</div>
          <div className="p-4 bg-black text-green-400 font-mono text-sm h-96 overflow-y-auto">
            {logs.map((log, index) => (
              <div key={index} className={`whitespace-pre-wrap mb-1 ${log.includes('ERROR') ? 'text-red-400' : log.includes('WARN') ? 'text-yellow-400' : ''}`}>{log}</div>
            ))}
            {logs.length === 0 && <div className="text-gray-500">No logs yet...</div>}
          </div>
        </div>
      </div>
      
      <div className="mb-4">
        <button 
          onClick={() => {
            addLog('------------ Testing Bridge Tab ------------');
            document.querySelector('button[data-tab="bridge"]')?.dispatchEvent(new Event('click'));
          }}
          className="bg-purple-500 hover:bg-purple-600 text-white px-4 py-2 rounded"
        >
          Test Bridge Tab Implementation
        </button>
      </div>
      
      <div className="mt-4">
        <h3 className="font-bold text-lg mb-2">VideoContext Status</h3>
        <p>Instance Created: {videoContext ? 'Yes' : 'No'}</p>
        <p>Is Playing: {isPlaying ? 'Yes' : 'No'}</p>
      </div>
    </>
  );
}

// Add TypeScript declarations for window methods
declare global {
  interface Window {
    testPlay?: () => void;
    testPause?: () => void;
  }
} 