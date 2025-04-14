# Celery Integration Notes

This document tracks the implementation details, decisions, and troubleshooting related to the Celery background task processing setup.

## Overview

- **Purpose:** Handle long-running tasks asynchronously (e.g., downloading/processing media) without blocking the main backend API.
- **Broker:** Redis (running in the `redis_cache` Docker container) is used as the message broker.
- **Worker:** A dedicated Celery worker runs in the `celery_worker` Docker container (defined in `docker-compose.yml` and `Dockerfile.worker`).
- **App Initialization:** The Celery app is configured in `app/core/celery_app.py`.

## Implemented Tasks

### 1. Media Download & Storage (`app/tasks/media_tasks.py:download_media_task`)

- **Purpose:** Downloads media from a given URL (using `yt-dlp`), uploads it to Cloudflare R2, and updates the corresponding scene status in MongoDB.
- **Trigger:** Called via `.delay()` from the `/api/v1/media/store` backend endpoint (`app/api/media.py`) when the frontend requests media storage.
- **Key Libraries:** `celery`, `yt-dlp`, `boto3` (via `app/services/storage`).
- **Database Updates:** Uses a synchronous function (`app/crud/crud_scene.py:update_scene_status_sync`) to update the Scene status in MongoDB directly upon task completion or failure. This avoids needing complex state management between the async task and the main async application.
- **Recent Issues & Fixes (April 2025):
    - **Issue:** Frontend (`ProjectProvider.tsx`) was not reliably triggering the `/api/v1/media/store` endpoint after adding a scene with media.
    - **Fix:** Refactored `ProjectProvider.tsx` to move the media storage initiation logic into a `useEffect` hook dependent on `state.currentProject`. This ensures the state is updated with scene details *before* attempting to trigger storage.
    - **Confirmation:** Verified via frontend and backend logs that the API call is now made, and the backend successfully queues the Celery task.

## Future Considerations

- Task monitoring/dashboard (e.g., Flower).
- More robust error handling and retry logic within tasks.
- Handling results/state updates back to the frontend (currently relies on frontend polling or re-fetching project data). 