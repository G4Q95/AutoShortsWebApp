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

### Step 3: Remove Direct `videoContext` Prop from UI Controls (COMPLETED)

*   **Action:** Remove the `videoContext` prop currently passed down through `PlayerControls` to `TimelineControl`.
*   **Action:** If the trim bracket handlers in `TimelineControl` need playback state (e.g., `currentTime` for `setTimeBeforeDrag` or `setOriginalPlaybackTime`), pass the required *state variable* down as a prop from `VideoContextScenePreviewPlayer` (which gets it from the `bridge`). Alternatively, modify the relevant callbacks (`setTimeBeforeDrag`, `setOriginalPlaybackTime`) so they are handled in the parent component which has access to the bridge state.
*   **Rationale:** Prevents UI components from bypassing the bridge abstraction.
*   **Outcome:** Successfully removed videoContext prop from TimelineControl, PlayerControls now only passes down necessary state variables.

### Step 4: Simplify Time State Management (Initial Pass)

*   **Action:** Re-evaluate the need for separate `currentTime` and `visualTime` states managed by `usePlaybackState`.
*   **Initial Goal:** Aim to use a single `currentTime` state (sourced from the `bridge`'s feedback). The `<input type="range">` scrubber (when implemented) will have its `value` bound to this `currentTime`.
*   **Scrubbing Behavior:**
    *   The `onChange` handler for the range input will call `bridge.seek()`.
    *   For smoother visual feedback *during* drag *without* constant video seeking, we might later re-introduce a temporary `visualTime` state updated only by the input's `onChange` during drag, with the actual `bridge.seek()` happening only on `onMouseUp` (drag end) or throttled. However, start with the simpler direct binding and seek-on-change first.
*   **Rationale:** Reduces state synchronization complexity.

### Revised Incremental Plan (Revisiting Steps 4 & 5) - [DATE: 2023-07-06]

*Based on difficulties encountered when implementing the original Steps 4 & 5, the following more granular approach will be taken, prioritizing stability:* 

1.  **Action 1: Enable the Bridge to Track Time: (IN PROGRESS)**
    *   **Modify `useVideoContextBridge.ts`:**
        *   Add internal `currentTime` state. ✅
        *   Add `useEffect` listening to `videoRef.current.timeupdate` to update internal `currentTime` state. ✅
        *   Expose `bridge.currentTime` in the return object. ✅
        *   **Crucially:** Do *not* modify `seek` or the player component yet. ✅
    *   **Goal:** Bridge accurately tracks time internally without influencing playback.
    *   **Testing:** Add temporary console logs in the bridge's effect, play video using existing controls, verify bridge's internal time updates correctly in console.
    *   **Commit Point:** Yes, after successful testing.

2.  **Action 2: Start Using Bridge Time for Display: (IN PROGRESS)**
    *   **Modify `VideoContextScenePreviewPlayer.tsx`:**
        *   Read `bridge.currentTime` *only* for UI display (e.g., passing to `PlayerControls`/`TimeDisplay`). ✅
        *   Leave existing `usePlaybackState` and its `currentTime` intact for core logic.
    *   **Goal:** Verify bridge provides accurate time for UI without changing playback logic.
    *   **Testing:** Visually inspect time display during playback. Confirm basic play/pause still works.
    *   **Commit Point:** Yes, after successful testing.

3.  **Action 3: Gradually Migrate Player Logic: (COMPLETED)** ✅
    *   **Modify `VideoContextScenePreviewPlayer.tsx` Incrementally:**
        *   Fixed TimelineControl component's time handling functions (`timelineValueToPosition` and `positionToTimelineValue`) to properly use visualTime instead of defaulting to 0 when activeHandle is true. ✅
        *   **Sub-task 3.1 (COMPLETED):** ✅ Update the `useAnimationFrameLoop` hook to read `bridge.currentTime` as its primary time source, potentially removing the need for it to set the time state itself.
        *   **Sub-task 3.2 (COMPLETED):** ✅ Review and update core event handlers (`handlePlay`, `handlePause`, `handleTimeUpdate`, boundary checks within rAF loop, etc.) to rely on `bridge.currentTime` for their logic and state updates, removing dependencies on the local `currentTime` from `usePlaybackState`.
        *   **Sub-task 3.3 (COMPLETED):** ✅ Identify and migrate any other remaining logic within the component that currently uses the local `currentTime` state.
    *   **Goal:** Transition core player logic to use the bridge as the time source, ensuring consistent state management.
    *   **Testing:** Test playback, pause, scrubbing, trim boundaries, and visual display thoroughly *after each sub-task migration*.
    *   **Commit Point:** Yes, after successful testing.

4.  **Action 4: Remove Old Player Time State: (COMPLETED)** ✅
    *   **Modify `VideoContextScenePreviewPlayer.tsx` & `usePlaybackState.ts`:**
        *   Removed the `currentTime` state and setter from `usePlaybackState` hook. ✅
        *   Removed the corresponding destructuring in `VideoContextScenePreviewPlayer.tsx`. ✅
    *   **Goal:** Final cleanup of redundant state.
    *   **Testing:** Rigorous testing of all playback and related features.
    *   **Commit Point:** Yes, after successful testing.

## 4. Next Steps

1.  Implement the refinements outlined above in the specified order.
2.  After simplification, re-implement the timeline scrubber in `TimelineControl.tsx` using a native `<input type="range">` element, ensuring it interacts cleanly with the simplified bridge pattern.
3.  Thoroughly test playback, seeking, scrubbing, and trimming functionality manually and (eventually) with automated tests. 

## 5. Learnings from Previous Attempts (Post-Step 3)

During the initial attempt to implement Steps 4 and 5 (making the bridge the source of truth for `currentTime`), significant instability was encountered:

*   **Issue:** Playback became erratic, often stuttering or freezing after a few frames. The browser console was flooded with thousands of logs per second, primarily related to `timeupdate` events and `bridge.seek()` calls.
*   **Root Cause:** A feedback loop was created:
    1.  The video element fires a `timeupdate` event.
    2.  The event handler (in the player or bridge) called `bridge.seek()` with the new time.
    3.  `bridge.seek()` updated the `videoRef.current.currentTime`.
    4.  Setting `videoRef.current.currentTime` programmatically immediately triggered *another* `timeupdate` event.
    5.  This cycle repeated indefinitely, overwhelming the browser.
*   **Attempted Fix:** An `isSettingTime` flag was introduced in the bridge. This flag was set before the bridge modified `videoRef.current.currentTime` and reset shortly after. The `timeupdate` handlers were modified to ignore events if this flag was true.
*   **Why Fix Failed:** While logically sound, this approach proved insufficient. Timing issues likely meant the flag was reset before all cascaded events were processed, or race conditions allowed the loop to restart. The sheer frequency of `timeupdate` events makes this kind of flag-based debouncing fragile.
*   **Conclusion:** Directly linking the video element's `timeupdate` event back to a function that programmatically sets the *same* element's `currentTime` is highly prone to feedback loops. A more decoupled approach is needed, as outlined in the Revised Incremental Plan. 