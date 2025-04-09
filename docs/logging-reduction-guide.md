# Guide: Reducing Console Logs & Re-renders

**Last Updated:** 2025-04-09

## 1. Goal

The primary goal of this guide is to systematically identify, diagnose, and reduce excessive console logging and unnecessary component re-renders within the application, particularly focusing on the `VideoContextScenePreviewPlayer` and its related components. Reducing these issues will improve:

*   **Performance:** Less computational work leads to a smoother user experience.
*   **Stability:** Fewer re-renders reduce the chances of race conditions or state inconsistencies.
*   **Testability:** A more stable component is easier for automation tools (like Playwright and MCP) to interact with reliably.
*   **Debuggability:** A cleaner console makes it easier to spot genuine errors.

## 2. Identified Log Sources / Areas for Improvement

*(This section will be populated as we investigate)*

1.  **Hover State Transitions:** Bursts of logs/re-renders when hovering on/off scene previews (See Task 1).
2.  **Timeline Scrubbing:** (Potential) High volume of logs during scrubber drag.
3.  **Trim Bracket Dragging:** (Potential) High volume of logs during trim handle drag.
4.  **Media Playback:** (Potential) Repetitive logs during standard playback.

## 3. Current Task: Hover State Re-renders

### 3.1 Problem Description

When the user's cursor enters or leaves the hover area of a scene preview (specifically the `MediaContainer` within `VideoContextScenePreviewPlayer`), a significant burst of console logs (~12-13 logs) and associated component re-renders occurs. This happens during the transition where the player controls fade in or out. While the logging stops once the hover state is stable (either on or off), this initial burst of activity causes instability, particularly interfering with automated click attempts on the dynamically appearing controls.

### 3.2 Observed Logs (During Hover Enter/Leave Burst)

The following types of logs are frequently observed during the hover transition:

*   `[VCSPP] Render with isMediumView=...`
*   `[VCSPP PreRender] PlayerControls conditional check...`
*   `[DEBUG PlayerControls Props] visualTime=...`
*   `[TimelineControl] Rendering with trimActive=...`
*   `[useAnimationFrameLoop] isPlaying=...`

### 3.3 Investigation Plan

1.  **Examine Event Handlers:** Analyze the `onMouseEnter` and `onMouseLeave` handlers, likely defined within the `useMediaEventHandlers` hook and used by `MediaContainer`.
2.  **Trace State Flow:** Understand how the `isHovering` state update (managed within `VideoContextScenePreviewPlayer`) propagates to child components (`PlayerControls`, `TimelineControl`).
3.  **Identify Re-render Triggers:** Determine precisely why `VCSPP`, `PlayerControls`, and `TimelineControl` re-render multiple times in response to a single `isHovering` change.
4.  **Optimize:**
    *   **`React.memo`:** Consider wrapping child components like `PlayerControls` and `TimelineControl` in `React.memo` to prevent re-renders if their relevant props haven't actually changed, even if the parent (`VCSPP`) re-renders.
    *   **Prop Drilling:** Ensure props passed down are stable (e.g., memoized functions using `useCallback`, stable object references).
    *   **Selector Functions:** If applicable, use selector functions with context to prevent unnecessary updates.

## 4. Future Tasks

*   Investigate log spam during timeline scrubbing.
*   Investigate log spam during trim bracket dragging.
*   Investigate log spam during normal playback.
*   Review other components for similar performance issues. 