# Debugging Project API Endpoints (Task 13) - 2025-04-17

## Goal

Resolve issues preventing successful creation and updating of projects via the API, specifically focusing on the `POST /api/v1/projects/` and `PATCH /api/v1/projects/{project_id}` endpoints. The immediate symptom was often a "No project data available" message in the frontend after attempting creation, accompanied by various backend errors or connection resets.

## Initial Problem Context (Handover Message Adaptation)

*   **Overall Task:** Working towards Task 13 (reliable background media downloading).
*   **Current Focus:** Executing prerequisite Step 0 (verifying baseline system).
*   **Initial Blocker:** Found that scenes added in the frontend were not saved to the backend database (`scenes` array remained empty in MongoDB). This blocked verification Step 0.4.
*   **Root Cause:** Identified that `web/frontend/src/hooks/useProjectPersistence.ts` only saved to local storage, and the backend lacked project CRUD endpoints (specifically PATCH/PUT for updates).
*   **Next Step (at handover):** Create backend project CRUD endpoints, starting with `web/backend/app/api/v1/endpoints/projects.py`.

## Debugging Steps & Findings (Post-Handover)

1.  **Problem:** Attempting to add/update scenes via `PATCH /api/v1/projects/{project_id}` resulted in a 500 Internal Server Error and CORS errors. Backend logs showed `PydanticSerializationError: Unable to serialize unknown type: <class 'bson.objectid.ObjectId'>`.
    *   **Hypothesis:** Pydantic couldn't convert the MongoDB `_id` (an `ObjectId` object) to a string `id` field for the `ProjectResponse` model.
    *   **Attempt 1:** Added `arbitrary_types_allowed=True` to `ProjectResponse` `model_config` in `models/project.py`. **Result:** Error persisted. Container restarts/rebuilds didn't help.
    *   **Attempt 2:** Explicitly added `updated_doc["id"] = str(updated_doc["_id"])` in `endpoints/projects.py` before `ProjectResponse.model_validate(updated_doc)`. **Result:** Code change confirmed in file, but *same* `PydanticSerializationError` occurred in logs. Baffling. Checked `ProjectResponse` model again; `json_encoders={ObjectId: str}` *was* already present.
    *   **Attempt 3:** Modified `update_project` to use `response_model_instance.model_dump_json()` and return a `JSONResponse` to force serialization using model config. **Result:** Edit failed to apply correctly multiple times (tool reported no changes or reapply failed).
    *   **Attempt 4 (Partial Revert):** Simplified `update_project` return to `return updated_doc` (raw dict after adding string 'id'). Modified `ProjectResponse` model `id` field to use `PyObjectId` type with `alias='_id'`. **Result:** Frontend now showed `ERR_CONNECTION_RESET` when trying to *create* a project (`POST` request).

2.  **Problem:** `POST /api/v1/projects/` resulted in `ERR_CONNECTION_RESET`. Frontend logs showed the request going to `/api/v1/projects/projects/`.
    *   **Hypothesis 1:** Incorrect frontend URL. **Fix:** Corrected URL in `useProjectCore.ts` to `/api/v1/projects/`. **Result:** `ERR_CONNECTION_RESET` persisted.
    *   **Hypothesis 2:** Backend router configuration issue or missing `POST` route.
    *   **Investigation:** Found `projects_router` was commented out in `main.py`. **Fix:** Uncommented router inclusion. **Result:** `ERR_CONNECTION_RESET` persisted.
    *   **Investigation:** Found multiple conflicting router includes in `main.py`. **Fix:** Cleaned up `main.py` router includes significantly. **Result:** `ERR_CONNECTION_RESET` persisted.
    *   **Investigation:** Confirmed `POST /` route was missing entirely from `endpoints/projects.py`. **Fix:** Added `create_project` function with `@router.post("/")`. **Result:** `ERR_CONNECTION_RESET` persisted.
    *   **Investigation:** Checked backend logs after fixing router/adding route. Found backend failing to start due to `ImportError: cannot import name 'get_settings' from 'app.core.config'` in `app/db/session.py`. **Fix:** Corrected import path in `session.py`. **Result:** Backend started, but `ERR_CONNECTION_RESET` persisted on `POST /api/v1/projects/`.

3.  **Problem:** `ERR_CONNECTION_RESET` still occurring on `POST /api/v1/projects/` after fixing import errors and ensuring backend starts.
    *   **Hypothesis 1:** The Pydantic model changes made in Step 1 (introducing `PydanticObjectId` via `bson_encoders.py` and updating `models/project.py`) are causing an internal crash in the `create_project` endpoint, even though they were intended to fix serialization in the `update_project` endpoint.
    *   **Attempt 1:** Created `app/utils/bson_encoders.py` with `PydanticObjectId` type. Updated `models/project.py` to use `PydanticObjectId` for `id` fields in `Project` and `Scene`, removed old `PyObjectId`, and adjusted `ProjectResponse`. **Result:** `ERR_CONNECTION_RESET` persisted on project creation.
    *   **Hypothesis 2:** Frontend URL for creation is still incorrect.
    *   **Investigation:** Frontend logs confirmed the request URL was `http://localhost:8000/api/v1/projects/projects` (extra `/projects`).
    *   **Attempt 2 (URL Fix):** Corrected URL construction in `hooks/useProjectCore.ts` to remove the trailing `/projects`. **Result:** `ERR_CONNECTION_RESET` *still* persists on project creation. This strongly suggests the backend is crashing when handling the request, likely within the `create_project` function or related Pydantic validation/database interaction for the new models.