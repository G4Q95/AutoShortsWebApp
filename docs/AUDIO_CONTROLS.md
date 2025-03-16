# Audio Control System Architecture

This document outlines the audio control system architecture implemented in the Auto Shorts Web App, focusing on the components, contexts, and interaction patterns.

## Overview

The audio control system is designed to provide a consistent and synchronized experience for audio playback across all scenes in a project. The architecture ensures that:

1. Only one scene's audio plays at a time
2. Volume settings are consistent across scenes
3. Voice selection preferences are maintained
4. The UI transitions smoothly between pre-audio and post-audio states

## Core Components

### Context Providers

#### AudioContext

The `AudioContext` provides global state management for audio playback, including:

- Current playing status (playing/paused)
- Currently playing scene ID
- Global volume setting

```tsx
// Key AudioContext interface
interface AudioContextType {
  audioState: {
    isPlaying: boolean;
    currentPlayingId: string | null;
    volume: number;
  };
  setAudioPlaying: (isPlaying: boolean, id?: string | null) => void;
  setAudioVolume: (volume: number) => void;
}
```

#### VoiceContext

The `VoiceContext` manages voice selection across the application:

- Available voices list
- Currently selected voice
- Voice selection state

```tsx
// Key VoiceContext interface
interface VoiceContextType {
  voices: Voice[];
  selectedVoice: string;
  setSelectedVoice: (voiceId: string) => void;
}
```

### UI Components

#### SceneAudioControls

The main component for scene-specific audio controls with these features:

- Flip animation between pre-audio and post-audio states
- Voice selection dropdown
- Generate/regenerate functionality
- Audio playback controls
- Volume slider
- Settings popup for advanced options

```tsx
// Key SceneAudioControls props
interface SceneAudioControlsProps {
  sceneId: string;
  audioSource?: string;
  audioButtonText?: string;
  isGeneratingAudio?: boolean;
  onGenerateClick: () => void;
  onRegenerateClick: () => void;
  onVoiceChange?: (voice: string) => void;
  onRateChange?: (rate: number) => void;
  className?: string;
}
```

#### AudioPlayerControls

A reusable component for audio playback controls:

- Play/pause button
- Time display (current/duration)
- Volume slider
- Regenerate button
- Settings button

```tsx
// Key AudioPlayerControls props
interface AudioPlayerControlsProps {
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  volume: number;
  onPlayPause: () => void;
  onVolumeChange: (volume: number) => void;
  onRegenerate: () => void;
  onShowSettings: () => void;
  isGenerating: boolean;
  settingsButtonRef?: React.RefObject<HTMLButtonElement>;
}
```

## Key Interactions

### Audio Playback Synchronization

1. When a scene's audio starts playing, the `AudioContext` is updated with the current scene's ID
2. The context automatically pauses any other playing audio when a new scene starts playing
3. Each scene subscribes to the `AudioContext` to know when it should play or pause

```tsx
// Example of audio synchronization code
useEffect(() => {
  if (!audioRef.current) return;
  
  if (isThisAudioPlaying && audioRef.current.paused) {
    audioRef.current.play().catch(console.error);
  } else if (!isThisAudioPlaying && !audioRef.current.paused) {
    audioRef.current.pause();
  }
}, [isThisAudioPlaying, sceneId]);
```

### Volume Control

1. Volume changes are shared across all scenes via the `AudioContext`
2. When volume is adjusted in one scene, all scenes receive the update
3. New audio elements automatically adopt the current volume setting

```tsx
// Example of volume synchronization
useEffect(() => {
  if (audioRef.current) {
    audioRef.current.volume = audioState.volume;
    setVolume(audioState.volume);
  }
}, [audioState.volume]);
```

### Voice Selection

1. Voice preferences are managed through the `VoiceContext`
2. Default voice is set at the application level
3. Individual scenes can override the default voice
4. Voice settings are preserved between sessions

## UI States

### Pre-Audio Generation

Before audio is generated, the component shows:
- "Generate Voiceover" button with microphone icon
- Voice selection dropdown
- Green background matching the project theme

### Post-Audio Generation

After audio is generated, the component shows:
- Play/pause button
- Time display (current/duration)
- Volume slider
- Regenerate button
- Settings button

### Flip Animation

The transition between pre-audio and post-audio states uses a 3D flip animation:
1. The container has a perspective property for 3D effect
2. The front and back faces are positioned absolutely within the container
3. A 180-degree rotation on the X-axis creates the flip effect
4. `backfaceVisibility: 'hidden'` ensures only one face is visible at a time

## Implementation Benefits

This architecture provides several benefits:

1. **Consistency**: Audio behavior is predictable and consistent across the application
2. **Reusability**: Components are modular and can be reused in different contexts
3. **State Management**: Global state is properly managed through React contexts
4. **User Experience**: Smooth transitions and intuitive controls enhance usability
5. **Maintainability**: Clear separation of concerns makes the code easier to maintain

## Future Enhancements

Potential improvements to the audio control system:

1. **Waveform Visualization**: Add audio waveform display for visual feedback
2. **Timing Markers**: Add markers for synchronizing audio with visual content
3. **Advanced Voice Controls**: Expand voice customization options
4. **Batch Audio Generation**: Add ability to generate audio for multiple scenes at once
5. **Background Music**: Add support for background music tracks with mixing controls 