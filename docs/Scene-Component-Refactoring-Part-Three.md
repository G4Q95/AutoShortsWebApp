# Scene Component Refactoring Plan - Final Approach

## Current Structure

do not commit without me saying

The Scene component has grown to almost 2000 lines of code, making it difficult to maintain, extend, and debug. It currently handles multiple responsibilities:

- Media display and controls
- Text content display and editing
- Voice generation and audio controls
- Scene card layout and management

## Challenges from Previous Refactoring Attempts

Our previous refactoring attempt (documented in Scene-Component-Refactoring-Part-Two.md) reached approximately 97% completion but ultimately failed during final integration. Key challenges we encountered:

1. **Tightly Coupled Functionality**: The components are deeply interconnected on the same scene card:
   - Media playback state affects audio controls
   - Text editing requires coordination with voice generation
   - Voice generation depends on current text content
   - Scene card layout affects all other components

2. **Shared State Management Issues**: 
   - Duplicate state variables created across components
   - State synchronization problems between components
   - Event handlers with mismatched dependencies
   - Timing issues between component initialization

3. **Integration Failures**:
   - Voice settings became disconnected from audio generation
   - Audio controls lost synchronization with audio state
   - Media player functionality was disrupted when separated from core state
   - Multiple audio elements causing conflicts

4. **Boundary Problems**:
   - The original separation points didn't respect natural coupling in the codebase
   - Tightly coupled features (like audio generation and audio controls) were placed in different files
   - CSS and styling became fragmented and lost consistency

These challenges highlight why a more carefully planned approach is necessary for the current refactoring effort.

## Revised Approach: Code Splitting Without Component Extraction

After multiple attempts at component extraction that broke functionality, we're adopting a radically different approach. Instead of breaking the SceneComponent into separate React components, we'll keep the component intact while organizing the code into logical modules.

### Key Principles

1. **Preserve Component Structure**: Maintain the SceneComponent as a single component to preserve the exact DOM structure and styling
2. **Extract Functions Only**: Move related functions, state hooks, and render methods to separate files
3. **No Component Boundaries**: Avoid creating new React component boundaries that could affect event propagation or styling
4. **Zero Impact on UI**: Ensure the refactoring has absolutely no visual or behavioral impact

### Implementation Structure

```
src/
  components/
    project/
      SceneComponent.tsx  (remains as the main component)
      scene-functions/
        voice-functions.ts  (voice-related logic and rendering)
        text-functions.ts   (text editing logic and rendering)
        media-functions.ts  (media player logic and rendering)
        container-functions.ts (scene card container logic)
```

### Example Implementation

```tsx
// SceneComponent.tsx - Remains the single component
import { 
  useVoiceLogic, 
  renderVoiceControls 
} from './scene-functions/voice-functions';

import {
  useTextEditing,
  renderTextContent
} from './scene-functions/text-functions';

export const SceneComponent = ({ /* props */ }) => {
  // Core component state remains here
  
  // Import logic as hooks
  const voiceState = useVoiceLogic(scene);
  const textState = useTextEditing(scene);
  
  return (
    <div className="scene-card">
      {/* Original JSX structure preserved exactly */}
      <div className="text-section">
        {renderTextContent(textState)}
      </div>
      <div className="voice-section">
        {renderVoiceControls(voiceState)}
      </div>
    </div>
  );
};

// voice-functions.ts
export function useVoiceLogic(scene) {
  // Voice-related state
  const [voiceId, setVoiceId] = useState<string>(scene.voice_settings?.voice_id || "");
  const [audioSrc, setAudioSrc] = useState<string | null>(
    scene.audio?.persistentUrl || scene.audio?.audio_url || null
  );
  // Voice-related handlers
  const handleGenerateVoice = async () => { /* implementation */ };
  
  return {
    voiceId, setVoiceId,
    audioSrc,
    handleGenerateVoice,
    // Other state and handlers
  };
}

export function renderVoiceControls(voiceState) {
  // Return JSX for voice controls using the provided state
  return (
    <div className="voice-controls">
      {/* Voice control JSX */}
    </div>
  );
}
```

