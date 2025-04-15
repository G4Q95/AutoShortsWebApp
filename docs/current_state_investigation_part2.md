# Current State Investigation Log - Part 2 (Post-Revert Debugging)

This document tracks the investigation after reverting to a previous commit, focusing on resolving the media storage pipeline failure.

---

## Entry Template

### Test Action
_Describe the user action performed (e.g., "Add scene with media URL via frontend")._

### Expected Outcome
_What should happen if everything works (e.g., "Media is downloaded, uploaded to R2, scene status updated in DB")._

### Observed Outcome
_What actually happened? Include relevant logs, errors, and UI feedback._

### Analysis
_What worked, what failed, possible causes, and any notes on race conditions, sync/async issues, or configuration problems._

### Next Steps
_What to try or check next based on this result._

---

## Investigation Entries (2025-04-15 cont.)

### Test Action
Diagnose media storage failure after reverting commit and adding a scene.

### Expected Outcome
- Frontend triggers `POST /api/v1/media/store`.
- Backend receives the request and queues a Celery task.
- Celery worker processes the task, uploads media to R2, updates MongoDB.

### Observed Outcome
- **Frontend Console Errors:** Repeated error `[EFFECT STORAGE] Cannot store media: Missing project or project MongoDB _id`.
- **Frontend Network Tab:** The `POST /api/v1/media/store` endpoint was **NOT** called.
- **Backend Logs:** Confirmed receipt of `GET /api/v1/content/extract` but no logs related to `/api/v1/media/store`.
- **Code Analysis (`ProjectProvider.tsx` `useEffect` around L437):** The effect responsible for triggering media storage runs, but fails an internal check `if (!state.currentProject || !state.currentProject._id)`.

### Analysis
- The root cause is a frontend timing issue in `ProjectProvider.tsx`.
- The revert likely undid previous fixes that ensured the media storage `useEffect` had access to the complete `state.currentProject` object (including the MongoDB `_id`) *after* the scene state was updated by the reducer.
- When the effect runs, `state.currentProject._id` is not yet available in its scope, causing the check to fail and preventing the call to the backend `/api/v1/media/store`.
- This confirms the issue lies in the frontend state synchronization, specifically related to the availability of the project's MongoDB `_id` within the media storage effect hook.

### Next Steps
1.  Carefully modify the `useEffect` hook in `ProjectProvider.tsx` (around L437) to ensure it only proceeds when `state.currentProject` and `state.currentProject._id` are valid *before* iterating through scenes needing storage.
2.  Retest adding a scene with a media URL.
3.  Verify frontend logs (error should be gone), network tab (API call should be made with `mongo_db_id`), backend logs (API call received), and Celery logs (task received with `mongo_db_id`).

### Test Action
Retest scene addition after adding stricter `_id` check in `useEffect`.

### Expected Outcome
- Frontend error `Cannot store media: Missing project or project MongoDB _id` should be gone.
- Frontend should successfully call `POST /api/v1/media/store` with `mongo_db_id`.
- Backend should receive the request and queue a Celery task.
- Celery worker should receive the task with the `mongo_db_id`.

### Observed Outcome
- **Frontend Console Errors:** The previous critical error was gone. Only a minor unrelated warning (`Received NaN for the \`%s\` attribute...`) remained.
- **Frontend Console Logs:** Logs indicated project/scene creation and saving. Crucially, logs starting with `[EFFECT STORAGE]` were **NOT** present, indicating the media storage logic inside the `useEffect` did not execute its main block.
- **Frontend Network Tab:** The `POST /api/v1/media/store` endpoint was **NOT** called.
- **Backend Logs:** Confirmed receipt of `GET /api/v1/content/extract` but no logs related to `/api/v1/media/store`.
- **Celery Worker Logs:** No new `download_media_task` was received. (Also noted unrelated Redis connection errors).

