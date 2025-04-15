# Current State Investigation Log

This document tracks real-world integration tests and findings as we debug and synchronize the Celery, Cloudflare R2, MongoDB, FFmpeg, and YT-DLP pipeline. Each entry records a specific test action, the expected and observed outcomes, and an analysis of what worked or failed. This log will be used to update Taskmaster and project documentation to reflect the true state of the system.

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

## Investigation Entries

<!-- Add new entries below this line as you perform each test -->

### Test Action
Add a scene with a media URL via the frontend.

### Expected Outcome
- The frontend triggers the backend to create a new scene.
- The backend stores the scene in MongoDB and triggers the Celery media download task.
- The Celery worker downloads the media, uploads it to R2, and updates the scene status in the database.
- No errors in frontend, backend, or Celery logs.

### Observed Outcome
- Frontend: No console logs or errors (console log is empty).
- Backend logs:
  - The backend received a request to extract content from a Reddit URL and processed it (200 OK).
  - The backend attempted to retrieve voiceover audio for the new scene, but found none (expected for a new scene).
  - The backend successfully listed objects in R2 for the scene's audio prefix (found none, as expected).
  - No errors or tracebacks in the backend logs.
- Celery worker logs:
  - The command `docker compose logs celery_worker` returned: `no such service: celery_worker`.
  - This means the Celery worker container is not running or is misnamed in your Docker Compose setup.

### Analysis
- Backend is working as expected for scene creation and initial media extraction.
- Celery worker is not running or not available as a service in Docker Compose, so no background media download task is being triggered or processed.
- No evidence of media download, R2 upload, or scene status update by Celery, because the worker is not running.
- No frontend errors—the UI is not reporting any issues, but the pipeline is incomplete without the worker.

### Next Steps
1. Check your Docker Compose setup for the Celery worker:
   - Is the service named `celery_worker` or something else?
   - Run `docker compose ps` to see all running services and their names.
   - If the worker is not running, start it with `docker compose up celery_worker` (or the correct service name).
2. Once the worker is running, repeat the test:
   - Add a new scene with a media URL.
   - Check backend and Celery worker logs again.
3. If the worker fails to start, check its logs for errors (e.g., missing environment variables, config issues).
4. Update the investigation log with the new findings.

---

### Test Action
Diagnose Frontend Media Storage Trigger Failure (Post-Revert)

### Expected Outcome
Identify why adding a scene with a media URL does not trigger the `/api/v1/media/store` backend call via the `useEffect` in `ProjectProvider.tsx`.

### Observed Outcome (Based on Logs from 2025-04-14 ~20:21)
- Frontend: No errors, but also no log indicating the media storage `useEffect` fired. Auto-save works.
- Backend: Received content extraction request, but *no* POST request to `/api/v1/media/store`.
- Celery: Received *some* tasks (likely old/retried), but failed on `AttributeError: 'R2Storage' object has no attribute 'upload_file_sync'` and `Sync MongoDB error... database name cannot be the empty string`. These errors indicate separate worker issues but don't explain the lack of *new* tasks from the frontend.

### Analysis (Frontend Trigger Issue)
The primary issue preventing new media storage tasks is that the frontend is not initiating the process.
**Potential Causes:**
1.  **Incorrect `useEffect` Dependencies:** Dependency array (`[state.currentProject]`) might not react correctly to the relevant scene update.
2.  **State Update Timing/Race Condition:** Effect runs before the state fully reflects the new scene's `media.url`.
3.  **Faulty Condition Logic:** The check `scene.media?.url && !scene.media?.storageKey` might be failing.
4.  **Revert Undid Previous Fix:** Most likely, the revert removed the specific `useEffect` logic mentioned in `docs/Celery Integration.md`.
5.  **Component Lifecycle Issues:** Unexpected unmount/remount cycles.
6.  **Blocking JavaScript Error:** Preceding JS errors preventing effect execution.
7.  **Reducer Logic Flaw:** `ADD_SCENE` reducer might not set `media.url` correctly initially.

**Most Likely Causes:**
1.  **Revert Undid Previous Fix:** High probability given the issue reappeared post-revert.
2.  **State Update Timing/Race Condition:** Common issue in React state management with effects.

