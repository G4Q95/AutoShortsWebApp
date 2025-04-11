# Bug Report: Frontend Re-rendering Glitch

## Status
- **Investigating**

## Severity
- **Critical:** Makes the project workspace unusable for affected projects, causes extreme browser/system load.

## Symptoms
- Infinite re-rendering loop on the project workspace page (`/projects/[id]`).
- UI elements flash rapidly (e.g., text appearing/disappearing).
- Video preview area may flicker or show constant loading states.
- Extremely high volume of console messages (thousands per second).
- Extremely high volume of console errors (hundreds per second).
- Causes browser tab to become unresponsive and consumes high CPU/memory, leading to system overheating.
- Seems to occur only with specific projects, while others load correctly.

## Trigger
- Loading a specific project into the workspace.
- Persists even after closing and reopening the tab for the affected project.

## Console Errors Observed (Summary)
- Numerous `AbortError: signal is aborted without reason` errors originating from `src/lib/api-client.ts` (likely related to cancelled `fetch` requests).
- Numerous `SceneComponent ...: Error fetching stored audio: { ... status_code: 408, message: "Request timed out...", error_code: "timeout_error"}` errors.

## Suspected Cause
- An infinite loop involving component re-renders, likely within `SceneComponent.tsx` or related hooks/contexts.
- The loop triggers rapid, repeated attempts to fetch data (e.g., stored audio), which are immediately cancelled by the next render cycle (AbortError) or eventually time out (408).

## Affected Components (Potential)
- `web/frontend/src/components/SceneComponent.tsx`
- `web/frontend/src/lib/api-client.ts`
- Hooks related to fetching audio or scene data (e.g., `useVoice`?)
- State management context providers related to projects or scenes.

## Investigation Steps
- [ ] Examine `SceneComponent.tsx` for state updates or effects triggering re-renders.
- [ ] Analyze dependencies of `useEffect` hooks within `SceneComponent` and related components.
- [ ] Add targeted logging to trace the render and data fetching lifecycle.
- [ ] Investigate state management updates related to project/scene loading.
- [ ] Compare the data of the affected project with a working project.

## Investigation History (Session: YYYY-MM-DD)

1.  **Initial Observation:** User reported extreme UI flickering, high CPU usage, and browser unresponsiveness when loading specific projects. Console logs showed thousands of messages/errors per second.
2.  **Console Error Analysis:** Key errors identified:
    *   `AbortError: signal is aborted without reason` in `api-client.ts`.
    *   `SceneComponent ...: Error fetching stored audio: { ... status_code: 408, message: "Request timed out..."}`.
3.  **Backend Check:** Initially suspected backend might not be running correctly. Confirmed backend container was started and running via Docker.
4.  **Backend Log Analysis:** Checked `docker-compose logs backend`. Logs revealed the frontend was making **repeated** `GET /api/v1/voice/audio/{proj_id}/{scene_id}` requests in a loop. The backend consistently found no audio files in R2 for the requested scene but returned `200 OK`.
5.  **Frontend Trace:** Searched frontend code for the `/api/v1/voice/audio/` call.
    *   Identified the `getStoredAudio` function in `lib/api/voice.ts` (using `api-client.ts`).
    *   Traced usages of `getStoredAudio`.
    *   Focused on `hooks/scene/useSceneMedia.ts` as the most likely place for this logic within a `useEffect`.
6.  **`useSceneMedia` Analysis:** Found a `useEffect` hook intended to check for stored media, but:
    *   It was **missing the actual call** to `getStoredAudio`.
    *   Its initial check and dependency array (`[mediaUrl, aspectRatio, ...]`) were potentially causing it to run unnecessarily or repeatedly.
7.  **Hypothesis Refined:** The loop was likely an **implicit browser loop**. Unstable state/prop references (possibly originating from `localStorage` data for the specific project) caused the `audioSource` prop passed to the `<audio>` tag (likely within `SceneAudioControls`) to change reference constantly. The browser repeatedly cancelled the implicit fetch for the `<audio src>` (`AbortError`) and started anew. The flawed `useEffect` in `useSceneMedia` failed to correctly fetch the *actual* audio status from the backend to stabilize the state.
8.  **Attempted Fix:** Modified the `useEffect` in `useSceneMedia.ts` to:
    *   Correctly call `await getStoredAudio(currentProjectId, scene.id)`.
    *   Handle the API response (checking `response.data.exists`, `response.data.url`).
    *   Store the verified URL (or null) in local state (`audioUrlFromApi`).
    *   Use a more stable dependency array (`[currentProjectId, scene.id, ...]`).
    *   Return the verified URL (`finalMediaUrl`) from the hook.
9.  **Outcome:** The problematic project data was deleted before the effectiveness of this fix could be fully confirmed.
10. **Side Investigation (Reverted):** An attempt was made to simplify state management in `ProjectWorkspace.tsx` by removing `localProject` state. This inadvertently broke scene persistence and was reverted.

## Current Status
- **Resolved**

## Solution
- The infinite loop was identified within the `ProjectWorkspace.tsx` component's state synchronization logic.
- The initial `useEffect` hook responsible for ensuring the correct project was loaded into context was overly sensitive to state changes.
- Every time the `currentProject` was updated in the context, it triggered an update to the `localProject` state, which in turn changed the `effectiveProject` variable used in the synchronization effect's dependencies.
- This caused the synchronization effect to run again unnecessarily, leading to repeated calls to `loadProject` or `setCurrentProject` and creating an infinite re-render loop.

- **Fix Applied:**
  - The primary synchronization `useEffect` hook in `ProjectWorkspace.tsx` was modified:
    - Conditions were changed to focus primarily on the `projectId` prop and whether the `currentProject` in context matches it.
    - It now checks `localProject` state first before attempting to load from the context/API, preventing unnecessary loads.
    - Added a ref (`projectLoadingRef`) to prevent concurrent `loadProject` calls.
    - The dependency array was adjusted to be less sensitive to the rapidly changing `effectiveProject` reference.
  - This change prevents the effect from triggering itself repeatedly, breaking the loop.

## Notes
- This issue has been observed multiple times recently, potentially introduced during the backend refactoring or slightly earlier. 