### Analysis
- The added check successfully prevented the crash when `_id` was missing.
- However, the `useEffect` (around L437) is still not correctly identifying the newly added scene as needing storage after its content (`media.url`) has been extracted and the state presumably updated.
- The conditions for the effect to run (`scenesNeedingStorageIds.length > 0`) or the dependencies (`scenesNeedingStorageIds`, `state.currentProject?._id`, etc.) are not aligning correctly in terms of timing.
- The pipeline is currently blocked because the frontend state synchronization isn't triggering the call to `storeSceneMedia`.

### Next Steps
1.  Add more detailed logging to `ProjectProvider.tsx` within the `addScene` function (around L576) and the `useMemo` hook for `scenesNeedingStorageIds` (around L428) to trace the state update flow precisely.
2.  Run the test again (add project/scene).
3.  Analyze the new, detailed browser console logs to pinpoint where the state update or dependency trigger is failing.
4.  Update this investigation log with the findings from the detailed logs.

### Test Action
Retest scene addition after adding detailed logging to `ProjectProvider.tsx`.

### Expected Outcome
- Detailed logs in the browser console should trace the execution flow of `addScene` and the calculation of `scenesNeedingStorageIds`.
- Ideally, the logs would show the `useEffect` triggering `storeSceneMedia` and the subsequent API call.

### Observed Outcome
- **Frontend Console Errors:** No critical errors.
- **Frontend Console Logs:** Logs showed project/scene creation (`proj_m9in8xg5`, scene `j8ggu0fdn0d5z6euo86yl7`) and auto-saving. However, the newly added detailed logs (`[ADD SCENE]`, `[MEMO ...]`, `[EFFECT STORAGE]`) were **absent** from the retrieved logs.
- **Frontend Network Tab:** The `POST /api/v1/media/store` endpoint was **NOT** called.
- **Backend Logs:** Confirmed receipt of `GET /api/v1/content/extract` but no logs related to `/api/v1/media/store`.
- **Celery Worker Logs:** No new `download_media_task` was received.

### Analysis
- Despite adding detailed logging, the crucial traces were not observed (potentially a log retrieval issue, but the outcome remains the same).
- The lack of the `/api/v1/media/store` call confirms the frontend `useEffect` (around L437) is still not executing its core logic after content extraction completes and the scene state is updated.
- The primary hypothesis remains a state synchronization/dependency detection issue: the change within the `scenes` array (specifically adding the `media.url`) is not properly triggering the `useMemo` for `scenesNeedingStorageIds` and/or the `useEffect` that depends on it.

### Next Steps
1.  Modify the `ADD_SCENE_SUCCESS` case in `ProjectReducer.ts` to ensure it returns a **new array reference** for the `scenes` array when updating a scene. This should help React's dependency tracking reliably trigger the `useMemo` and `useEffect` hooks.
2.  Retest adding a scene.
3.  Verify logs/network activity again, focusing on whether the `[EFFECT STORAGE]` logs appear and the `/api/v1/media/store` call is made.

### Test Action
Retest scene addition after correcting `storeSceneMedia` arguments and dependencies in `ProjectProvider.tsx`.

### Expected Outcome
- Frontend `useEffect` should trigger `storeSceneMedia` with correct arguments.
- `storeSceneMedia` should call the `storeMediaContent` API client function.
- Frontend should make a `POST /api/v1/media/store` request to the backend.
- Backend should receive the request and queue a Celery task.
- Celery worker should receive the task.

### Observed Outcome
- **Frontend Console Errors:** No relevant errors.
- **Frontend Console Logs:** 
    - `[EFFECT STORAGE]` logs confirmed the effect ran and condition was met.
    - `[EFFECT STORAGE] Calling storeSceneMedia...` log appeared.
    - `[MEDIA-DEBUG]` logs from within `storeSceneMedia` appeared, including the log just before the API call: `[MEDIA-DEBUG] Calling API to store media with params: ...`
- **Frontend Network Tab:** (Implicitly checked via backend logs) - No call observed.
- **Backend Logs:** Confirmed receipt of `GET /api/v1/content/extract` and video proxy call, but **NO log** for `POST /api/v1/media/store`.
- **Celery Worker Logs:** No new `download_media_task` was received.

