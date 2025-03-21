# Scene Component Refactoring Plan - Final Approach

## Current Structure

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

## Four-Component Approach

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
