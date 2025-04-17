This document outlines the plan for implementing reliable background media downloading using Celery and `yt-dlp`, adopting a **hybrid synchronous/asynchronous approach** designed for scalability and responsiveness.

## Overall Goal
Implement reliable background media downloading from external URLs (initially focusing on Reddit) using Celery and `yt-dlp`. The implementation will use a **hybrid approach**:
- **FastAPI API Layer (Sync/Responsive):** Handles initial request validation, potentially creates initial DB record (synchronously or non-blockingly), dispatches the Celery task with a confirmed `_id`, and returns `202 Accepted` immediately.
- **Celery Worker (Async/IO-Bound):** Executes the background task using `async def`, an async worker pool (`gevent`), and async libraries (`motor`, `aiobotocore`, `asyncio`) to handle I/O-bound operations efficiently.

ync-native libraries for all I/O operations within tasks:
    - MongoDB: `motor`
    - C## Core Strategy
- **API Endpoint (Sync/Fast):** The `/api/v1/media/store` endpoint remains largely synchronous. It validates input, optionally creates/updates the initial scene record in MongoDB (using standard `pymongo` or non-blocking `motor`) to get the `_id`, then dispatches the Celery task.
- **Task Definition:** Define Celery tasks using `async def`.
- **Worker Configuration:** Configure and run the Celery worker using an asynchronous execution pool (`gevent` or `eventlet`). Ensure necessary dependencies (`gevent`, `greenlet` if using `gevent`) are installed.
- **Asynchronous I/O:** Utilize asloudflare R2/S3: `aiobotocore`
    - HTTP Requests (if needed): `aiohttp`
    - File Operations (if needed): `aiofiles`
    - Sleep: `asyncio.sleep()`
- **External Tools:** Run command-line tools like `yt-dlp` using asynchronous subprocess methods (e.g., `asyncio.create_subprocess_exec`).
- **Dependencies:** Install `yt-dlp` and the necessary `ffmpeg` binary *within* the `celery-worker` container image (via its Dockerfile) to allow `yt-dlp` to function correctly for tasks like stream merging.
- **Data Integrity:** The API layer obtains the confirmed MongoDB `_id` (after successful project/scene creation/update) and passes it directly to the Celery task. The Celery task **must** use this `_id` for all subsequent database updates (`await motor...`) and **must not** rely on looking up the project/scene using a custom ID.

## Scope

### Included
- Downloading primary media content (video or video+audio as provided by `yt-dlp` default) from a given URL.
- Uploading the successfully downloaded media file to Cloudflare R2.
- Updating the corresponding database record (e.g., Scene) with status updates (`processing`, `completed`, `failed`) and the final R2 key/URL, using the provided MongoDB `_id` for the update.

### Deferred / Handled Gracefully
- **Dedicated Audio-Only Extraction:** This task focuses on the primary media. A separate, future task can handle extracting audio-only streams if required.
- **Complex HLS Stream Handling:** The task should attempt download using `yt-dlp`. If issues arise with processing HLS manifests (e.g., for thumbnailing), the task should handle the error gracefully (e.g., skip thumbnailing) rather than failing entirely if the main media was stored. Configure `yt-dlp` to prefer direct formats if possible.
- **Advanced Thumbnail Generation:** A basic thumbnail attempt can be included, but the task should still mark the main media storage as successful in the database even if thumbnail generation fails.

## Infrastructure Plan
- Utilize `redis` and `celery-worker` Docker containers as defined in `docker-compose.yml`.
- The `celery-worker` container's Dockerfile must be updated to install `gevent`/`greenlet` (if using `gevent`), `yt-dlp`, `ffmpeg`, `motor`, `aiobotocore`, and any other necessary async libraries.
- Keep the `ffmpeg-service` container defined in `docker-compose.yml` for potential future use (complex transcoding tasks), but it will **not** be actively used by this specific download task.

## Implementation Steps (Subtasks)