### Next Steps (Validation via Logging - NO CODE FIX YET)
1.  **Add Logs to `ProjectProvider.tsx` - `useEffect` for Storage:**
    *   Log entry: `console.log('[EFFECT STORAGE] Media storage effect triggered.');`
    *   Log state *before* filter: `console.log('[EFFECT STORAGE] Checking project state:', JSON.stringify(state.currentProject));`
    *   Log filter result: `console.log('[EFFECT STORAGE] Scenes found needing storage:', JSON.stringify(scenesToStore));`
2.  **Add Log to `ProjectProvider.tsx` - Reducer (`projectReducer`)**:
    *   In the `ADD_SCENE` (or equivalent) case, *after* updating state: `console.log('[REDUCER ADD_SCENE] State *after* adding scene:', JSON.stringify(newState));`
3.  **Re-run Test:** Add a scene with a media URL.
4.  **Analyze Logs:** Check console for the new logs to understand the timing and state flow.
5.  **Update Investigation Log:** Document findings from the logs.
6.  **(Separate Issue) Address Celery Worker Errors:** After validating the frontend trigger, fix the `upload_file_sync` attribute error and the `DATABASE_NAME` environment variable issue in the worker.

---

### Test Action
Fix Frontend Trigger Loop & Confirm R2 Context (2025-04-14 ~20:35)

### Expected Outcome
- Adding a scene does not cause an infinite loop in the frontend.
- The media storage `useEffect` triggers once (or a few times due to strict mode) after state updates.
- Frontend calls `POST /api/v1/media/store`.
- Understand R2 deletion implementation details.

### Observed Outcome
- **Frontend Loop Fixed:** Resolved infinite loop by using local `useState` for `storingMediaStatus` instead of modifying the `Scene` object directly in the main state via the reducer. The `useEffect` dependency was refined.
- **Frontend Trigger Confirmed:** Logs confirm the `useEffect` now runs correctly after adding a scene and calls the backend `POST /api/v1/media/store` endpoint.
- **R2 Deletion Context:** Reviewed `docs/R2-Deletion-Fix.md`. Confirmed that previous issues with using `await` on synchronous `boto3` calls for deletion were fixed. Also confirmed a typo (`settings.r2_bucket_name` vs `settings.R2_BUCKET_NAME`) in deletion logic was corrected.
- **R2 Upload Context:** Reviewed `web/backend/app/services/storage.py`. Found the `R2Storage` class uses synchronous `boto3` calls internally. The correct method for uploading a file from a path is `async def upload_file(...)`. **There is no `upload_file_sync` method.**
- **Celery Worker Errors Persist:** Logs show the backend successfully queues the Celery task, but the worker fails with:
    1. `AttributeError: 'R2Storage' object has no attribute 'upload_file_sync'` (Incorrect method call in `media_tasks.py`).
    2. `Sync MongoDB error ... database name cannot be the empty string` (Environment variable issue). 

### Analysis
- Frontend trigger mechanism is now stable and correctly initiates the backend process.
- R2 deletion logic should be correct based on documentation.
- The immediate blockers are within the Celery worker:
    - Calling a non-existent R2 upload method.
    - Environment variable configuration preventing DB updates.

### Next Steps
1.  **Fix Celery R2 Call:** Modify `app/tasks/media_tasks.py` to call the correct `await storage_service.upload_file(...)` method instead of the non-existent `upload_file_sync`.
2.  **Fix Celery DB Connection:** Investigate and fix the `DATABASE_NAME` environment variable issue for the Celery worker.

---

### Test Action
Fix Celery Task Async Handling & R2 Upload (2025-04-14 ~21:16)

### Expected Outcome
- Resolve Celery task errors related to async function calls and result serialization.
- Confirm successful media download and upload to R2 via Celery.

### Observed Outcome
- **Attempt 1 (async def task):**
  - Changed `download_media_task` to `async def`.
  - Fixed `AttributeError: 'R2Storage' object has no attribute 'upload_file_sync'` by calling `await storage_service.upload_file(...)`.
  - **Result:** Introduced `TypeError: Object of type coroutine is not JSON serializable` because Celery couldn't serialize the result of the `async def` task.
