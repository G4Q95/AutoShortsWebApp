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
- **Recent Issues & Fixes (April 2025):**
    - **Issue:** Frontend (`ProjectProvider.tsx`) was not reliably triggering the `/api/v1/media/store` endpoint after adding a scene with media.
    - **Fix:** Refactored `ProjectProvider.tsx` to move the media storage initiation logic into a `useEffect` hook dependent on `state.currentProject`. This ensures the state is updated with scene details *before* attempting to trigger storage.
    - **Confirmation:** Verified via frontend and backend logs that the API call is now made, and the backend successfully queues the Celery task.
    - **Issue:** Celery worker tasks failed during synchronous database updates (`update_scene_status_sync`) with the error "database name cannot be an empty string".
    - **Fix:** Identified a conflict between `load_dotenv()` called in `app/core/config.py` and environment variables provided by Docker Compose via `env_file`. Added DATABASE_NAME=autoshortsdb to the `.env` file to ensure the Celery worker has the correct database name.
    - **Issue:** Celery task `download_media_task` continues to fail to find newly created project documents in MongoDB.
    - **Root Cause Investigation:** Further testing revealed this is a more fundamental consistency issue:
        - Even after setting DATABASE_NAME correctly, the project document isn't immediately visible when directly querying MongoDB Atlas with the correct project_id filter.
        - This confirms the problem isn't isolated to the Celery worker environment but appears to be a MongoDB write/read consistency issue or potential replication lag.
        - The project document is logged as being inserted successfully by the FastAPI backend (acknowledged=true), but cannot be reliably queried immediately afterward, either by the Celery worker or via direct MongoDB Atlas queries.
    - **Status:** This database consistency issue remains unresolved and requires addressing before the media download functionality can work reliably. The current retry mechanism (even with increased delays) is insufficient when the data isn't becoming visible within a reasonable timeframe.

## Future Considerations

- Task monitoring/dashboard (e.g., Flower).
- More robust error handling and retry logic within tasks.
- Handling results/state updates back to the frontend (currently relies on frontend polling or re-fetching project data).
- Addressing the MongoDB consistency issues identified during testing, potentially by:
  - Investigating MongoDB write concern settings
  - Implementing a more robust queuing mechanism that waits for confirmed document visibility
  - Adding record locking or versioning to prevent race conditions 