"use client";

import { useState, useEffect } from "react";
import { getAvailableVoices, generateVoice } from "@/lib/api-client";
import type { Voice } from "@/lib/api-types";

export default function VoiceTest() {
  const [apiKey, setApiKey] = useState<string>("");
  const [voices, setVoices] = useState<Voice[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedVoice, setSelectedVoice] = useState<string>("");
  const [text, setText] = useState<string>("Hello, this is a test of the voice generation system.");
  const [audioSrc, setAudioSrc] = useState<string | null>(null);
  const [generatingAudio, setGeneratingAudio] = useState<boolean>(false);

  const fetchVoices = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await getAvailableVoices();
      
      if (response.error) {
        setError(`Error fetching voices: ${response.error.message}`);
        setVoices([]);
      } else {
        setVoices(response.data.voices);
        if (response.data.voices.length > 0) {
          setSelectedVoice(response.data.voices[0].voice_id);
        }
      }
    } catch (err) {
      setError(`Error fetching voices: ${err instanceof Error ? err.message : String(err)}`);
      setVoices([]);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateVoice = async () => {
    if (!selectedVoice) {
      setError('Please select a voice first');
      return;
    }
    if (!text) {
      setError('Please enter some text to convert');
      return;
    }

    setError('');
    setGeneratingAudio(true);
    try {
      const response = await generateVoice({
        text,
        voice_id: selectedVoice,
        stability: 0.5,
        similarity_boost: 0.75,
        output_format: "mp3_44100_128"
      });
      
      if (response.error) {
        throw new Error(response.error.message);
      }
      
      // Create audio URL from base64 data
      const blob = new Blob(
        [Uint8Array.from(atob(response.data.audio_base64), c => c.charCodeAt(0))],
        { type: response.data.content_type }
      );
      const audioUrl = URL.createObjectURL(blob);
      setAudioSrc(audioUrl);
    } catch (err: any) {
      setError(`Error generating voice: ${err.message}`);
      setAudioSrc(null);
    } finally {
      setGeneratingAudio(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">ElevenLabs Voice API Test</h1>
      
      <div className="mb-8 p-6 border rounded-lg bg-gray-50">
        <h2 className="text-xl font-semibold mb-4">1. Test API Connection</h2>
        <div className="flex gap-4">
          <button
            onClick={fetchVoices}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            disabled={loading}
          >
            {loading ? "Loading..." : "Get Voices List"}
          </button>
        </div>
        
        {error && (
          <div className="mt-4 p-3 bg-red-100 border border-red-300 text-red-700 rounded">
            {error}
          </div>
        )}
      </div>
      
      {voices.length > 0 && (
        <div className="mb-8 p-6 border rounded-lg bg-gray-50">
          <h2 className="text-xl font-semibold mb-4">2. Generate Voice Sample</h2>
          
          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">Select Voice</label>
            <select
              value={selectedVoice}
              onChange={(e) => setSelectedVoice(e.target.value)}
              className="w-full p-2 border rounded"
            >
              {voices.map((voice) => (
                <option key={voice.voice_id} value={voice.voice_id}>
                  {voice.name} {voice.category ? `(${voice.category})` : ""}
                </option>
              ))}
            </select>
          </div>
          
          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">Text to Convert</label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="w-full p-2 border rounded min-h-[100px]"
              placeholder="Enter text to convert to speech..."
            />
          </div>
          
          <button
            onClick={handleGenerateVoice}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
            disabled={generatingAudio || !selectedVoice}
          >
            {generatingAudio ? "Generating..." : "Generate Voice"}
          </button>
          
          {audioSrc && (
            <div className="mt-6">
              <h3 className="text-lg font-semibold mb-2">Generated Audio</h3>
              <audio controls src={audioSrc} className="w-full">
                Your browser does not support the audio element.
              </audio>
            </div>
          )}
        </div>
      )}
      
      <div className="p-6 border rounded-lg bg-gray-50">
        <h2 className="text-xl font-semibold mb-4">Voice List</h2>
        {loading ? (
          <p>Loading voices...</p>
        ) : voices.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {voices.map((voice) => (
              <div key={voice.voice_id} className="p-4 border rounded">
                <h3 className="font-semibold">{voice.name}</h3>
                <p className="text-sm text-gray-600">{voice.description}</p>
                {voice.category && (
                  <span className="inline-block mt-1 px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                    {voice.category}
                  </span>
                )}
                <p className="mt-2 text-xs text-gray-500">ID: {voice.voice_id}</p>
              </div>
            ))}
          </div>
        ) : error ? (
          <p>No voices available. Please check the error above.</p>
        ) : (
          <p>Click "Get Voices List" to fetch available voices.</p>
        )}
      </div>
    </div>
  );
} 