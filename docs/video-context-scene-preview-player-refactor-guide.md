# Refactoring Guide: VideoContextScenePreviewPlayer Component

**Last Updated:** 2025-04-06

## 1. Problem Statement

Playwright end-to-end tests consistently fail when attempting to interact (hover, click) with scene previews containing video media (`video-player.spec.ts`). The failures manifest as timeouts during actionability checks, even when using `force: true`.

Investigation revealed the following:

*   **Component Instability:** The `VideoContextScenePreviewPlayer.tsx` component exhibits significant instability when handling video media.
*   **Excessive Re-renders/Calculations:** Console logs show a flood of repetitive messages related to aspect ratio, styling, position, and trim values when video scenes are loaded or interacted with (even just hovering).
*   **Actionability Check Failures:** This constant recalculation/re-rendering causes the component to fail Playwright's actionability checks (visibility, stability) at the precise moment of interaction attempts.
*   **Contrast with Images:** Tests involving image media within the same component do *not* show the same level of console log activity and pass interaction checks reliably.
*   **Visual Discrepancy:** Playwright Trace Viewer often shows the video thumbnail rendered correctly in the timeline view but displays a black/empty box for the element during the failed action step, indicating it failed the readiness check at that specific instant.

**Conclusion:** The root cause of the video interaction test failures lies within the `VideoContextScenePreviewPlayer.tsx` component's complex and unstable rendering/state management logic specifically when dealing with video content.

## 2. Refactoring Goals

*   **Improve Stability:** Significantly reduce unnecessary re-renders and state calculations when handling video.
*   **Enhance Performance:** Optimize the component's rendering logic.
*   **Simplify State Management:** Clarify and potentially simplify how state related to video (position, trim, aspect ratio) is managed and propagated.
*   **Increase Testability:** Make the component robust enough for reliable interaction in automated tests.
*   **Maintain Functionality:** Ensure all existing features (playback, trimming, aspect ratio handling) continue to work correctly.

## 3. Refactoring Approach: Incremental Hook/Utility Extraction

We will refactor the component incrementally using the following methodology to minimize disruption and risk:

1.  **Keep Core Component Structure:** The main `VideoContextScenePreviewPlayer` and `VideoContextScenePreviewPlayerContent` components will remain.
2.  **Extract Logic, Not Components:** Instead of breaking the UI into smaller components, we will extract related logic (state, effects, calculations, handlers) into custom hooks (e.g., `useMediaAspectRatio`) or utility functions placed in separate files.
3.  **Maintain Functionality & DOM:** The goal is zero visual or functional impact. The rendered DOM structure and event flow should remain identical after each step.
4.  **Organize Extracted Code:** Create a clear directory structure (e.g., `src/hooks/`, `src/utils/video/`) for the extracted modules.
5.  **Frequent Manual Testing:** Due to the current inability to rely on automated tests for this component (especially video interactions), **manual testing after each significant refactoring step is crucial** to ensure functionality remains intact.

**Update (2025-04-05):** Before starting the planned hook extractions below, several critical interaction bugs related to video loading, playback state synchronization (`currentTime`, `isPlaying`), and trim handle behavior (playhead snapping) were identified and fixed directly within the component. This provides a more stable foundation for the subsequent refactoring steps.

**Completed Step: Extract Aspect Ratio Logic (Done: 2025-04-06)**

*   **Target:** Logic related to calculating and applying styles based on media aspect ratio, project aspect ratio, and letterboxing.
*   **Action:** Created a new custom hook: `useMediaAspectRatio` (`src/hooks/useMediaAspectRatio.ts`).
*   **Details:** This hook encapsulates the logic for calculating the `mediaElementStyle` (CSSProperties object for the `img`/`video`/`canvas`) based on `initialMediaAspectRatio`, `projectAspectRatio`, `showLetterboxing`, `mediaType`, and `videoDimensions`. It also returns the `calculatedAspectRatio`.
    *   *Note:* The component retains responsibility for the container styles (`getContainerStyle`, `getMediaContainerStyle`) to ensure proper framing.
*   **Outcome:** Simplified the main component by removing the `getMediaStyle` function and associated calculation logic, replacing its usage with the hook's return value. Manual testing confirmed visual correctness.

## 4. Code Analysis & Understanding (Ongoing)

*(This section can be updated as we analyze specific parts)*

*   Deep dive into `VideoContextScenePreviewPlayer.tsx` and its interaction with `VideoContext`.
*   Identify the primary triggers for the frequent re-renders (state changes, prop changes, effects).
*   Map out the state flow related to video properties (time, duration, trim, playback).
*   Understand the purpose of the repetitive calculations (aspect ratio, position, etc.) and if they can be optimized or memoized.
*   Analyze the `[FATAL ERROR] Canvas or container ref not available...` error.

## 5. Subsequent Steps (Potential Order)

