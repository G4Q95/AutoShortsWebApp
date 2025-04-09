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

## 3. Current Task: Hover State Re-renders (In Progress)

### 3.1 Problem Description

When the user's cursor enters or leaves the hover area of a scene preview (`MediaContainer` within `VideoContextScenePreviewPlayer`), a significant burst of console logs and associated component re-renders occurs. 
*   Hovering over the general media area triggers ~14 logs.
*   Hovering specifically over the controls overlay triggers ~18 logs.
This burst happens during the fade-in/out transition of the controls and causes instability for automated interactions.

### 3.2 Observed Logs (During Hover Enter/Leave Burst)

The following types of logs are frequently observed during the hover transition:

*   `[VCSPP] Render with isMediumView=...`
*   `[VCSPP PreRender] PlayerControls conditional check...`
*   `[DEBUG PlayerControls Props] visualTime=...`
*   `[TimelineControl] Rendering with trimActive=...`
*   `[useAnimationFrameLoop] isPlaying=...`

### 3.3 Investigation & Actions Taken

1.  **Examined Event Handlers:** Confirmed `onMouseEnter`/`onMouseLeave` in `useMediaEventHandlers` are simple, memoized state setters (`setIsHovering`).
2.  **Traced State Flow:** Determined the `isHovering` state change in `VideoContextScenePreviewPlayer` (VCSPP) triggers re-renders of VCSPP itself and its children.
3.  **Memoized `PlayerControls`:** Wrapped `PlayerControls` in `React.memo`. 
    *   **Outcome:** Reduced logs when hovering *above* controls (approx. down to ~14). Logs when hovering *over* controls remained higher (~18), indicating `PlayerControls` still re-renders, likely due to props changing or other triggers when controls are interacted with.
4.  **Memoized `TimelineControl`:** Wrapped `TimelineControl` (a child of `PlayerControls`) in `React.memo`.
    *   **Outcome:** No significant further reduction in logs observed during the hover transition burst. This suggests the re-renders are still being triggered higher up (either VCSPP or `PlayerControls` itself).
5.  **Checked Prop Stability:** Verified that most function props passed from VCSPP to `PlayerControls` are wrapped in `useCallback`.

### 3.4 Current Hypothesis

The remaining burst of re-renders when hovering (especially over controls) is likely due to:
*   The parent `VideoContextScenePreviewPlayer` re-rendering multiple times itself in response to the single hover state change.
*   OR: Unstable props (non-function objects/arrays, or maybe a less obvious non-memoized function) being passed to `PlayerControls`, causing its `React.memo` check to fail.

### 3.5 Next Steps

1.  **Memoize `MediaContainer`:** Wrap `MediaContainer` (another direct child of VCSPP) in `React.memo` to see if that prevents re-renders originating from the parent.
2.  **Analyze VCSPP Renders:** If memoizing children doesn't stop the burst, use React DevTools Profiler to investigate *why* `VideoContextScenePreviewPlayer` itself re-renders multiple times on a single hover state change.
3.  **Deep Prop Audit:** If necessary, meticulously check *all* props passed to `PlayerControls` for referential stability.

## 4. Future Tasks

*   Investigate log spam during timeline scrubbing.
*   Investigate log spam during trim bracket dragging.
*   Investigate log spam during normal playback.
*   Review other components for similar performance issues. 