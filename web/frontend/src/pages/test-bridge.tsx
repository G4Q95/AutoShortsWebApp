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
  const [isReady, setIsReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusLogs, setStatusLogs] = useState<string[]>([]);

  const addStatusLog = useCallback((message: string) => {
    setStatusLogs(prev => [...prev.slice(-10), `[${new Date().toISOString()}] ${message}`]); // Keep last 10 logs
  }, []);

  // Video configuration
  const mediaUrl = "https://storage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4";
  const localMediaUrl = mediaUrl;

  const handleError = useCallback((err: Error) => {
    addStatusLog(`ERROR: ${err?.message || 'Unknown error'}`);
    setError(err?.message || 'Unknown error occurred');
    setTimeout(() => setError(null), 5000);
  }, [addStatusLog]);
  
  const handleInitialLoad = useCallback(() => {
    addStatusLog('Initial load callback triggered');
  }, [addStatusLog]);
  
  const handleIsReadyChange = useCallback((ready: boolean) => {
    addStatusLog(`isReady changed to: ${ready}`);
    setIsReady(ready);
  }, [addStatusLog]);

  // Initialize the bridge
  const bridge = useBridgeAdapter({
    canvasRef,
    videoRef,
    mediaUrl,
    localMediaUrl,
    mediaType: "video",
    initialMediaAspectRatio: 16/9,
    showFirstFrame: false, // Force immediate init
    onInitialLoad: handleInitialLoad,
    onError: handleError,
  });
  
  // Log bridge state changes
  useEffect(() => {
    addStatusLog(`Adapter State - isReady: ${bridge.isReady}, isInitializing: ${bridge.isInitializing}, hasError: ${bridge.hasError}, duration: ${bridge.duration?.toFixed(2)}`);
  }, [bridge.isReady, bridge.isInitializing, bridge.hasError, bridge.duration, addStatusLog]);
  
  useEffect(() => {
    setIsReady(bridge.isReady);
  }, [bridge.isReady]);

  // --- Add back Play/Pause handlers ---
  const handlePlay = () => {
    addStatusLog('handlePlay called');
    if (!isReady) {
      addStatusLog('Play attempted but not ready');
      setError('Video is not ready yet.');
      setTimeout(() => setError(null), 3000);
      return;
    }
    
    bridge.play().then(() => {
      addStatusLog('bridge.play() resolved successfully');
      setIsPlaying(true);
    }).catch(err => {
      const message = err instanceof Error ? err.message : String(err);
      addStatusLog(`bridge.play() FAILED: ${message}`);
      handleError(err instanceof Error ? err : new Error(String(err)));
    });
  };

  const handlePause = () => {
    addStatusLog('handlePause called');
    bridge.pause().then(() => {
      addStatusLog('bridge.pause() resolved successfully');
      setIsPlaying(false);
    }).catch(err => {
      const message = err instanceof Error ? err.message : String(err);
      addStatusLog(`bridge.pause() FAILED: ${message}`);
      handleError(err instanceof Error ? err : new Error(String(err)));
    });
  };
  // --- End Play/Pause handlers ---

  return (
    <>
      <p className="mb-4 text-gray-700">
        Minimal Bridge Test - Focusing on initialization & Play/Pause.
      </p>

      {/* Render both elements permanently for simplicity during init test */}
      <div className="mb-8 border rounded-lg overflow-hidden relative">
        <canvas 
          ref={canvasRef}
          className="w-full aspect-video block bg-gray-200"
        />
        <video
          ref={videoRef}
          className="w-full aspect-video absolute top-0 left-0 opacity-0 pointer-events-none" 
          poster="https://storage.googleapis.com/gtv-videos-bucket/sample/images/BigBuckBunny.jpg"
          preload="auto"
        />
        
        {error && (
          <div className="absolute inset-x-0 top-0 bg-red-500 text-white p-2 text-center">
            {error}
          </div>
        )}
      </div>

      {/* --- Add back Play/Pause Buttons --- */}
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
        </div>
      </div>
      {/* --- End Play/Pause Buttons --- */}

      <div className="mb-4">
        <h2 className="text-xl font-bold">Bridge Status</h2>
        <p>Component Ready State: {isReady ? 'Yes' : 'No'}</p>
        <p>Component Is Playing: {isPlaying ? 'Yes' : 'No'}</p>
        <p>Adapter isInitializing: {bridge.isInitializing ? 'Yes' : 'No'}</p>
        <p>Adapter Has Error: {bridge.hasError ? 'Yes' : 'No'}</p>
        {bridge.errorMessage && <p>Adapter Error Message: {bridge.errorMessage}</p>}
        <p>Adapter Duration: {bridge.duration?.toFixed(2) || 'N/A'}</p>
      </div>
      
      <div className="mt-4 border rounded p-2 bg-gray-50">
         <h3 className="font-bold text-lg mb-2">Status Logs</h3>
         <div className="font-mono text-xs space-y-1 max-h-40 overflow-y-auto">
            {statusLogs.map((log, index) => <div key={index}>{log}</div>)}
            {statusLogs.length === 0 && <div>No status logs yet...</div>}
         </div>
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