- **Cleanup (DONE):** Addressed ESLint warnings (unused variables, console logs, hook dependencies) in the main component. Reverted problematic attempt to use `<Image>` component, keeping standard `<img>` for now.
- **Stability Fixes (DONE):** Resolved critical infinite re-render loops, video loading failures, image default duration issues, and image playback timer bugs. Correct visual aspect ratio handling restored.

1.  **Refactor Trim Logic (Incremental Approach):** Extract trim state (`trimStart`, `trimEnd`, `activeHandle`, etc.) and related handlers/effects into a `useTrimControls` hook.
    *   **Phase 1 (DONE):** Hook created, state variables and setters moved into hook. Component updated to use hook state. Stability confirmed.
    *   **Phase 2 (DONE):** Drag handlers (`handleTrimDragMove`, `handleTrimDragEnd`) moved into the hook. Component updated to pass dependencies and use handlers from hook. Tested okay.
    *   **Phase 3 (DONE):** Global listener effect moved into the hook. Tested okay.
2.  **Refactor Playback/Time Logic (Stage 4 - Revised Plan - DONE):** Separate playback-related *state* into a `usePlaybackState` hook, leaving core logic in the main component.
    *   **(Previous Attempt Reverted):** An initial attempt to move both state *and* the rAF time loop logic into the hook caused media loading failures due to dependency complexities.
    *   **Revised Plan (Simpler & Safer - Further Broken Down):** 
        *   **Step 4.1 (DONE):** Create the basic `usePlaybackState` hook (`src/hooks/usePlaybackState.ts`) containing only the `useState` calls for `isPlaying`, `currentTime`, and `visualTime`. In `VideoContextScenePreviewPlayer.tsx`, import the hook, comment out the original `useState` lines for these variables, and call the hook, destructuring its results. Verified hook creation and basic integration didn't break the build.
        *   **Step 4.2 (DONE):** Update the dependencies of `useCallback` hooks (like `handlePause`, `handlePlay`, `setIsPlayingWithLog`) and `useEffect` hooks (like the rAF loop, boundary checks) to correctly use the state variables and setters obtained from `usePlaybackState`. Ensured logic uses the new state source.
        *   **Step 4.3 (DONE):** Thoroughly tested playback, pause, scrubbing, and boundary interactions after Step 4.2. Resolved bugs related to reset logic, video/image consistency, and paused frame display.
    *   **Rationale:** This hyper-incremental approach isolates changes to minimize risk and make debugging easier.
3.  **Extract Player Controls Component (Next Focus):** Create a dedicated `PlayerControls.tsx` component to handle the rendering of UI elements like the play/pause button, scrubber bar, time display, fullscreen button, etc. The main component will pass necessary state and callbacks as props. 
    *   **Goal:** Improve JSX readability, create a dedicated location for UI controls, and facilitate adding future controls (speed, resolution).
    *   **Incremental UI Component Extraction (In Progress):**
        *   **Step 1 (DONE):** Extracted `PlayPauseButton.tsx` - A simple button to toggle play/pause state.
        *   **Step 2 (DONE):** Extracted `LockButton.tsx` - A button to toggle position locking for the controls overlay.
        *   **Step 3 (DONE):** Extracted `TrimToggleButton.tsx` - A button to toggle trim mode (scissors/check icon).
        *   **Step 4 (DONE):** Extracted `InfoButton.tsx` - A button to toggle aspect ratio information display.
        *   **Step 5 (DONE):** Extracted `FullscreenButton.tsx` - A button to toggle fullscreen mode.
        *   **Step 6 (DONE):** Extracted `MediumViewButton.tsx` - A button to toggle between compact and expanded view modes (used by SceneMediaPlayer.tsx which renders above VideoContextScenePreviewPlayer).
        *   **Step 7 (DONE):** Extracted `TimelineControl.tsx` - A component combining the timeline scrubber, time display, AND trim brackets elements. Initially planned as two separate components, but combined to ensure proper alignment and positioning between these tightly coupled UI elements.
        *   **Step 8 (NEXT):** Create a `PlayerControls` container component that combines all control elements into a unified interface.
4.  **Diagnose Playback Log Spam (Following):** Use React DevTools profiler and targeted logging to understand the root cause of excessive console logs during video playback before attempting further major refactoring of the rAF loop or VideoContext logic.
5.  **Address VideoContext Interaction (Future):** Analyze and potentially simplify how the component interacts with the `VideoContextProvider` and the `videoContext` object itself.
6.  **Optimize Rendering (Future):** Apply `React.memo`, `useMemo`, `useCallback` strategically once the logic is clearer and more modular.
7.  **Investigate Canvas/Fallback Logic (Future):** Understand the conditions leading to the canvas errors and the image fallback mechanism.

## 6. Open Questions / Areas to Investigate

*   What specifically causes the `[FATAL ERROR] Canvas or container ref not available...` error seen intermittently?
*   Can the aspect ratio and positioning calculations be performed less frequently or only when relevant properties change?
*   How tightly coupled is this component to the main `VideoContext`? Can dependencies be reduced?
