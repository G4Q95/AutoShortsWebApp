# Native HTML Input Scrubber Implementation Guide

**Date:** 2023-07-07 (Initial Draft)

## 1. Goal

Implement a timeline scrubber and trim controls using native HTML `<input type="range">` elements that:
*   Provides drift-free, smooth visual tracking during drag operations (thumb stays perfectly aligned with the mouse).
*   Correctly updates the video playback position (`bridge.seek()`).
*   Handles playback state correctly (e.g., pausing during drag).
*   Integrates properly with the existing `VideoContext` bridge and component structure.
*   Avoids performance issues like stuttering or excessive re-renders.

## 2. Background & Previous Attempts

### 2.1 Custom Draggable Implementation (Pre-Native Attempt)
*   **Method:** Used custom logic (potentially `react-draggable` or similar, plus manual mouse event calculations) to simulate scrubber/trim dragging.
*   **Problem:** Prone to visual "drift" where the scrubber thumb lags behind the mouse cursor, especially during fast drags. Complex and potentially less performant.

### 2.2 Failed Native Attempt (From Chat History - ~2 days ago)
*   **Method:**
    *   Replaced custom drag logic with native `<input type="range">` elements in `TimelineControl.tsx`.
    *   Introduced `onInput` event handlers (`handleScrubberInput`, `handleTrimStartInput`, `handleTrimEndInput`) intended to be called directly by the input elements.
    *   **Correctly removed the `useEffect` hook for global `mousemove`/`mouseup` listeners** in `VideoContextScenePreviewPlayer.tsx`.
*   **Outcome:**
    *   **Success:** Fixed the drift issue - dragging was visually smooth.
    *   **Failure:** Broke core functionality: video playback stopped working, time display became stale, trim brackets were unresponsive/incorrectly positioned, console logs for play/pause disappeared.
*   **Root Cause:** While the native input *visuals* and `onInput` triggering worked, the new handlers (`handleScrubberInput`, etc.) did **not** correctly replicate all the necessary state updates and side effects (playback control, seeking via bridge, audio sync, trim state updates) that were previously managed by the removed global listeners and the associated `handleScrubberDragMove` logic. The replacement logic was incomplete. Props drilling also became complex and error-prone during this refactor.

### 2.3 Current Implementation (As of 2023-07-07)
*   **Method:**
    *   Uses native `<input type="range">` elements visually in `TimelineControl.tsx`.
    *   **Incorrectly relies on the `useEffect` hook with global `mousemove`/`mouseup` listeners** in `VideoContextScenePreviewPlayer.tsx` to calculate the desired time based on mouse position relative to a container (`containerRef`).
    *   This calculated time updates state (`scrubTime` / `visualTime`), which *then* updates the `<input type="range">` `value` prop. Handlers like `handleScrubberDragMove` contain throttling logic for `bridge.seek`.
*   **Problem:** Reintroduces the **visual drift** because the input's thumb position isn't controlled directly by the browser's native drag handling but indirectly via calculated state updates. This approach was likely reverted to after the "Failed Native Attempt" to restore playback functionality, sacrificing the drift fix.

## 3. New Implementation Plan (This Attempt)

This plan aims to achieve the "drift-free" goal of the "Failed Native Attempt" while ensuring the handlers correctly manage all necessary state and side effects, avoiding the functional regressions.

**Step 1: Refine `TimelineControl.tsx`**
*   Ensure the main scrubber and trim bracket inputs primarily use the `onInput` event to report value changes.
*   Keep `onMouseDown` and `onMouseUp` handlers on the inputs/brackets to manage the `isDraggingScrubber` and `activeHandle` states (signaling the *start* and *end* of drag operations).
*   Define the props interface (`TimelineControlProps`) to expect:
    *   `visualTime`, `duration`, `trimStart`, `effectiveTrimEnd`, `trimActive`, `activeHandle` (for display logic).
    *   **NEW Callbacks:**
        *   `onScrubberInput: (newValue: number) => void;` // Fired continuously during scrubber drag (value 0-100)
        *   `onTrimStartInput: (newValue: number) => void;` // Fired during left bracket drag (value 0-100)
        *   `onTrimEndInput: (newValue: number) => void;` // Fired during right bracket drag (value 0-100)
    *   **State Management Callbacks:**
        *   `onScrubberDragStart: () => void;` // Fired on scrubber mouseDown
        *   `onScrubberDragEnd: () => void;` // Fired on scrubber mouseUp/mouseLeave
        *   `onTrimHandleMouseDown: (handle: 'start' | 'end') => void;` // Fired on bracket mouseDown
        *   `onTrimHandleMouseUp: () => void;` // Fired on bracket mouseUp/mouseLeave
