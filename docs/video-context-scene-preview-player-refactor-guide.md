# Refactoring Guide: VideoContextScenePreviewPlayer Component

**Last Updated:** 2025-04-04

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

**First Step: Extract Aspect Ratio Logic**

*   **Target:** Logic related to calculating and applying styles based on media aspect ratio, project aspect ratio, and letterboxing.
*   **Action:** Create a new custom hook: `useMediaAspectRatio`.
*   **Details:** This hook will encapsulate state variables (`aspectRatio`, `isVertical`, `isSquare`) and the logic for calculating the `mediaStyle` (CSSProperties object). It will take necessary props like `initialMediaAspectRatio`, `projectAspectRatio`, `showLetterboxing`, and potentially container dimensions.
*   **Goal:** Simplify the main component by removing this state and calculation logic, replacing it with a call to the new hook.

## 4. Code Analysis & Understanding (Ongoing)

*(This section can be updated as we analyze specific parts)*

*   Deep dive into `VideoContextScenePreviewPlayer.tsx` and its interaction with `VideoContext`.
*   Identify the primary triggers for the frequent re-renders (state changes, prop changes, effects).
*   Map out the state flow related to video properties (time, duration, trim, playback).
*   Understand the purpose of the repetitive calculations (aspect ratio, position, etc.) and if they can be optimized or memoized.
*   Analyze the `[FATAL ERROR] Canvas or container ref not available...` error.

## 5. Subsequent Steps (Potential Order)

*(Based on initial analysis, subject to change)*

1.  **Refactor Trim Logic:** Extract trim state (`trimStart`, `trimEnd`, `trimActive`, etc.) and related handlers/effects into a `useTrimControls` hook.
2.  **Refactor Playback/Time Logic:** Consolidate state (`isPlaying`, `currentTime`, `duration`, `visualTime`) and the time update loop (`updateTimeLoop`) potentially into a `usePlaybackState` hook, coordinating with `VideoContext`.
3.  **Address VideoContext Interaction:** Analyze and potentially simplify how the component interacts with the `VideoContextProvider` and the `videoContext` object itself.
4.  **Optimize Rendering:** Apply `React.memo`, `useMemo`, `useCallback` strategically once the logic is clearer and more modular.
5.  **Investigate Canvas/Fallback Logic:** Understand the conditions leading to the canvas errors and the image fallback mechanism.

## 6. Open Questions / Areas to Investigate

*   What specifically causes the `[FATAL ERROR] Canvas or container ref not available...` error seen intermittently?
*   Can the aspect ratio and positioning calculations be performed less frequently or only when relevant properties change?
*   How tightly coupled is this component to the main `VideoContext`? Can dependencies be reduced? 