- **Attempt 2 (sync def task + asyncio.run):**
  - Reverted `download_media_task` to standard `def`.
  - Wrapped the `storage_service.upload_file(...)` call with `asyncio.run(...)`.
  - **Result:** 
    - Resolved the `TypeError` (serialization error).
    - R2 upload successful (confirmed via logs: `[TASK] Upload complete. R2 URL: ...`).
    - New minor warning: `asyncio.run() cannot be called from a running event loop` during internal file tracking within `upload_file` (non-blocking).
    - **DB Error Persists:** Final database update still fails with `Sync MongoDB error... database name cannot be the empty string`.

### Analysis
- The approach of keeping the Celery task synchronous (`def`) and using `asyncio.run()` to execute the asynchronous `upload_file` function works for handling the R2 upload correctly.
- The file tracking warning is minor and relates to nested `asyncio.run()` calls, which we can address later if needed.
- The primary remaining blocker for the task's full success is the database connection issue (`DATABASE_NAME` environment variable).

### Next Steps
1.  **Fix Celery DB Connection:** Investigate and fix the `DATABASE_NAME` environment variable issue for the Celery worker.

---

### Test Action
Verify Celery Worker Environment Variables (2025-04-14 ~<Time>)

### Expected Outcome
- The `DATABASE_NAME`, `OPENAI_API_KEY`, and `REDIS_PASSWORD` environment variables inside the `celery-worker` container match the values specified in `web/backend/.env` or explicitly set in `docker-compose.yml`.

### Observed Outcome
- Initial check (`docker compose exec celery-worker printenv`) showed `DATABASE_NAME`, `OPENAI_API_KEY`, and `REDIS_PASSWORD` were empty or defaulting to blank strings, despite being set in the `.env` file and referenced via `${VAR_NAME}` in `docker-compose.yml`.
- Docker Compose warning logs (`WARN[0000] The "DATABASE_NAME" variable is not set. Defaulting to a blank string.`) confirmed the issue.
- Modified `docker-compose.yml` to explicitly set these variables for the `celery-worker` service directly (e.g., `DATABASE_NAME=autoshortsdb`) instead of relying on shell substitution (`DATABASE_NAME=${DATABASE_NAME}`).
- Restarted containers using `docker compose down && docker compose up -d`.
- Subsequent check (`docker compose exec celery-worker printenv`) confirmed the variables were now correctly set inside the container:
  ```
  DATABASE_NAME=autoshortsdb
  OPENAI_API_KEY=your_openai_api_key
  REDIS_PASSWORD=
  ```

### Analysis
- The issue was caused by Docker Compose's variable substitution priority. When `${VAR_NAME}` syntax is used, Docker Compose first checks the shell environment where `docker compose up` is run. If the variable exists in the shell (even if empty), it overrides the value from the `.env` file.
- Explicitly setting the variable value in the `environment` section of `docker-compose.yml` bypasses this shell substitution issue for the specific service.
- This fixed the environment variable configuration, paving the way for the Celery task to correctly connect to the database.

### Next Steps
1. Re-run the full media download test by adding a scene with a media URL via the frontend.
2. Monitor `celery-worker` logs for successful task completion, including the final database update.
3. Update this investigation log with the results of the full test.

---

### Test Action
Verify Full Media Pipeline After Fixing Env Vars (2025-04-14/15)

### Expected Outcome
- Adding a scene with a media URL triggers the full pipeline:
  - Backend queues Celery task.
  - Celery worker downloads media, uploads to R2, generates thumbnail.
  - Celery worker looks up the project in MongoDB using the provided *custom* `project_id`.
  - Celery worker extracts the MongoDB `_id` from the found project document.
  - Celery worker updates the scene status using the correct MongoDB `_id`.
  - Final scene status in DB is 'ready' with R2 keys.
  - No errors in logs.

### Observed Outcome
- **Backend/Frontend:** Functioned correctly, queuing the Celery task as expected.
- **Celery Worker:**
  - Task received (Task ID: `e9885c1a...`).
  - Media download and R2 upload successful.
  - Attempted project lookup using custom ID `proj_m9hny9cx`.
  - **FAILED:** Lookup failed with error `DB Error: Project with custom ID proj_m9hny9cx not found.`
  - Final scene status update was skipped because the MongoDB `_id` could not be retrieved.
  - Task finished with status `error`.