*   Remove any internal logic within `TimelineControl` that tries to calculate time from mouse position; it should only report input values and boundary events (mouseDown/Up).

**Step 2: Modify `VideoContextScenePreviewPlayer.tsx`**
*   **Implement New Handlers:** Create `handleScrubberInput`, `handleTrimStartInput`, `handleTrimEndInput` functions.
    *   These functions will receive the input's value (0-100) from `TimelineControl`.
    *   Convert the 0-100 value to a time value (seconds) based on `duration`.
    *   **`handleScrubberInput`:**
        *   Update a visual time state (e.g., `setScrubTime` or `setVisualTime`) immediately for responsive feedback.
        *   Call `bridge.seek(newTime)` **directly**. (Initial approach - simplest. If performance issues arise, we can re-introduce throttling *within this handler* later, but avoid global listeners).
        *   Ensure playback is paused if it was playing when the drag started (check `isPlaying` state managed by `handleScrubberDragStart`).
    *   **`handleTrimStartInput` / `handleTrimEndInput`:**
        *   Update `trimStart` or `trimEnd` state (`setTrimStart`, `setTrimEnd`).
        *   Update `userTrimEndRef` when dragging the end handle.
        *   Update visual time (`setVisualTime` or `setScrubTime`) to match the handle's position.
        *   Call `bridge.seek()` to move the playhead to the handle's position.
        *   Ensure playback is paused.
*   **Adapt Existing Handlers:**
    *   `handleScrubberDragStart`: Primarily responsible for setting `isDraggingScrubber = true`, storing `originalPlaybackTime`, potentially pausing playback (`handlePause`).
    *   `handleScrubberDragEnd`: Sets `isDraggingScrubber = false`, maybe resumes playback if it was paused *due to the drag*. Ensures the final time is correctly set if needed (though `onInput` might handle the last update).
    *   `handleTrimHandleMouseDown`: Sets the `activeHandle` ('start' or 'end'), pauses playback.
    *   `handleTrimHandleMouseUp`: Clears `activeHandle`.
*   **Crucially: REMOVE THE `useEffect` HOOK THAT ADDS GLOBAL `mousemove` AND `mouseup` LISTENERS.** This is the core change to enable true native handling.
*   Pass the new handlers (`handleScrubberInput`, etc.) and the adapted state handlers down through `PlayerControls`.

**Step 3: Update `PlayerControls.tsx`**
*   Update `PlayerControlsProps` to receive the new `onScrubberInput`, `onTrimStartInput`, `onTrimEndInput` handlers from the parent.
*   Update `PlayerControlsProps` to receive the necessary state management handlers (`onScrubberDragStart`, `onScrubberDragEnd`, `onTrimHandleMouseDown`, `onTrimHandleMouseUp`).
*   Pass these props correctly down to the `<TimelineControl>` component.
*   Remove any props from the `<TimelineControl>` invocation that are no longer needed (like the old `onTimeUpdate`).

**Step 4: Testing and Refinement**
*   Test scrubber drag (drift, video position update).
*   Test trim bracket drag (drift, trim state update, video position update).
*   Test play/pause functionality *during* and *after* drag operations.
*   Monitor performance and console for errors/warnings.
*   If seeking directly in `onInput` causes performance issues, introduce throttling (e.g., using `lodash.throttle` or a simple `setTimeout`) *within* the `handleScrubberInput` handler.

## 4. Implementation History / Notes

*   **2023-07-07:** Document created. Initial plan drafted based on fixing drift while preserving functionality lost in the previous native attempt. Key change: Remove global listeners and implement comprehensive `onInput` handlers.
*   *(... Add notes here as implementation progresses ...) * 

###
How: We should systematically debug the bracket dragging:
Add detailed console logs within handleTrimStartInput, handleTrimEndInput, and potentially within the useTrimControls hook and the rendering of TimelineControl to trace the state values (trimStart, trimEnd, scrubTime, visualTime, bridge.currentTime) during a bracket drag. Look for rapid changes or conflicting values.
Review the logic within handleTrimStartInput/handleTrimEndInput carefully, especially the calculations and state setters.
Examine how activeHandle state is set and used in both TimelineControl and VideoContextScenePreviewPlayer to ensure it correctly isolates the events.
Temporarily disable parts of the logic (e.g., the bridge.seek call within the trim handlers) to see if that stops the flickering, helping to pinpoint the source.
Review the useTrimControls hook again to ensure its internal logic isn't conflicting now that the primary input handling is done in the parent.
Let me know how you'd like to proceed with debugging. We can start by adding more targeted logging.