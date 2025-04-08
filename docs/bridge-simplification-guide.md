# Guide: Simplifying VideoContext Bridge Interactions

**Date:** 2023-07-05

## 1. Problem Statement

The current interaction between the timeline UI controls (`TimelineControl`, `PlayerControls`), the main player component (`VideoContextScenePreviewPlayer`), and the `VideoContext` library (via `useVideoContextBridge` and sometimes direct access) is overly complex. This leads to:

*   Potential performance issues (juddering, excessive re-renders) during timeline scrubbing.
*   Multiple, sometimes conflicting, ways of updating playback time state.
*   Difficulty in debugging state synchronization issues.
*   Code that bypasses the intended abstraction layer (`useVideoContextBridge`).

## 2. Goal

Simplify the data flow and interaction patterns surrounding `VideoContext` to create a single, clear path for controlling playback and receiving state updates, primarily through the `useVideoContextBridge` hook. This will improve stability, maintainability, and performance.

## 3. Refinement Plan

The following steps will be taken to refactor the interaction logic:

### Step 1: Consolidate Time Updates via Bridge (COMPLETED)

*   **Action:** Modified UI event handlers (`handleTimeUpdate`, `handleScrubberDragMove`) in `VideoContextScenePreviewPlayer.tsx` so that they **only** call `bridge.seek()` when the user intends to change the playback time.
*   **Removed:** Eliminated direct setting of `videoContext.currentTime` or `videoRef.current.currentTime` from `handleScrubberDragMove`.
*   **Rationale:** Ensures all seek actions go through the single bridge interface.
*   **Outcome:** Direct manipulation removed. `handleTimeUpdate` already used `bridge.seek`. `handleScrubberDragMove` now only updates visual state during drag, actual seek happens via `handleScrubberDragEnd` -> `handleTimeUpdate` -> `bridge.seek`. *(Note: This initially broke live preview, fixed later).* 

### Step 2: Make the Bridge Own the VideoContext Instance (COMPLETED)

*   **Action:** Refactored `useVideoContextBridge.ts`.
    *   Removed the `videoContextInstance` prop.
    *   The hook now *always* creates and manages its own internal `VideoContext` instance (`internalCtx`) and uses it exclusively for operations.
    *   The hook exposes the necessary state derived from its internal context.
*   **Action:** Refactored `VideoContextScenePreviewPlayer.tsx`.
    *   Removed the local `videoContext` state variable.
    *   Removed the redundant `useEffect` responsible for local context initialization.
    *   Updated dependent hooks (`useTrimControls`, `useMediaAspectRatio`) to receive `bridge.videoContext`.
    *   Updated internal logic to read context state from `bridge.videoContext` where needed.
*   **Rationale:** Enforces the bridge as the single source of truth and interaction point for `VideoContext`. Eliminates confusing dual context management.
*   **Outcome:** Bridge hook is now the sole owner. Parent component relies only on the bridge. Interactions are centralized.

### Step 3: Remove Direct `videoContext` Prop from UI Controls (NEXT)

*   **Action:** Remove the `videoContext` prop currently passed down through `PlayerControls` to `TimelineControl`.
*   **Action:** If the trim bracket handlers in `TimelineControl` need playback state (e.g., `currentTime` for `setTimeBeforeDrag` or `setOriginalPlaybackTime`), pass the required *state variable* down as a prop from `VideoContextScenePreviewPlayer` (which gets it from the `bridge`). Alternatively, modify the relevant callbacks (`setTimeBeforeDrag`, `setOriginalPlaybackTime`) so they are handled in the parent component which has access to the bridge state.
*   **Rationale:** Prevents UI components from bypassing the bridge abstraction.

### Step 4: Simplify Time State Management (Initial Pass)

*   **Action:** Re-evaluate the need for separate `currentTime` and `visualTime` states managed by `usePlaybackState`.
*   **Initial Goal:** Aim to use a single `currentTime` state (sourced from the `bridge`'s feedback). The `<input type="range">` scrubber (when implemented) will have its `value` bound to this `currentTime`.
*   **Scrubbing Behavior:**
    *   The `onChange` handler for the range input will call `bridge.seek()`.
    *   For smoother visual feedback *during* drag *without* constant video seeking, we might later re-introduce a temporary `visualTime` state updated only by the input's `onChange` during drag, with the actual `bridge.seek()` happening only on `onMouseUp` (drag end) or throttled. However, start with the simpler direct binding and seek-on-change first.
*   **Rationale:** Reduces state synchronization complexity.

### Step 5: Enhance Bridge Feedback Mechanisms

*   **Action:** Ensure `useVideoContextBridge` provides all necessary state feedback to its consumer (`VideoContextScenePreviewPlayer`).
    *   It already provides `isReady` and `duration` (via `onDurationChange` callback, which updates parent state).
    *   **Add:** Expose the current playback time. This could be via a returned state variable (`bridge.currentTime`) updated internally by the bridge listening to `VideoContext`'s time updates, or via a callback (`onTimeUpdateCallback`) that the parent component provides. Using a returned state variable is generally simpler.
*   **Rationale:** Allows the parent component to get all necessary playback state *from* the bridge.

## 4. Next Steps

1.  Implement the refinements outlined above in the specified order.
2.  After simplification, re-implement the timeline scrubber in `TimelineControl.tsx` using a native `<input type="range">` element, ensuring it interacts cleanly with the simplified bridge pattern.
3.  Thoroughly test playback, seeking, scrubbing, and trimming functionality manually and (eventually) with automated tests. 