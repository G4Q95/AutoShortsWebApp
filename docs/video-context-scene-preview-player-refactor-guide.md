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

## 3. Initial Refactoring Approach (Basic Outline)

*(This is a preliminary plan and subject to change based on code analysis)*

1.  **Code Analysis & Understanding:**
    *   Deep dive into `VideoContextScenePreviewPlayer.tsx` and its interaction with `VideoContext`.
    *   Identify the primary triggers for the frequent re-renders (state changes, prop changes, effects).
    *   Map out the state flow related to video properties.
    *   Understand the purpose of the repetitive calculations (aspect ratio, position, etc.) and if they can be optimized or memoized.
2.  **Identify Core Responsibilities:** Break down the component's tasks (e.g., rendering video/image, handling playback state, managing trim controls, calculating layout).
3.  **Optimize Rendering:**
    *   Investigate usage of `React.memo`, `useMemo`, `useCallback` to prevent unnecessary re-renders of the component or its children.
    *   Analyze `useEffect` dependencies to ensure effects only run when necessary.
4.  **Simplify State:**
    *   Review state variables within the component and context. Can any state be derived? Can updates be batched?
    *   Examine prop drilling. Can context or alternative patterns simplify data flow?
5.  **Isolate Video Logic:** Consider if video-specific logic can be further encapsulated or handled by more specialized hooks/components.
6.  **Incremental Changes & Testing:** Apply changes incrementally and use manual testing (and eventually, the Playwright test) to verify stability improvements.

## 4. Open Questions / Areas to Investigate

*   What specifically causes the `[FATAL ERROR] Canvas or container ref not available...` error seen intermittently?
*   Can the aspect ratio and positioning calculations be performed less frequently or only when relevant properties change?
*   How tightly coupled is this component to the main `VideoContext`? Can dependencies be reduced? 