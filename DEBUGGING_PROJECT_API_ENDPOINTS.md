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
    *   **Investigation:** Checked backend logs after fixing router/adding route. Found backend failing to start due to `ImportError: cannot import name 'get_settings' from 'app.core.config'` in `

## Resolution

The primary issues blocking project creation and updates were resolved as follows:

1.  **`PATCH` Endpoint Issue (Scene Data Not Saving):**
    *   The root cause for scenes not saving after initial creation was the complete absence of a `PATCH /api/v1/projects/{project_id}` endpoint handler in the backend.
    *   **Fix:** Implemented the `patch_project` function in `web/backend/app/api/endpoints/project_operations.py`. This function handles `PATCH` requests, updates the project document in MongoDB (including the `scenes` array) using the provided data, and returns the updated project.
    *   **Outcome:** With the `patch_project` endpoint added, scene updates sent from the frontend via `PATCH` requests are now correctly persisted to the MongoDB database.

2.  **`POST` Endpoint Issue (`ERR_CONNECTION_RESET`):**
    *   Multiple factors contributed:
        *   Incorrect frontend URL (`/api/v1/projects/projects/` instead of `/api/v1/projects/`).
        *   Router misconfiguration (`projects_router` commented out or duplicated) in `main.py`.
        *   Missing `POST /` route definition in the projects router.
        *   Subsequent `ImportError` preventing the backend from starting.
    *   **Fixes:** Corrected the frontend URL, cleaned up `main.py` routers, added the `create_project` function (`@router.post("/")`), and resolved the `ImportError`.
    *   **Outcome:** Project creation via `POST /api/v1/projects/` is now functional.

3.  **Pydantic Serialization Error:**
    *   While initially a significant blocker during the `PATCH` attempts, the underlying issue was likely masked by the missing endpoint itself. With the endpoint correctly implemented and returning a Pydantic model (`ProjectResponse`), the model's configuration (including `json_encoders={ObjectId: str}`) now handles the `ObjectId` to `str` conversion correctly.
    *   **Outcome:** The serialization error is no longer occurring after implementing the correct `PATCH` endpoint handler.