0.  **Prerequisite: Verify Current State (End-to-End Check of Existing Code):**
    *   **Goal:** Before starting the full async implementation, verify that the *current* code (API dispatching the `def` task using `asyncio.run`) works reliably end-to-end.
    *   **Specific Verification Sub-Steps:**
        *   **0.1 Service Check:** Confirm all required Docker services (backend API, celery-worker, redis, database) are running correctly (`docker compose ps`, check initial logs).
        *   **0.1.1 Configuration Consistency Check:** Verify that critical environment variables (`DATABASE_URL`, `R2_*` keys, `CELERY_BROKER_URL`, `CELERY_RESULT_BACKEND`, etc.) are identical and correctly loaded in both the `backend` and `celery-worker` containers (`docker compose exec <service_name> printenv`). Ensure they point to the same resources.
        *   **0.1.2 Dependency Version Alignment Check:** Briefly verify that key shared libraries (e.g., `celery`, `pymongo`, `boto3`) have consistent major versions between the `backend` and `celery-worker` environments (`docker compose exec <service_name> pip freeze | grep <library>`).
        *   **0.2 API Call & Response:** Trigger the `/api/v1/media/store` endpoint with a test URL. Verify it returns `202 Accepted` immediately with a valid `task_id`.
        *   **0.3 Worker Logs:** Monitor the `celery-worker` logs in real-time (`docker compose logs -f celery-worker`). Verify the worker receives the task, logs expected progress/steps (using `asyncio.run` for I/O), and indicates successful completion or specific errors.
        *   **0.4 Database Check:** After the worker logs indicate completion/failure, inspect the relevant MongoDB scene record. Verify `status` and `storage_key` (on success) or `status` and `error_message` (on failure) are updated correctly. **(Update: This verification step should now pass, as the underlying issue of scenes not saving via `PATCH` requests was resolved by implementing the `patch_project` endpoint in `project_operations.py`.)**
        *   **0.4.1 Detailed Error Reporting Check:** Trigger a known failure scenario (e.g., invalid URL). Verify the `error_message` stored in the database (per 0.4) is specific and accurately reflects the *reason* for failure, not just generic.
        *   **0.5 R2 Storage Check:** On successful task completion, verify the media file exists in the Cloudflare R2 bucket at the expected `storage_key`.
        *   **0.5.1 Temporary File Cleanup Check:** After both successful and failed download attempts, inspect the relevant temporary directories within the `celery-worker` container (if any are used by the current process) to confirm temporary files are reliably deleted.
        *   **0.6 R2 Deletion Check:** After confirming storage (0.5), trigger the action that causes project/scene deletion. Verify that the media file previously confirmed in step 0.5 is subsequently deleted from the Cloudflare R2 bucket.
        *   **0.7 Overall Flow Confirmation:** Confirm the end-to-end storage *and* deletion flows function as expected for the *current* implementation based on the results of 0.1-0.6.
    *   **Outcome:** If any sub-step fails, diagnose and fix the current implementation before proceeding with the `async def` refactor planned below. If all succeed, we have a stable baseline.

1.  **Verify Async Celery/Redis Infrastructure:**
    *   Configure the worker command in `docker-compose.yml` to use `gevent` (`-P gevent`). Specify concurrency (`-c`) appropriately (e.g., `-c 100`).
    *   Ensure necessary libs (`gevent`, `greenlet`) are added to `requirements.txt` and installed in the worker image (`Dockerfile.worker`).
    *   Confirm the worker container starts and connects to Redis successfully (check logs for messages like "Connected to redis://...").
    *   Define a minimal `async def hello_world()` task (e.g., in `app/tasks/debug_tasks.py`) that performs a simple log and potentially `await asyncio.sleep(1)`.
    *   Create a temporary API endpoint (e.g., in `app/api/debug.py`) to trigger `hello_world.delay()`.
    *   Call the endpoint and verify the task executes successfully *and asynchronously* in the `gevent` worker logs.
    *   Double-check crucial environment variables (e.g., `CELERY_BROKER_URL`, `CELERY_RESULT_BACKEND`, `DATABASE_NAME`, R2 keys) are correctly loaded and available within the worker container (`docker compose exec celery-worker printenv`).
    *   *(Optional but Recommended)*: Set up and check Celery Flower (monitoring UI) if included in `docker-compose.yml` to observe task processing.

2.  **Define Async `yt-dlp` Download Task:**
    *   Change task signature: `def download_media_task(...)` -> `async def download_media_task(...)`.
    *   Ensure the `celery-worker` Dockerfile installs necessary async libs: `yt-dlp`, `ffmpeg`, `motor`, `aiobotocore`, `gevent`, `greenlet`.
    *   Task function **must** accept `mongo_db_id` as a parameter.
    *   **Convert I/O operations to use `await`:**
        *   Replace synchronous subprocess calls (`subprocess.run`, `yt_dlp.YoutubeDL().download`, etc.) with `asyncio.create_subprocess_exec` and use `await process.communicate()` or `await process.wait()`.
        *   Replace `asyncio.run(storage_service.upload_file_to_r2(...))` with `await storage_service.async_upload_file_to_r2(...)` (assuming an async version exists/is created in the service).
        *   Replace `asyncio.run(mongo_service.update_scene(...))` with `await mongo_service.async_update_scene(...)` (assuming an async version exists/is created in the service, using `motor`).
        *   Replace any standard file I/O (`open`, `read`, `write`) with `aiofiles` equivalents if needed.
        *   Replace `time.sleep()` with `await asyncio.sleep()` if needed.
    *   Implement logic to run `yt-dlp` using the async subprocess approach. Ensure stdout/stderr are handled appropriately.
    *   Implement logic to upload the downloaded file to R2 using `await` with `aiobotocore`.
    *   Implement logic to update MongoDB status using `await` with `motor` and the provided `mongo_db_id`. **Do not** perform lookups using custom IDs.
    *   Include robust `try...except` blocks around external `await` calls (subprocess, R2, DB).
    *   Handle HLS download issues gracefully (e.g., log warning, attempt download with format preferences, skip thumbnail if it fails on HLS). Configure `yt-dlp` options (e.g., `--prefer-ffmpeg`, format selection) to favor direct video files over playlists if possible.
    *   Implement basic thumbnail generation using `ffmpeg` (called via async subprocess), but ensure the main task status update succeeds even if thumbnailing fails.