### Benefits of This Approach

1. **Zero Risk to Functionality**: The component remains whole with exact same DOM structure and event flow
2. **Better Organization**: Code is logically grouped in separate files for better maintainability
3. **No Prop Drilling**: No need to pass state through complex prop chains
4. **Simplified Testing**: No changes to UI structure means no risk of visual regression
5. **Migration Path**: This approach sets the foundation for potential future component extraction

### Implementation Strategy

1. **Extract Function Groups**: Identify logical function groupings:
   - Voice generation and controls
   - Text editing and display
   - Media player and controls
   - Container and layout management

2. **Extract One Group at a Time**:
   - Start with the most self-contained group (likely voice or text functions)
   - Move functions, then integrate them back with imports
   - Test thoroughly after each group extraction

3. **Code Review Focus**:
   - Ensure all function dependencies are properly imported
   - Verify no duplicate state is created
   - Check for any changes to component behavior

### Success Metrics

- No visual changes to the scene card
- No changes to component functionality
- Reduced file sizes and improved readability
- Preserved event handling and state management
- Passing test suite without modifications

### Current Implementation Status (May 2024)

We are adopting this new approach after traditional component extraction has repeatedly broken functionality. The next steps are:

1. Create the scene-functions directory structure
2. Extract voice-related functions first
3. Extract text-editing functions next
4. Extract media-related functions last
5. Ensure all tests pass with no behavioral changes

## Previous Approach (For Reference)

Our previous four-component approach is documented below for reference. This approach has been superseded by the code splitting without component extraction strategy.

### Four-Component Approach (Previous Plan)

We will refactor the Scene component into four distinct functional components, acknowledging their interconnected nature:
 
### 1. SceneCard
- **Purpose**: Container component that manages overall layout and core functionality
- **Responsibilities**:
  - Scene identification (number indicator in top left)
  - Info button revealing Reddit URL
  - Delete/trash bin functionality
  - Drag handle for reordering
  - Animation and transition effects
  - Container for other components

### 2. VideoPlayer
- **Purpose**: Handle all media display and controls
- **Responsibilities**:
  - Video/image display and controls
  - Media sizing and aspect ratio handling
  - Gallery navigation for multiple media
  - Compact/expanded view modes
  - Media trimming controls
  - Fullscreen functionality

### 3. TextEditor
- **Purpose**: Handle text content display and editing
- **Responsibilities**:
  - Text content display and editing
  - Word counting
  - Text expansion/collapse controls
  - Edit mode toggle
  - Save/cancel controls for text edits
  - (Future) Integration point for AI text rewriting

### 4. VoiceOverControls
- **Purpose**: Manage ElevenLabs voice generation and audio playback
- **Responsibilities**:
  - Voice selection dropdown
  - Generate voiceover button
  - Audio player controls
  - Voice settings panel
  - Progress indicators
  - Playback speed controls

## Component Structure

```
┌─────────────────────────────────────────────┐
│               SCENE CARD                    │
│ (Contains scene number, delete button, etc) │
├─────────────────────────────────────────────┤
│                                             │
│               VIDEO PLAYER                  │
│       (Media display and controls)          │
│                                             │
├─────────────────────────────────────────────┤
│                                             │
│               TEXT EDITOR                   │
│      (Content editing and display)          │
│                                             │
├─────────────────────────────────────────────┤
│                                             │
│            VOICE OVER CONTROLS              │
│     (ElevenLabs integration and audio)      │
│                                             │
└─────────────────────────────────────────────┘
```

## Implementation Strategy

1. **Start with the VideoPlayer Component**
   - Most self-contained with clearer boundaries
   - Likely to grow with new features
   - Easier to isolate for testing