### Analysis
- The fix in `ProjectProvider.tsx` was successful. The `useEffect` now correctly triggers the `storeSceneMedia` utility function.
- The new failure point is within `storeSceneMedia` (in `media-utils.ts`). It prepares to call the backend API via `storeMediaContent`, logs the parameters, but the actual API request (`POST /api/v1/media/store`) is never received by the backend.
- This suggests an error might be occurring within `storeSceneMedia` just before or during the `await storeMediaContent(...)` call, or there's an issue within `storeMediaContent` itself in `api-client.ts`.

### Next Steps
1.  Add more detailed logging within `storeSceneMedia` in `web/frontend/src/lib/media-utils.ts` immediately before and after the `await storeMediaContent(...)` call to pinpoint the exact failure point and capture any potential errors.
2.  Retest adding a scene.
3.  Analyze the new detailed logs.

### Test Action
Re-examine `storeSceneMedia` call signature and network logs (2025-04-15)

### Expected Outcome
- Confirm if the `storeSceneMedia` call in `ProjectProvider.tsx` (L462) uses the correct arguments.
- Confirm if the network call to `/api/v1/projects/.../store-media` is being made.

### Observed Outcome
- **Code Review:** Re-examined `web/frontend/src/components/project/ProjectProvider.tsx` around line 462. The call signature `storeSceneMedia(scene, project, updateSceneMedia)` *does* match the function definition in `web/frontend/src/lib/media-utils.ts`. The arguments passed are correct.
- **Browser Console Errors:** The same unrelated `NaN` warning for `TimelineControl` persists.
- **Network Logs:**
    - **Success:** Confirmed successful requests for hot updates and `/api/v1/voice/voices`.
    - **Errors:** Network error logs are empty.
    - **Missing Call:** There is **NO** network request logged for `/api/v1/projects/{projectId}/scenes/{sceneId}/store-media` (or similar pattern).

### Analysis
- The previous assumption that the arguments passed to `storeSceneMedia` at L462 were incorrect was based on an outdated view or misunderstanding. The call signature is actually correct as currently written in the file.
- The network logs definitively show that the frontend is **not** initiating the API call to store the media.
- Therefore, the issue is not with the *arguments* of the `storeSceneMedia` call at L462, but rather that the conditions required for this call to be made within the surrounding `useEffect` are not being met, or the effect itself is not running as expected after the scene state is updated.

### Next Steps
1.  Re-investigate the conditions within the `useEffect` hook in `ProjectProvider.tsx` (around L453-479). Check if `scenesNeedingStorageIds` contains the new scene ID, if `state.currentProject?._id` is available, and if `scene` and `scene.media?.url` are correctly populated when the effect runs.
2.  Consider if the `NaN` warning in `TimelineControl.tsx` could be interfering, although it seems unrelated.
3.  Update investigation documentation (this file).

### Test Action
Retest scene addition after various `useEffect` hook fixes (2025-04-15)

### Expected Outcome
- Frontend `useEffect` in `ProjectProvider.tsx` should correctly identify scenes needing storage and trigger `storeSceneMedia`.

### Observed Outcome
- **Attempt 1 (Fix `NaN` Warning):** Fixed `NaN` warning in `TimelineControl.tsx` by adding duration checks. Warning persisted initially due to stale code, but disappeared after user action forced a reload.
- **Attempt 2 (Modify `useEffect` Dependency):** Added `state.currentProject.scenes` to the dependency array of the media storage `useEffect`. Console logs confirmed the effect ran, but still found 0 scenes needing storage (`[EFFECT STORAGE] Running effect. Found 0 scenes...`). Network logs confirmed no `/store-media` API call was made.
- **Attempt 3 (Refactor `useEffect` Logic):** Removed the `useMemo` hook for `scenesNeedingStorageIds` and moved filtering logic directly inside the `useEffect`. Console logs again showed the effect ran but found 0 scenes needing storage (`[EFFECT STORAGE] Running effect. Found 0 scenes...`). Network logs confirmed no `/store-media` API call was made.
- **Attempt 4 (Add Debug Logs to `addScene`):** Restored `useEffect` logic. Added detailed logs inside the `addScene` function (after `extractContent` and before `ADD_SCENE_SUCCESS` dispatch). Console logs confirmed:
    - `addScene` executed.
    - `extractContent` returned successfully with a valid `media_url`.
    - The payload for `ADD_SCENE_SUCCESS` correctly included the scene object with the `media.url`.
    - The `useEffect` *subsequently* ran and correctly identified the scene (`[EFFECT STORAGE] Running effect. Found 1 scenes...`).
    - `storeSceneMedia` was called (`[EFFECT STORAGE] Calling storeSceneMedia...`).
    - Logs from *inside* `storeSceneMedia` appeared, up to the point *before* the actual API call (`[MEDIA-DEBUG] ===> ATTEMPTING storeMediaContent API call...`).
