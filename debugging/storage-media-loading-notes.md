# Debugging Notes: Media Storage & Loading Issues (April 2025)

This document summarizes the investigation into issues related to adding scenes, uploading media to R2, and displaying it in the frontend player.

## Initial Problem

- Users reported intermittent failures when adding scenes. Sometimes the scene media (video) would load, other times it would fail with a "Failed to load video" error overlay, often accompanied by a 404 error in the browser console.
- Adding/deleting generated audio seemed to work correctly.
- **Update:** Trim data (start/end times) is no longer persisting between sessions, although it previously did (potentially via MongoDB integration, needs verification).

## Investigation Steps & Findings

1.  **Backend Crash (`ERR_CONNECTION_RESET`):**
    - Checked backend container logs (`docker-compose logs backend`).
    - Identified an `ImportError` in `web/backend/app/api/storage.py`. It was trying to import a non-existent function `get_storage_service` from `app.services.storage`.
    - **Fix:** Modified `web/backend/app/api/storage.py` to import and instantiate the `R2Storage` class directly instead of using the non-existent function. This resolved the backend startup crash.

2.  **Incorrect R2 Upload Key:**
    - After fixing the startup crash, scene additions were possible, but the 404 persisted when loading the video.
    - Compared frontend logs (showing the requested URL with a timestamp filename like `.../media/20250417103342.tmp`) with backend logs (`storage.py` - `get_file_path`) which showed the file being uploaded using the temporary file path (`.../video/tmpXXXX.tmp`).
    - The `store_media_content` function in `web/backend/app/services/media_service.py` was generating the correct timestamp filename but wasn't passing it as the `object_name` to `storage.upload_file`. The storage service was defaulting to using the basename of the temporary file path as the key.
    - **Fix:** Modified the `storage.upload_file` call within `store_media_content` in `web/backend/app/services/media_service.py` to explicitly include `object_name=filename`, passing the generated timestamp filename.

3.  **Persistent 404 & Race Condition Hypothesis:**
    - Even with the correct key being used for upload, the frontend *still* frequently encountered a 404 when trying to fetch the `/api/v1/storage/...` URL immediately after the backend confirmed the upload (`/api/v1/media/store` responded successfully).
    - **Observation:** The frontend's `mediaDownloadManager` has a fallback mechanism. After failing the `/api/v1/storage/...` fetch, it attempts to download the *original* media URL (e.g., the Reddit video URL via the content proxy) and loads *that* into the player using a local `blob:` URL. This masked the underlying 404 issue, making it seem like the R2 load sometimes worked.
    - **Hypothesis:** A race condition exists. The backend responds to the `/api/v1/media/store` request as soon as the `upload_file` call is initiated (or completes?), but potentially before the file is fully propagated and available for retrieval via the `/api/v1/storage/` endpoint through R2. The frontend fetch request arrives too early.

4.  **Loading Existing Projects:**
    - Further logs showed that when loading a project that already has a scene with stored media, the frontend *still* fetches the original media URL (via proxy) and plays the cached `blob:` URL.
    - It does **not** attempt to fetch the `/api/v1/storage/...` URL in this scenario, indicating the `storedUrl` provided by the backend isn't being prioritized or correctly utilized for playback after the initial scene creation.

5.  **Temporary Debugging Measures (Removed):**
    - Temporarily forced `get_file_path` in `web/backend/app/services/storage.py` to always use the hierarchical path (`use_simplified_structure = False`). This was removed as the path structure wasn't the root cause.
    - Added extensive `console.log` statements in `ProjectProvider.tsx` and `api-client.ts` (cleaned up before commit).

## Current Status (Post-Fixes)

- Backend starts reliably.
- Files are uploaded to R2 using the correct, consistent timestamp-based key.
- Frontend successfully loads media when adding a scene *and* when loading an existing project, BUT it does so by relying on the fallback mechanism (fetching the original URL via proxy and playing the cached blob).
- The intended loading path using the stored R2 URL (`/api/v1/storage/...`) is currently bypassed or fails due to timing issues on initial load.

## Next Steps

- Ensure the `storedUrl` (or `storageKey`) is correctly saved with the scene data persistence.
- Modify the frontend logic (`SceneMediaPlayer`, `mediaDownloadManager`, etc.) to prioritize fetching and playing from the `storedUrl` when available.
- Implement a robust solution for the timing/race condition (e.g., frontend retry, backend confirmation wait).
- Investigate why trim data persistence is broken and restore it. 