2. **Use Feature Flags**
   - Allow switching between old and new implementations
   - Enable side-by-side testing
   - Example:
     ```tsx
     const useNewVideoPlayer = process.env.NEXT_PUBLIC_USE_NEW_VIDEO_PLAYER || false;
     
     {useNewVideoPlayer ? (
       <VideoPlayer {...videoPlayerProps} />
     ) : (
       /* Original video player JSX */
     )}
     ```

3. **Create a Shared Context for State**
   - Manage shared state between components
   - Avoid excessive prop drilling
   - Example:
     ```tsx
     const SceneContext = createContext<SceneContextType | undefined>(undefined);
     
     function SceneProvider({ children, initialState }) {
       // State management logic here
       return (
         <SceneContext.Provider value={contextValue}>
           {children}
         </SceneContext.Provider>
       );
     }
     ```

4. **Extract Components One at a Time**
   - Complete and test each component before moving to the next
   - Order: VideoPlayer → TextEditor → VoiceOverControls → SceneCard

## Testing Approach

1. **Shadow Implementation**
   - Build new components alongside the original
   - Toggle between implementations for testing
   - Compare behavior between old and new versions

2. **Incremental Testing**
   - Test each component individually as it's developed
   - Verify key functionality before moving to the next component
   - Use URL parameters to enable/disable new components during testing

3. **Visual and Functional Validation**
   - Compare visual rendering between implementations
   - Test each feature with real user scenarios
   - Validate state consistency between components

## Component Interconnections and Data Flow

Understanding how these components interconnect is crucial, as their tight coupling is what made previous refactoring attempts challenging. All components exist on the same scene card and share state and functionality:

```
┌───────────────────────────────────────────────────────────────┐
│                        SCENE CARD                             │
│                                                               │
│  ┌────────────────────────────────────────────────────────┐   │
│  │                     VIDEO PLAYER                       │   │
│  └─────────────────────────┬──────────────────────────────┘   │
│                            │                                   │
│                            ▼                                   │
│  ┌────────────────────────────────────────────────────────┐   │
│  │                     TEXT EDITOR                        │   │
│  └─────────────────────────┬──────────────────────────────┘   │
│                            │                                   │
│                            ▼                                   │
│  ┌────────────────────────────────────────────────────────┐   │
│  │                  VOICE OVER CONTROLS                   │   │
│  └────────────────────────────────────────────────────────┘   │
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

### Key Data Dependencies

1. **VideoPlayer ↔ TextEditor**
   - Media duration affects text-to-audio timing
   - Media trim points need to align with text content

2. **TextEditor ↔ VoiceOverControls**
   - Text content is used for voice generation
   - Word count affects audio duration estimation
   - Text edits may require regenerating audio

3. **VoiceOverControls ↔ VideoPlayer**
   - Audio playback syncs with video playback
   - Play/pause state is shared between them
   - Audio duration may influence media trim points

4. **SceneCard ↔ All Components**
   - Manages lifecycle of all components
   - Handles animation states affecting rendering
   - Controls expansion/collapse affecting all layouts

### State Management Strategy

To handle these interconnections effectively, we'll use a combination of:

1. **Shared Context**
   - Core state accessible to all components
   - Centralized update logic
   - Consistent state synchronization

2. **Event-Based Communication**
   - Components emit events for significant changes
   - Other components react to these events
   - Reduces direct dependencies

3. **Clear Interface Boundaries**
   - Well-defined props for each component
   - Explicit callback patterns
   - Documentation of expected behavior

This understanding of data flow and dependencies will help us avoid the pitfalls of the previous refactoring attempt.

## Implementation Plan for VideoPlayer Component

1. **Identify Related State Variables**
   ```tsx
   const [mediaUrl, setMediaUrl] = useState("");
   const [mediaType, setMediaType] = useState("unknown");
   const [isPlaying, setIsPlaying] = useState(false);
   const [duration, setDuration] = useState(0);
   const [currentTime, setCurrentTime] = useState(0);
   const [isFullscreen, setIsFullscreen] = useState(false);
   // etc.
   ```

2. **Extract Related Functions**
   ```tsx
   const handlePlay = () => { /* ... */ };
   const handlePause = () => { /* ... */ };
   const handleSeek = (time) => { /* ... */ };
   const toggleFullscreen = () => { /* ... */ };
   // etc.
   ```

3. **Define Component Interface**
   ```tsx
   interface VideoPlayerProps {
     mediaUrl: string;
     mediaType: string;
     onPlay: () => void;
     onPause: () => void;
     onTimeUpdate: (time: number) => void;
     onDurationChange: (duration: number) => void;
     onEnded: () => void;
     // etc.
   }
   ```

4. **Create and Test Component**
   - Implement the component with all required functionality
   - Test in isolation with mock data
   - Integrate with feature flag for in-app testing

## Preserving Existing Component Structure

An important principle in this refactoring is to maintain the separation of existing components while extracting functionality from the main SceneComponent file. This means:

1. **No Component Consolidation**
   - Existing components like SceneMediaPlayer, ScenePreviewPlayer, and scene trimming code will remain separate
   - We're extracting code from SceneComponent but not merging any existing components

2. **Extraction Strategy**
   - Create a wrapper component (e.g., SceneVideoPlayerWrapper) to serve as a bridge
   - Extract video-related state, functions, and JSX from SceneComponent
   - The wrapper will maintain the interface with existing components

3. **Component Hierarchy**
   ```
   SceneComponent.tsx
     ↓ (uses)
     SceneVideoPlayerWrapper.tsx (NEW)
       ↓ (uses)
       SceneMediaPlayer.tsx (EXISTING)
         ↓ (uses)
         ScenePreviewPlayer.tsx (EXISTING)
   ```

4. **What Will Be Extracted**
   - The `renderMedia()` function from SceneComponent
   - Video player state variables (isCompactView, etc.)
   - Video-related event handlers (handleTrimChange, etc.)
   - View mode toggle functionality
   
This approach allows us to reduce the size and complexity of SceneComponent while preserving the existing architecture and component relationships. It creates a clear boundary between the scene card management and the video player functionality.

## Current Implementation Status

### Progress to Date (May 2024)

We have evaluated previous refactoring attempts and are shifting to the "Code Splitting Without Component Extraction" approach as it provides better safety and stability.

#### Completed Tasks:
- ✅ Created a detailed refactoring plan with clear understanding of previous failures
- ✅ Identified all major function groups within SceneComponent
- ✅ Successfully extracted the VideoPlayer functionality in previous iterations
- ✅ Identified a new approach that minimizes risk of breaking functionality
- ✅ Successfully implemented SceneVideoPlayerWrapper in SceneComponent
  - Replaced legacy renderMediaSection with modern video player implementation
  - Added clear commenting to distinguish between old and new implementations
  - Implemented media trimming support with proper event handling
  - Maintained compatibility with existing state management patterns

#### Next Steps:
1. Continue extracting voice-related functions
2. Extract text-editing functions next
3. Complete remaining media-related functions extraction
4. Ensure all tests pass with no behavioral changes

### Implementation Challenges

The main challenges for the new approach are:

1. **Function Dependencies**: Ensuring extracted functions have access to all dependencies
2. **State Management**: Avoiding duplicate state variables or inconsistent state updates
3. **Code Organization**: Creating logical boundaries between function groups
4. **Maintaining Context**: Preserving the component context for all extracted functions

### Validation Strategy

To ensure our refactoring doesn't break existing functionality:

1. We will test after each function extraction
2. No visual or behavioral changes should be observable
3. All existing tests must pass without modification
4. The resulting code should be more maintainable and easier to understand

This new approach is expected to significantly improve code maintainability while avoiding the integration issues that plagued previous refactoring attempts.
