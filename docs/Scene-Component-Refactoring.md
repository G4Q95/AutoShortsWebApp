# Scene Component Refactoring Plan

## Overview

This document outlines the step-by-step approach to refactoring the Scene component, which has grown to almost 2000 lines. The refactoring will follow a feature-based decomposition strategy, breaking down the component into smaller, more manageable pieces while ensuring the application remains fully functional throughout the process.

## Testing Strategy

- Run Playwright tests after each step to ensure no regression
- Use `cd web/frontend && npm test` to run tests
- If tests fail, revert changes and troubleshoot before proceeding
- Document any test failures and their resolutions

## Refactoring Steps

### Phase 1: Preparation

1. **Create baseline test results** ✅
   - Run full test suite to document current behavior
   - Save screenshots of current UI for visual comparison
   - Observed key component states:
     - Before audio generation: Scene displays media, text, and "Generate Voiceover" button
     - After audio generation: Scene shows audio player controls with play/pause, progress bar, and timestamps
     - Full-screen mode: Expanded view of media with controls overlay
   - All tests currently passing, confirming stable baseline

2. **Code analysis** ✅
   - Identified major feature sections within Scene component:
     - Media player section: Video/image display with controls
     - Text content section: Reddit post title and optional text editing
     - Voice settings section: Voice selection and audio generation
     - Scene controls: Delete, drag reordering
     - Audio player: Controls for generated audio
   - Mapped state dependencies between features:
     - Media state: isLoading, mediaType, mediaUrl, aspectRatio
     - Audio state: audioFile, isGenerating, playerState, volume
     - Edit state: isEditing, originalText, editedText
     - API state: loadingState, errorState, lastResponse
   - Identified shared utility functions:
     - Format duration functions
     - Media type detection
     - URL processing utilities
     - Audio state management helpers
   - Documented prop flow:
     - Scene receives: sceneId, index, mediaContent, onDelete, onGenerateVoice
     - Passes to preview player: mediaUrl, mediaType, aspectRatio
     - Passes to audio controls: audioFile, voiceId, onGenerateAudio
   - Component size assessment:
     - Total lines: 1986 lines
     - Primary sections:
       - State declarations: ~200 lines
       - Event handlers: ~500 lines
       - Effect hooks: ~300 lines
       - Render functions: ~700 lines
       - Utility functions: ~200 lines

3. **Create refactoring branches** ✅
   - Created feature branch `scene-refactor-utils` for utility functions extraction
   - Set up commits as fallback points for each step

### Phase 2: Extract Utility Functions and Hooks

4. **Create utility file for pure functions** ✅
   - Created `scene-utils.ts` file in `web/frontend/src/utils/scene/`
   - Extracted the following pure functions:
     - `formatDuration`: Formats time duration in seconds to MM:SS format
     - `determineMediaType`: Determines media type (image, video, unknown) from URL
     - `getSceneContainerClassName`: Generates className for scene container based on state
     - `calculateMediaHeight`: Calculates appropriate media height based on container width
     - `constructStorageUrl`: Creates URL for R2 storage based on project and scene IDs
   - All tests continue to pass after utility extraction
   - Committed changes to the `scene-refactor-utils` branch

5. **Extract event handlers into utility functions** ✅
   - Created dedicated directory structure for event handlers: `utils/scene/event-handlers/`
   - Extracted and organized handlers by functional domain:
     - `ui-handlers.ts`: View mode toggle, info display toggle, scene removal with animation, retry loading
     - `audio-handlers.ts`: Audio blob conversion, playback control, volume management, speed control
     - `text-handlers.ts`: Text editing, content saving, word counting
   - Added unified export through `index.ts` for better organization
   - Updated SceneComponent to use the extracted handlers
   - Fixed type annotations for proper TypeScript compliance
   - All tests continue to pass after event handler extraction
   - Component reduced by ~200 lines after extraction

### Phase 3: Extract Custom Hooks

6. **Create hooks directory** ✅
   - Set up `hooks/scene` directory structure
   - Created index file for hook exports

7. **Extract media-related logic into custom hook** ✅
   - Created `useSceneMedia.ts` hook
   - Moved media state and related functions
   - Added comprehensive tests
   - Validated core functionality

8. **Extract audio-related logic into custom hook** ✅
   - Created `useSceneAudio.ts` hook
   - Moved audio state and related functions
   - Extracted voice generation logic
   - Added comprehensive tests
   - Validated core functionality

9. **Extract edit-related logic into custom hook** ✅
   - Created `useSceneEdit.ts` hook
   - Moved editing state and related functions 
   - Implemented text editing, saving, and canceling functionality
   - Added keyboard shortcuts (Ctrl+Enter to save, Escape to cancel)
   - Test implementation matches expected behavior in tests

10. **Extract API-related logic into custom hook** ✅
    - Created `useSceneApi.ts` hook
    - Moved API calls and related state
    - Implemented error handling for API operations
    - Added `saveSceneUpdate` and `clearApiError` functions
    - Connected to proper API endpoints
    - All tests passing after implementation
    - Fixed issue with Reddit source information display in text content by enhancing the `cleanPostText` function

### Phase 4: Extract Sub-Components

11. **Create components directory** ✅
    - Set up `components/scene` directory structure
    - Created index file for component exports