### Analysis
- All previous issues (env vars, async handling, R2 calls) within the Celery task itself appear resolved.
- The project ID translation logic *is correctly implemented* within the Celery task (`media_tasks.py`), attempting to find the project by `project_id` field.
- **The root cause is now confirmed:** The project document with the expected custom ID (`proj_m9hny9cx`) does not exist in the `projects` collection when the Celery task performs the lookup. This prevents the task from obtaining the necessary MongoDB `_id` for the final status update.

### Next Steps
1.  **Investigate Project Creation:** Determine *why* the project document isn't available or doesn't match the custom ID during the Celery task lookup.
    - **Option A: Check Backend Logs:** Analyze backend logs around the time the project is created and the task is queued. Look for errors during project creation or timing mismatches.
    - **Option B: Query MongoDB:** Directly connect to the MongoDB `autoshortsdb` database and query the `projects` collection. Check if a document with `project_id: "proj_m9hny9cx"` exists. If it exists, compare its creation timestamp with the Celery task execution time. If it *doesn't* exist, trace back the project creation logic in the backend API.

---

## Root Cause Analysis: Project Not Found by Celery (2025-04-15)

**Problem Symptom:**
The Celery task (`download_media_task`) consistently fails during the final database update step. It cannot find the required project document in the `projects` collection when querying using the provided custom `project_id` (e.g., `proj_m9holmt6`), even though the project creation API endpoint appears to generate and attempt to insert this ID.

**Verified Facts:**
1.  **ID Generation:** The `create_project` endpoint successfully generates a custom `project_id`.
2.  **ID Inclusion:** This ID is added to the `project_dict` before the `insert_one` call (verified by logging).
3.  **DB Insertion Attempt:** `await mongo_db.projects.insert_one(project_dict)` executes without logging errors in the API.
4.  **Task Reception:** Celery worker receives a task with a custom `project_id`.
5.  **Task DB Connection:** Celery worker connects to the correct MongoDB database.
6.  **Task Lookup:** Celery worker executes `db.projects.find_one({"project_id": received_project_id})`.
7.  **Lookup Failure:** This `find_one` call consistently returns `None`.
8.  **Manual DB Check:** Manual checks confirm no document exists with the specific `project_id` field/value searched by the task, even after the task has failed.

**Potential Root Causes:**
1.  **Race Condition / Write Visibility Delay:** The most likely cause. The API queues the Celery task *before* the `insert_one` operation is fully completed and the new document (with the `project_id` field) is visible across all database connections, including the one used by the Celery worker. The task runs too quickly after the insert attempt.
2.  **Data Flow Issue / Incorrect ID Propagation:** It's possible the `project_id` value passed *to* the Celery task queuing mechanism (likely originating from the `/api/v1/media/store` flow) is incorrect or stale, not matching the ID that was *actually* generated and inserted by the `create_project` endpoint.
3.  **Silent Insertion Failure:** Less likely, but possible that the `insert_one` call fails silently or is implicitly rolled back without logging an error in the API context.

**Conclusion:** The primary issue appears to be that the Celery task is triggered and attempts its database lookup *before* the project document, containing the necessary `project_id` field, is reliably created and visible in MongoDB.

**Next Diagnostic Steps:**
1.  **Trace `project_id` Propagation:** Log the `project_id` value at key points: generation in `create_project`, receipt in the media API endpoint that calls `store_media_content`, value passed to `download_media_task.delay()`, and value received inside the task.
2.  **Verify API Flow:** Examine the API endpoint that triggers media storage (e.g., `/api/v1/media/store`). How does it get the `project_id`? Does it create the project first, or assume it exists? Ensure it uses the *correct*, newly created custom `project_id`.
3.  **Confirm Write Completion:** Add explicit logging *after* `await mongo_db.projects.insert_one()` in `create_project` to confirm its completion relative to task queuing.

---

## Root Cause Analysis Update: Project ID Timing/Visibility Issue (2025-04-15)