- **Network Logs (Attempt 4):** Still confirmed **NO** network call to `/api/v1/media/store` was made.

### Analysis
- Ruled out issues with `useEffect` dependencies, reducer immutability, and the basic data flow within `addScene` up to the point of dispatching the state update.
- The `useEffect` *is* now correctly detecting the scene and calling `storeSceneMedia`.
- The failure point is now isolated to within the `storeSceneMedia` function (in `lib/media-utils.ts`), specifically around the `await storeMediaContent(...)` call. The function logs its intent to call the API, but the call never appears in network logs, and subsequent logs within `storeSceneMedia` do not execute.

### Next Steps
1.  Investigate the `storeSceneMedia` function in `web/frontend/src/lib/media-utils.ts` more closely.
2.  Specifically examine the call to `storeMediaContent` (imported from `api-client.ts`) and the surrounding `try...catch` block.
3.  Determine why the `await storeMediaContent(...)` call might be failing silently or preventing further execution without logging an error or showing up in network requests.

3.  Update investigation documentation (this file).

### Test Action
Retest scene addition after simplifying useEffect dependency and check user-provided logs (2025-04-15)

### Expected Outcome
- Detailed logs from within the media storage `useEffect` in `ProjectProvider.tsx` should clarify the state when it runs.
- Specifically, check if `state.currentProject._id` is defined.

### Observed Outcome
- **Tool Failure:** MCP Log retrieval tool failed to return relevant logs.
- **User Logs Provided:** Manual logs confirmed the following sequence after adding a scene:
  - `[EFFECT STORAGE - ENTRY] Effect triggered.` (Effect runs)
  - `[EFFECT STORAGE - STATE CHECK] currentProject ID: proj_m9ip2p5i` (Local ID is present)
  - `[EFFECT STORAGE - STATE CHECK] currentProject MongoDB _id: undefined` (Database _id is MISSING)
  - `[EFFECT STORAGE - STATE CHECK] updateSceneMedia function exists: true`
  - `[EFFECT STORAGE] Condition not met: state.currentProject._id is missing.` (The main `if` condition fails)
  - `[EFFECT STORAGE] Effect finished.` (Effect exits without calling `storeSceneMedia`)

### Analysis
- The user-provided logs definitively confirm the root cause: the `useEffect` hook responsible for triggering media storage runs *before* the `state.currentProject` object in its scope contains the necessary MongoDB `_id`.
- The timing issue prevents the `if (state.currentProject?._id ...)` check from passing, thus blocking the call to `storeSceneMedia` and halting the media storage pipeline at the frontend stage.
- Previous analysis based on faulty tool logs was incorrect.

### Next Steps
1.  Implement a fix in `ProjectProvider.tsx` to ensure the `useEffect` only attempts to process scenes for storage when `state.currentProject._id` is confirmed to be present and valid.
2.  Retest the scene addition flow.
3.  If the frontend successfully calls `/api/v1/media/store`, proceed to check backend and Celery logs.

---

### Test Action
Analyze Project Creation Flow and Impact on Media Storage Trigger (2025-04-16)