3.  **Unit Test Async Task:**
    *   **Crucial Step:** Address previous unit testing failures by setting up tests correctly from the start.
    *   Use `pytest` framework with the `pytest-asyncio` plugin.
    *   Write unit tests specifically for the `async def download_media_task(...)` function.
    *   **Isolate the task logic using mocking:**
        *   Mock the `asyncio.create_subprocess_exec` call and simulate `yt-dlp` success/failure.
        *   Mock the `aiobotocore` client/methods and simulate R2 upload success/failure.
        *   Mock the `motor` client/methods and simulate DB update success/failure.
    *   Verify that the task logic correctly handles different scenarios based on mocked outcomes.
    *   Assert that external services (mocks) are called with the expected parameters (including `mongo_db_id` for DB updates).
    *   Test edge cases like HLS detection and graceful thumbnail failure.
    *   Run these tests within the development environment (potentially inside the backend container if needed to resolve path issues, e.g., `docker compose exec backend pytest app/tests/tasks/test_media_tasks.py`).

4.  **Modify API Endpoint:**
    *   Ensure the relevant API endpoint (likely `/api/v1/media/store`) remains **synchronous** (`def`) or uses `async def` carefully *without* blocking the response with long I/O waits.
    *   Implement logic to:
        *   Validate the incoming request payload.
        *   Create or update the initial Scene record in MongoDB to get the confirmed `_id`. This can be done synchronously (`pymongo`) or non-blockingly (`motor`) before dispatching the task.
        *   Ensure it receives or retrieves the confirmed `mongo_db_id`.
    *   Remove any old placeholder logic (e.g., FastAPI `BackgroundTasks`).
    *   Import the new `async def download_media_task` function.
    *   Correctly call `.delay()` or `.apply_async()` on the Celery task, passing the `mongo_db_id` and other necessary data (URL, scene_id etc.).
    *   Return `202 Accepted` immediately with the task ID.

5.  **Integrate Frontend:**
    *   Ensure the **project creation flow** is robust: `createProject` function calls the backend API, receives the response containing the MongoDB `_id`, and reliably updates the frontend state (`state.currentProject._id`).
    *   Modify the frontend logic that triggers media storage (e.g., the `useEffect` in `ProjectProvider.tsx`) to:
        *   Reliably retrieve the `_id` from the *updated* project state.
        *   Pass it as `mongo_db_id` in the payload when calling the `/api/v1/media/store` endpoint.
    *   Handle loading states and potential API errors gracefully in the UI.

6.  **Implement Frontend Status Updates:**
    *   Design and implement the mechanism for the frontend UI to track the background task's progress (`processing`, `completed`, `failed`).
    *   **Backend:** Requires an endpoint (for polling) or WebSocket logic to expose task status (read from the database, identified via `mongo_db_id` or perhaps the Celery task ID).
    *   **Frontend:** Implement polling logic or WebSocket client to receive status updates and update the relevant scene component's display.

7.  **End-to-End Testing (of Final Hybrid Implementation):**
    *   Perform comprehensive manual and/or automated (Playwright) tests covering the **final** hybrid asynchronous workflow implemented in steps 1-6.
    *   Verify each stage: UI interaction -> API call (sync response with `_id`) -> Celery task queuing -> Async worker execution (`yt-dlp` via async subprocess, R2 via `aiobotocore`, DB update via `motor` using `_id`) -> DB status change -> Frontend UI update (via polling/WebSocket - Subtask #6).
    *   Test with various valid URLs (YouTube, Reddit video, direct MP4, etc.) and potentially URLs known to cause HLS downloads.
    *   Test error conditions (invalid URL, R2 connection failure - potentially mocked).
    *   **Note:** The detailed verification checks previously here are now part of the prerequisite step #0, applied to the *current* code. This step focuses on testing the *result* of implementing Task 13.

## Related Future Tasks
- **Task 14:** Implement Synchronous Deletion from R2 (Handles cleanup).
- **(Future):** Implement Dedicated Audio Extraction Task (If needed).
- **(Future):** Implement Complex FFmpeg Processing Task (Using `ffmpeg-service`). 
