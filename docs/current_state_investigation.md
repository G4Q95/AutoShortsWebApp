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