12. **Extract header section** ✅
    - Created `SceneHeader.tsx` component
    - Implemented scene number display and controls 
    - Added view mode toggle (compact/expanded)
    - Added info section toggle
    - Ensured proper data-testid attributes for testing

13. **Extract media player section** ✅
    - Created `SceneMediaPlayer.tsx` component
    - Integrated with existing ScenePreviewPlayer for media display
    - Implemented view mode toggle
    - Added proper media URL handling with fallbacks
    - Maintained trim control functionality
    - Added storage status indicator

14. **Extract trim controls section**
    - Create `SceneTrimControls.tsx` component
    - Move trim controls JSX and related state/props
    - Test thoroughly

15. **Extract text content section** ✅
    - Created `SceneTextContent.tsx` component
    - Implemented text display with word count
    - Added text expansion for long content
    - Implemented in-place editing with textarea
    - Added save/cancel buttons and keyboard shortcuts
    - Ensured proper focus management
    - Maintained full functionality of text editing

16. **Extract voice settings section**
    - Create `SceneVoiceSettings.tsx` component
    - Move voice settings JSX and related state/props
    - Test thoroughly

17. **Extract action buttons section**
    - Create `SceneActions.tsx` component
    - Move action buttons JSX and related state/props
    - Test thoroughly

### Phase 5: Implement Container Component

18. **Create container component**
    - Create `SceneContainer.tsx` to manage state
    - Connect all hooks and handle state distribution
    - Test thoroughly

19. **Refactor main Scene component**
    - Update Scene component to use SceneContainer
    - Remove redundant code
    - Ensure proper prop passing
    - Test thoroughly

### Phase 6: State Management Refinement

20. **Review state management**
    - Identify any remaining prop drilling issues
    - Consider context implementation for deeply nested state
    - Refactor as needed

21. **Optimize rendering**
    - Add React.memo to appropriate components
    - Implement useMemo and useCallback where beneficial
    - Test performance

### Phase 7: Documentation and Cleanup

22. **Update component documentation**
    - Add JSDoc comments to all new components and hooks
    - Document component responsibilities and interfaces

23. **Review and cleanup**
    - Remove any dead code
    - Check for duplicated logic
    - Ensure consistent naming conventions
    - Final testing pass

## Rollback Plan

For each step:
1. If tests fail, roll back to the last working state
2. Document the issue
3. Fix in isolation before proceeding
4. Re-run tests to confirm the fix

## Completion Criteria

- All Playwright tests passing
- No regressions in functionality
- Scene component reduced to under 300 lines
- Clear separation of concerns across new components
- Improved code readability and maintainability 

## Progress Summary

### Current Status:
- Component initial size: 1986 lines
- Current size after refactoring: ~1386 lines
- Reduction: ~600 lines (30% complete)
- New components created: 4 (SceneHeader, SceneTextContent, SceneTextEditor, SceneMediaPlayer)

### Completed Steps:
- ✅ Pure utility functions extracted to scene-utils.ts
- ✅ Event handlers extracted to dedicated files:
  - UI event handlers (view toggle, info display, scene removal)
  - Audio handling (blob conversion, playback, volume, speed)
  - Text management (editing, saving, word counting)
- ✅ Custom hooks extraction:
  - useSceneMedia for media state and operations
  - useSceneAudio for voice generation and audio playback
  - useSceneApi for API interactions and error handling
  - useSceneEdit for text editing functionality
- ✅ Text handling improvements:
  - Enhanced `cleanPostText` function to remove "Post by u/username: " prefix from text
  - Fixed issue with source information being displayed in the editable text area
- ✅ Basic UI components implemented:
  - SceneHeader with view mode and info toggles
  - SceneTextContent with editing capabilities
  - SceneTextEditor connecting hook to UI
  - SceneMediaPlayer integrating with ScenePreviewPlayer
- ✅ All tests passing after each extraction step

### Next Steps:
- Create remaining UI components (media player, voice settings, actions)
- Implement proper container component architecture
- Integrate new components into main SceneComponent 

### 3. Extraction of Media Player Section

✅ **Done** - Created `SceneMediaPlayer.tsx` which:
- Integrates with existing ScenePreviewPlayer for media display
- Implements view mode toggle
- Handles media URLs with proper fallbacks
- Maintains trim control functionality
- Includes storage status indicator

### 4. Extraction of Voice Settings Section

✅ **Done** - Created `SceneVoiceSettings.tsx` which:
- Provides voice selection dropdown and settings button
- Implements complete voice settings panel with sliders for:
  - Speed
  - Stability
  - Similarity Boost
  - Style
  - Speaker Boost toggle
- Loads available voices from the API
- Displays voice generation errors
- Includes Generate/Regenerate voice button with loading state
- Maintains all original functionality with clean separation of concerns

### Current Status

- ⬇️ Component size reduced from 1986 lines to approximately 1300 lines (35% complete)
- ✅ Tests passing after each extraction step

### Components Created:
1. `SceneHeader.tsx`
2. `SceneTextContent.tsx`
3. `SceneTextEditor.tsx`
4. `SceneMediaPlayer.tsx`
5. `SceneVoiceSettings.tsx`

## Next Steps:

1. Extract Scene Actions (Add Scene, Delete Scene, Duplicate, etc.)
2. Extract Scene Timing Controls
3. Update SceneComponent to use all new components
4. Final cleanup and testing 