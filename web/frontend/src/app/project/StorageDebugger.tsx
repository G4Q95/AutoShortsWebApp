'use client';

import { useEffect, useState } from 'react';

/**
 * Storage debugger component that displays localStorage information
 * for debugging persistence issues.
 */
export default function StorageDebugger({ projectId }: { projectId?: string }) {
  const [storageData, setStorageData] = useState<Record<string, any>>({});
  const [audioData, setAudioData] = useState<any>(null);
  const [storageKeys, setStorageKeys] = useState<string[]>([]);
  
  useEffect(() => {
    // Function to safely parse JSON or return an error message
    const safeJsonParse = (str: string) => {
      try {
        return JSON.parse(str);
      } catch (err) {
        return { error: "Error parsing JSON", message: err instanceof Error ? err.message : String(err) };
      }
    };

    // Get all keys from localStorage
    const keys = Object.keys(localStorage);
    setStorageKeys(keys);
    
    // Filter and process project-related keys
    const projectKeys = keys.filter(k => 
      k.includes('project') || k.includes('auto-shorts')
    );
    
    // Extract data for each project key
    const data: Record<string, any> = {};
    for (const key of projectKeys) {
      const rawValue = localStorage.getItem(key);
      if (rawValue) {
        data[key] = safeJsonParse(rawValue);
      }
    }
    
    setStorageData(data);
    
    // If a specific projectId is provided, look for its audio data
    if (projectId) {
      // Try different possible storage key formats
      const possibleKeys = [
        `project_${projectId}`,
        `auto-shorts-project-${projectId}`,
        `project-${projectId}`
      ];
      
      for (const key of possibleKeys) {
        const rawData = localStorage.getItem(key);
        if (rawData) {
          try {
            const parsedData = JSON.parse(rawData);
            
            // Look for audio data within the project data
            if (parsedData.scenes && Array.isArray(parsedData.scenes)) {
              const scenesWithAudio = parsedData.scenes.filter(
                (scene: any) => scene && scene.audio
              );
              
              if (scenesWithAudio.length > 0) {
                setAudioData({
                  key,
                  audioFields: scenesWithAudio.map((scene: any, index: number) => ({
                    sceneIndex: index,
                    audioData: scene.audio
                  }))
                });
                break;
              }
            }
          } catch (e) {
            console.error("Error parsing project data:", e);
          }
        }
      }
    }
  }, [projectId]);

  return (
    <div className="bg-gray-100 p-4 my-4 rounded-md">
      <h2 className="text-lg font-bold mb-2">Storage Debugger</h2>
      
      <div className="mb-4">
        <h3 className="font-semibold">All localStorage Keys ({storageKeys.length})</h3>
        <ul className="text-xs bg-white p-2 rounded max-h-20 overflow-auto">
          {storageKeys.map(key => (
            <li key={key} className="mb-1">{key}</li>
          ))}
        </ul>
      </div>
      
      {projectId && (
        <div className="mb-4">
          <h3 className="font-semibold">Current Project ID</h3>
          <div className="bg-white p-2 rounded text-sm">{projectId}</div>
        </div>
      )}
      
      {audioData && (
        <div className="mb-4">
          <h3 className="font-semibold">Audio Data Found</h3>
          <div className="bg-white p-2 rounded text-xs overflow-auto max-h-40">
            <p><strong>Storage Key:</strong> {audioData.key}</p>
            <p><strong>Scenes with Audio:</strong> {audioData.audioFields.length}</p>
            {audioData.audioFields.map((field: any, idx: number) => (
              <div key={idx} className="mt-2 border-t pt-1">
                <p><strong>Scene {field.sceneIndex + 1}</strong></p>
                <p>Voice ID: {field.audioData.voice_id || field.audioData.voiceId}</p>
                <p>Voice Name: {field.audioData.name || field.audioData.voiceName}</p>
                <p>Has Base64: {field.audioData.base64 ? '✅' : '❌'}</p>
                <p>Base64 Length: {field.audioData.base64 ? field.audioData.base64.substring(0, 20) + '...' : 'N/A'}</p>
              </div>
            ))}
          </div>
        </div>
      )}
      
      <div>
        <h3 className="font-semibold">Project localStorage Data</h3>
        <pre className="bg-white p-2 rounded text-xs overflow-auto max-h-60">
          {JSON.stringify(storageData, null, 2)}
        </pre>
      </div>
    </div>
  );
} 