### Expected Outcome
Understand how and when `state.currentProject._id` (MongoDB ObjectId) is populated after project creation, and determine if it's available when the media storage `useEffect` runs for the first scene added to a new project.

### Observed Outcome
- **Code Analysis (`ProjectProvider.tsx`, `ProjectReducer.ts`):**
    - The `createProject` context function dispatches `CREATE_PROJECT`.
    - The reducer handles `CREATE_PROJECT` by creating a **local project object** in state with a temporary frontend `id` (e.g., `proj_...`) but **`_id: undefined`**.
    - Actual saving to the backend (MongoDB) happens later via the `saveCurrentProjectBackend` function, triggered by auto-save or manual save.
    - `saveCurrentProjectBackend` checks if `_id` is missing. If so, it calls the `createProjectAPI` function (`lib/api/projects.ts`).
    - The backend `/projects` endpoint creates the document in MongoDB, generating the real `_id`.
    - The API response containing the full project data (including `_id`) is returned to `saveCurrentProjectBackend`.
    - `saveCurrentProjectBackend` then dispatches `LOAD_PROJECT_SUCCESS` with the complete project data.
    - The reducer handles `LOAD_PROJECT_SUCCESS` by updating `state.currentProject`, finally setting the `_id` field.
- **Timing Conclusion:** The MongoDB `_id` is only populated in the frontend state *after* the first successful backend save completes.

### Analysis
- **Root Cause Confirmed:** The two-step project creation process (local object first, delayed backend save) is the direct cause of the media storage failure for *new* projects.
- When the first scene is added to a newly created project, the media storage `useEffect` in `ProjectProvider.tsx` executes *before* the backend save has occurred.
- Consequently, `state.currentProject._id` is `undefined` within the effect's scope at that critical moment.
- The check `if (!state.currentProject || !state.currentProject._id)` fails, preventing the call to `storeSceneMedia`.
- This blocks the entire media storage pipeline (API call -> Celery -> R2) specifically for the first scene added to any brand-new project.
- **User Observation Context:** While this internal timing issue is confirmed, the user's recollection that storage *might* have worked previously on this commit remains. This suggests that *if* issues persist after fixing this internal bug, investigation into *external factors* (e.g., `.env` files, Docker config changes, R2 settings, expired keys) might be necessary as a potential *secondary* problem.

- **UPDATE (2025-04-16):** Further investigation combining frontend and backend logs revealed a deeper issue. While the missing `_id` is the immediate blocker, the underlying cause is that the frontend logic within `addScene` (specifically the call to `saveCurrentProjectBackendCallback`) is **failing to trigger the initial backend save** (`createProject` API call) for the newly created project. The backend logs confirm the `POST /api/v1/projects` endpoint is never hit in this scenario. Therefore, the `_id` is never generated by the database, and the `useInitialMediaStorage` hook (which correctly waits for the `_id`) never receives it.

### Next Steps
- Modify the frontend logic (`ProjectProvider.tsx` primarily) to correctly handle the delay in `_id` availability. Ensure `storeSceneMedia` is triggered appropriately *after* a new project has been successfully saved to the backend and its `_id` is available in the state. (Specific implementation TBD).
- **UPDATE (2025-04-16):** 
- 1. **Fix Initial Save Trigger:** Re-examine and fix the `saveCurrentProjectBackendCallback` function in `ProjectProvider.tsx`. Ensure the `if (!projectToSave._id)` condition correctly leads to an `await createProject(...)` API call, and that this call executes successfully.
- 2. **Verify `_id` Population:** Confirm that after the successful `createProject` API call, the returned project data (containing the MongoDB `_id`) is correctly dispatched via `LOAD_PROJECT_SUCCESS` to update the frontend state.
- 3. **Test Full Flow:** Retest the full flow focusing on creating a *new* project and adding the first scene, verifying the backend save occurs, the `_id` becomes available, and the `useInitialMediaStorage` hook subsequently triggers the media storage pipeline.
- 4. **Address External Factors (If Necessary):** If storage still fails after fixing the internal save trigger, investigate potential external factors.

3.  Update investigation documentation (this file). 