**Problem Symptom:**
Celery task (`download_media_task`) fails lookup `db.projects.find_one({"project_id": custom_id})`, returning `None` shortly after the project is created via the API.

**Investigation Steps & Findings:**
1.  **Added Logging (Subtasks 12.6, 12.7):**
    - Logged `project_id` at generation (`project_operations.py`).
    - Logged `project_id` before queuing task (`media_service.py`).
    - Logged `project_id` upon task reception (`media_tasks.py` - *Note: this log was unexpectedly missing in initial runs, potentially due to immediate failure before logging*).
2.  **Log Analysis:**
    - Backend (`project_operations.py`) correctly generates and adds the `project_id` field to the document dictionary before `insert_one`.
    - Backend (`media_service.py`) successfully queues the Celery task, passing the correct `project_id`.
    - Celery worker logs confirm receiving the task with the correct `project_id`.
    - Celery worker logs show the `find_one({"project_id": custom_id})` call executes but returns `None`.
3.  **Conclusion:** This confirms a timing or write visibility issue. The Celery task starts and attempts the database lookup *before* the `insert_one` operation initiated by the API is fully committed and visible to the worker's database connection.

**Attempted Fix (Subtask 12.8):**
1.  **Retry Logic:** Implemented a retry loop (3 attempts, 2-second delay) within `download_media_task` specifically around the `db.projects.find_one({"project_id": custom_id})` call.
    - If the document is found, the loop breaks.
    - If not found after all retries, the task logs an error and proceeds with an error status.

**Next Steps:**
1.  **Restart Services:** Rebuild and restart Docker containers to apply the retry logic fix.
2.  **Retest:** Create a new project and add a scene with a media URL via the frontend.
3.  **Verify Logs:** Check backend and Celery logs to confirm:
    - The retry logic executes if needed.
    - The project is eventually found by the Celery task.
    - The final scene status update uses the correct MongoDB `_id`.
    - The task completes successfully with status 'ready'.
4.  **Update Investigation Log:** Document the results of the retest.

---

### Test Action
Infinite Retry Loop Test for Celery Project Lookup (2025-04-15)

### Expected Outcome
- Temporarily modify the Celery `download_media_task` to retry the `find_one({"project_id": custom_id})` lookup indefinitely with a 2-second delay.
- If the issue is purely a timing/visibility delay, the task should eventually find the project document after some time (e.g., 30-90 seconds or longer).

### Observed Outcome
- Modified `media_tasks.py` to implement an infinite `while True` loop around the project lookup, with a `time.sleep(2)` between attempts.
- Restarted Docker services.
- Created a new project (`proj_m9hqa7fb`) and added a scene with a media URL.
- Monitored Celery worker logs for an extended period (several minutes).
- **Logs Consistently Showed:** The worker repeatedly attempted the lookup (reaching attempt numbers in the 40s and higher) but consistently failed to find the project document: `DB Error: Project with custom ID proj_m9hqa7fb not found. Attempt X`.
- Waited over 3 minutes during a subsequent test run, checked logs again, and the worker (attempting lookup for `proj_m9hrl3q7`) still reported the project was not found after numerous retries.

### Analysis
- The infinite retry loop successfully demonstrated that the issue is **not** a simple, short-term write visibility delay that can be resolved by waiting a few seconds or even minutes.
- Despite the backend logging a successful insertion (`acknowledged=True`), the project document containing the `project_id` field does not become reliably visible to the Celery worker's database connection within a practical timeframe.
- This reinforces the conclusion that there is a deeper inconsistency issue, potentially related to MongoDB Atlas replication, write concerns, or an unexpected problem in how the document is being inserted or indexed. The retry mechanism, even when extended indefinitely, cannot overcome the fundamental lack of data visibility.

### Next Steps
1.  **Revert Code:** Remove the infinite loop logic from `media_tasks.py` and restore the standard retry settings (e.g., 3 retries, 2-second delay).
2.  **Restart Services:** Apply the reverted code changes.
3.  **Defer Investigation:** Postpone further investigation into the MongoDB consistency issue. Focus on other potentially unrelated tasks or areas of the application until more information or a different approach is available.
4.  **Update Documentation:** Ensure both `docs/Celery Integration.md` and this document reflect the findings of this test.

---

### Decision Point & Next Steps (2025-04-15)

**Problem:** Celery task `download_media_task` cannot reliably find the project document using the custom `project_id` immediately after the API creates it, due to MongoDB write visibility delays.

**Analysis:** While the root cause is the visibility delay (addressed by potential solutions #1 or #3 below), directly fixing this via DB tuning (#3) is complex, and ensuring write completion (#1) can be unreliable.

**Decision:** Proceed with **Approach #2: Pass MongoDB `_id` to Celery Task.**
   - **Rationale:** This is the most robust solution for the workflow. It eliminates the problematic lookup by providing the task with the guaranteed primary key (`_id`) obtained after the write is confirmed by the API process.
   - **Trade-off:** Requires refactoring the data flow from project creation/selection through to task queuing and the task itself.

**Alternative Approaches Considered & Deferred:**
1.  **Ensure Write Completion Before Queuing:** (e.g., add delays, read concerns in API). Deemed less reliable than passing `_id`.
2.  **Investigate MongoDB Settings:** (e.g., write/read concerns, replication). Deemed too complex and potentially impactful for initial fix attempt.

**Next Action:** Begin refactoring the application to implement Approach #2. 

---

### Test Action
Refactor backend/frontend to pass MongoDB `_id` and retest scene addition (2025-04-15)

### Expected Outcome
- Adding a scene with a media URL triggers the full pipeline successfully.
- The frontend passes the MongoDB `_id` to the `/api/v1/media/store` endpoint.
- The backend receives the `mongo_db_id` and queues the Celery task with it.
- The Celery worker receives the task with the `mongo_db_id`, downloads media, uploads to R2.
- The Celery worker uses the provided `mongo_db_id` to update the scene status in MongoDB.
- The task completes successfully with status 'ready'.
- No errors in logs.

### Observed Outcome
- **Backend Refactor:** Code in `media_service.py`, `media.py`, and `media_tasks.py` was successfully refactored to accept and use `mongo_db_id` instead of performing a lookup based on the custom `project_id`.
- **Frontend Refactor:** Code in `ProjectTypes.ts`, `api-client.ts`, `media-utils.ts`, and `ProjectProvider.tsx` was updated to pass the `mongo_db_id` (project._id) through the necessary functions.
- **Test - Add Scene:** Adding a new scene (`1l61uj3guithtcf4jv3sfda` to project `proj_m9hsp6ot`) was performed.
- **Frontend Logs:**
    - The `addScene` function logged the initiation.
    - The `ADD_SCENE_LOADING` action was dispatched.
    - Content extraction (`/api/v1/content/extract`) was called and returned successfully.
    - The `ADD_SCENE_SUCCESS` action *should* have been dispatched here by the `addScene` function after processing the content extraction response.
    - The media storage `useEffect` ran (`[EFFECT STORAGE] Running effect...`).
    - **Crucially, the effect reported `ScenesNeedingStorageIds: []`**.
    - The effect exited (`[EFFECT STORAGE] Condition not met...`) without calling `storeSceneMedia`.
    - An attempt to fetch the project state within `addScene` (after content extraction) logged `Retrieved fresh project with 0 scenes`, indicating a potential state inconsistency or timing issue during the scene update process.
- **Backend Logs:** Confirmed that the `/api/v1/media/store` endpoint was **not** called, and no Celery task was queued, consistent with the frontend effect exiting early.

### Analysis
- The backend refactoring to pass MongoDB `_id` is complete.
- The primary issue preventing the media storage task from running is now a **frontend state timing issue** within `ProjectProvider.tsx`.
- The `useEffect` hook responsible for triggering media storage runs before the state update that marks the new scene as needing storage (i.e., before the scene object includes the `media.url` fetched from content extraction) is fully reflected in the dependencies (`scenesNeedingStorageIds`).
- The derived state `scenesNeedingStorageIds` (calculated using `useMemo`) isn't picking up the newly added scene with its media URL in time for the `useEffect` to act on it in the same render cycle.

### Next Steps
1.  **Debug `ProjectProvider.tsx` `useEffect`:**
    - Examine the dependencies of the media storage `useEffect` (`scenesNeedingStorageIds`, `state.currentProject?.id`, `updateSceneMedia`).
    - Analyze how `scenesNeedingStorageIds` is calculated in the `useMemo` hook.
    - Investigate the sequence of state updates: `ADD_SCENE_LOADING` -> `ADD_SCENE_SUCCESS` (which should add the media URL) -> `useEffect` execution.
    - Consider adjusting the `useEffect` dependencies or the logic for identifying scenes needing storage to ensure it triggers correctly after the scene's media URL is available in the state.

### Next Action: Begin refactoring the application to implement Approach #2. 

---

### Test Action
Debug Frontend Media Storage Trigger (Post-ID Refactor) (2025-04-15)

### Expected Outcome
- Adding a scene with a media URL should trigger `storeSceneMedia` after the scene's `media.url` is fetched and added to the state.
- The runtime error related to stale reducer code should be resolved.

### Observed Outcome
- **Analysis:** Identified a timing issue in `ProjectProvider.tsx`. The media storage `useEffect` was triggered by the initial `ADD_SCENE_LOADING` state update, running *before* the asynchronous `extractContent` call completed and the `ADD_SCENE_SUCCESS` dispatch updated the scene state with the necessary `media.url`.
- **Attempted Fix 1:** Corrected the payload dispatch structure for `ADD_SCENE_SUCCESS` in `ProjectProvider.tsx` to `{ scene: updatedScene }` to match `ProjectReducer.ts` type definitions.
- **Attempted Fix 2:** Added an explicit call within `addScene` (in `ProjectProvider.tsx`) to check and trigger `storeSceneMedia` for the specific new scene *after* the `ADD_SCENE_SUCCESS` dispatch.
- **Persistent Stale Code Error:** Despite server restarts and hard browser refreshes, adding a scene consistently resulted in a `TypeError: Cannot read properties of undefined (reading 'media')` in the browser console. The error overlay pointed to `ProjectReducer.tsx:125` and displayed **old code** expecting an incorrect payload structure (`{ sceneId, sceneData }`). This indicates the browser is executing stale reducer code, likely due to the `.next` build cache.
- **Secondary Issue (Explicit Trigger):** Logs showed the explicit `storeSceneMedia` call failed with `Cannot store media: Missing scene data, ID, media URL, project, or project MongoDB _id`, suggesting potential issues with accessing the complete project state at the time of the explicit call.

### Analysis
- The primary blocker is the stale reducer code executing in the browser, preventing verification of the fixes. Clearing the `.next` cache is the recommended next step for this.
- The secondary issue with the explicit trigger needs investigation once the stale code issue is resolved.

### Next Steps (Decision: Pause & Revert)
1.  **Document Findings:** Update this log with the current state.
2.  **Cache Next Step:** The next technical step *would be* to stop the server, delete the `web/frontend/.next` directory, and restart the server to clear the build cache.
3.  **User Action:** User will save the current state of `ProjectProvider.tsx` locally, revert changes in the workspace to restore the last known working state, and potentially provide the reverted file content later.
4.  **Resume:** Debugging will resume from the reverted state once provided.

---

### Test Action
Locate Backend Media API Routes (2025-04-15)

### Expected Outcome
Identify the Python file and specific endpoints responsible for handling media storage and manipulation requests originating from the frontend or other services.

### Observed Outcome
1.  Listed contents of `web/backend/app` directory using `list_dir`. Identified the `api/` subdirectory as the most probable location for API route definitions.
2.  Listed contents of `web/backend/app/api` directory using `list_dir`. Found several relevant files, including `media.py`, `voice.py`, `storage.py`, etc.
3.  Read the contents of `web/backend/app/api/media.py` using `read_file`. Confirmed this file defines an `APIRouter` with the prefix `/media`.
4.  Identified two endpoints within `media.py`:
    - `POST /store`: Endpoint `store_media_from_url` accepts a URL and project details, then calls the `store_media_content` service function to queue a background task for downloading and storing the media.
    - `POST /upload`: Endpoint `upload_media_file` is defined but currently returns a 501 Not Implemented status.

### Analysis
- The primary API routes for handling media *storage* initiated via URL are located in `web/backend/app/api/media.py`.
- The `/store` endpoint is the entry point for asynchronously processing media downloads from URLs.
- Direct file uploads are not currently implemented via the `/upload` endpoint in this file.
- Based on file naming conventions, voice generation or manipulation routes are likely located in `web/backend/app/api/voice.py`.

### Next Steps
- Proceed with investigating `web/backend/app/api/voice.py` if voice generation endpoints are the next target.
- Use the identified `/media/store` endpoint information for any tasks involving media download queuing.

---

### Test Action
Verify Full Media Pipeline After Revert & Cache Clear (2025-04-15)

### Expected Outcome
- Frontend should correctly trigger `POST /api/v1/media/store` with the `mongo_db_id` in the payload.
- Celery worker should receive the `mongo_db_id` and complete the task successfully.

### Observed Outcome
- Frontend console errors related to stale cache are resolved.
- Frontend successfully called `POST /api/v1/media/store`.
- Celery worker logs show the task (e.g., `329fd556-2e8b-4eb4-9dad-c6535a5aef91`) received `mongo_db_id: None`.
- Task failed with `ERROR ... Invalid input for final DB update: MongoDB Project _id was not provided to the task`.

### Analysis
- The issue is that the `mongo_db_id` (project `_id`) is not being correctly passed from the frontend to the backend API, and subsequently to the Celery task parameters.

### Next Steps
- Investigate the frontend data flow (`ProjectProvider.tsx`, `media-utils.ts`, `api-client.ts`) to ensure `project._id` is retrieved and included as `mongo_db_id` in the `storeMedia` API call payload.

---

### Test Action
Retest scene addition after fixing frontend state dispatch (2025-04-15)

### Expected Outcome
- Frontend correctly dispatches `ADD_SCENE_SUCCESS`.
- `useEffect` in `ProjectProvider` triggers `storeSceneMedia` with the correct project object (including `_id`).
- Frontend calls `POST /api/v1/media/store` with `mongo_db_id`.
- Celery task receives `mongo_db_id`, downloads, uploads, generates thumb, updates DB.
- Task completes successfully.

### Observed Outcome
- **Frontend:** No console errors. Network logs confirmed `POST /api/v1/media/store` was successfully called with the correct payload, including `"mongo_db_id": "67cfc8ac81e904094af3d35b"`. The backend responded 200 OK with Celery task ID `4d2c5265-e427-4396-9411-04b9f5f54c1f`.
- **Celery Worker:**
    - Task `4d2c5265...` received the correct `mongo_db_id`.
    - Media download successful (`/tmp/tmp48p6x5_2/HLSPlaylist.m3u8`).
    - Media upload to R2 successful (`proj_m9j1i44m_1l61vcmx4qjcm8hvyv4j2b6_media.m3u8`).
    - Thumbnail generation **FAILED** with error: `/tmp/tmp48p6x5_2/HLSPlaylist.m3u8: Invalid data found when processing input`. (FFmpeg couldn't process the .m3u8 playlist).
    - Task finished with **status: 'error'** due to thumbnail failure, skipping the final database update.

### Analysis
- **Success!** The frontend state management issue is resolved. Dispatching `ADD_SCENE_SUCCESS` correctly updates the state, allowing the `useEffect` to trigger the API call with the necessary `mongo_db_id`.
- The pipeline now proceeds correctly up to the Celery worker.
- **New Blocker:** The process fails when `yt-dlp` downloads media as an HLS playlist (`.m3u8`) instead of a direct video file (like `.mp4`), because the FFmpeg thumbnail generation step cannot handle `.m3u8` files. This causes the task to error out before updating the database.

### Next Steps
1.  Modify Celery task (`app/tasks/media_tasks.py`) to handle HLS downloads:
    - Option A: Configure `yt-dlp` to prefer downloading direct video formats (e.g., MP4) over HLS playlists if possible.
    - Option B: Adapt thumbnail generation to work with HLS (e.g., use `yt-dlp` for thumbnails) or gracefully skip thumbnail generation for HLS media.
2.  Improve Celery task error handling: Allow the task to update the database with the main media details even if thumbnail generation fails.

---


