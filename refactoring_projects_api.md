# Projects API Refactoring Guide

## Goal
Refactor the `web/backend/app/api/projects.py` file by extracting related endpoints into separate files (`endpoints/`) for better organization, while ensuring the application remains fully functional throughout the process.

## Current Issues
- The `projects.py` file is large (~1300 lines) and mixes concerns (CRUD, scenes, generation).
- Previous refactoring attempts led to UI/API integration issues.

## Revised Refactoring Strategy (Highly Incremental & Test-Driven)
We will move endpoints *one by one*, performing rigorous testing after each step to guarantee stability and API compatibility.

1.  **Isolate Changes:** Move only one endpoint function at a time.
2.  **Immediate Integration:** Update `main.py` immediately after moving an endpoint to include its new router.
3.  **Maintain Compatibility:** Ensure moved endpoints retain the *exact* same route path (including `/api/v1` prefix), request/response structure, and authentication as the original.
4.  **Frequent Testing:** After each endpoint move, perform:
    *   Manual Browser Sanity Check (Load project, Play/Pause audio).
    *   Mock Playwright Test Suite (`npm test` with `MOCK_AUDIO=true`).
5.  **Phase Completion Testing:** After completing a logical group (e.g., all Project CRUD), run the Full API Playwright Test Suite (`npm test` with `MOCK_AUDIO=false`, with confirmation).

## Testing Definitions

*   **Manual Browser Sanity Check:**
    1.  Ensure frontend and backend servers are running.
    2.  Navigate to the "My Projects" page.
    3.  Verify projects load without errors.
    4.  Open an existing project.
    5.  Verify scenes load correctly.
    6.  Click the "Play" button for the first scene's audio.
    7.  Observe playback for ~4 seconds.
    8.  Click the "Pause" button.
    9.  Confirm audio played and paused as expected.
*   **Mock Playwright Tests:**
    *   Command: `cd web/frontend && NEXT_PUBLIC_MOCK_AUDIO=true npm test`
    *   Purpose: Verifies core functionality and UI interactions without hitting external APIs like ElevenLabs.
*   **Full API Playwright Tests:**
    *   Command: `cd web/frontend && NEXT_PUBLIC_MOCK_AUDIO=false npm test`
    *   Purpose: Verifies full end-to-end functionality including ElevenLabs integration.
    *   **Usage:** Run only after completing a major phase, and confirm with the user first due to potential API costs.

## Incremental Implementation Plan

### Phase 0: Baseline Test
- [ ] **Action:** Perform the Manual Browser Sanity Check on the current codebase *before* any changes.
- [ ] **Action:** Run Mock Playwright Tests (`MOCK_AUDIO=true`).
- [ ] **Goal:** Establish a working baseline.

### Phase 1: Setup
- [x] Directory `web/backend/app/api/endpoints/` exists.
- [x] Placeholder files created:
    - `project_operations.py`
    - `scene_operations.py`
    - `media_operations.py`
    - `generation_operations.py`
- [ ] **Action:** Initialize `project_operations.py` with `APIRouter` instance (`project_router = APIRouter()`).
- [ ] **Action:** Update `main.py`: Add `from app.api.endpoints.project_operations import project_router` and `app.include_router(project_router, prefix=settings.API_V1_STR)`. *(Note: We add the router early, even if empty)*.
- [ ] **Test:** Restart backend. Perform Manual Browser Sanity Check. Run Mock Playwright Tests.

### Phase 2: Move Project CRUD Operations (Endpoint by Endpoint)

*   **Endpoint 2.1: `GET /projects/{project_id}`**
    - [ ] **Action:** Move the `get_project` function logic from `api/projects.py` to `endpoints/project_operations.py`. Ensure imports, dependencies (`Depends(get_current_user)`), schemas, and response model (`response_model=ApiResponse[ProjectResponse]`) are correct. Decorate with `@project_router.get("/projects/{project_id}", ...)`.
    - [ ] **Test:** Restart backend. Perform Manual Browser Sanity Check. Run Mock Playwright Tests. **After tests pass, comment out the original `get_project` function in `api/projects.py`**.

*   **Endpoint 2.2: `PUT /projects/{project_id}`**
    - [ ] **Action:** Move the `update_project` function logic. Decorate with `@project_router.put("/projects/{project_id}", ...)`.
    - [ ] **Test:** Restart backend. Perform Manual Browser Sanity Check (may require manually editing a title via UI if possible). Run Mock Playwright Tests. **After tests pass, comment out the original `update_project` function in `api/projects.py`**.

*   **Endpoint 2.3: `DELETE /projects/{project_id}`**
    - [ ] **Action:** Move the `delete_project` function logic. Decorate with `@project_router.delete("/projects/{project_id}", ...)`.
    - [ ] **Test:** Restart backend. Perform Manual Browser Sanity Check (delete a test project). Run Mock Playwright Tests. **After tests pass, comment out the original `delete_project` function in `api/projects.py`**.

*   **Endpoint 2.4: `GET /projects`**
    - [ ] **Action:** Move the `get_projects` function logic. Decorate with `@project_router.get("/projects", ...)`.
    - [ ] **Test:** Restart backend. Perform Manual Browser Sanity Check (verify My Projects page loads). Run Mock Playwright Tests. **After tests pass, comment out the original `get_projects` function in `api/projects.py`**.

*   **Endpoint 2.5: `POST /projects`**
    - [ ] **Action:** Move the `create_project` function logic. Decorate with `@project_router.post("/projects", ...)`.
    - [ ] **Test:** Restart backend. Perform Manual Browser Sanity Check (create a new project). Run Mock Playwright Tests. **After tests pass, comment out the original `create_project` function in `api/projects.py`**.

*   **Phase 2 Completion Test:**
    - [ ] **Confirm:** Ask user if ready to run full API tests.
    - [ ] **Action:** Run Full API Playwright Tests (`MOCK_AUDIO=false`).

### Phase 3: Move Scene Operations (Endpoint by Endpoint)

*   **Setup:**
    - [ ] **Action:** Initialize `scene_operations.py` with `APIRouter` instance (`scene_router = APIRouter()`).
    - [ ] **Action:** Update `main.py`: Add `from app.api.endpoints.scene_operations import scene_router` and `app.include_router(scene_router, prefix=settings.API_V1_STR)`.
    - [ ] **Test:** Restart backend. Perform Manual Browser Sanity Check. Run Mock Playwright Tests.

*   **Endpoint 3.1: `POST /projects/{project_id}/scenes` (Add Scene)**
    - [ ] **Action:** Move the `add_scene` function logic. Decorate with `@scene_router.post("/projects/{project_id}/scenes", ...)`.
    - [ ] **Test:** Restart backend. Perform Manual Browser Sanity Check (add a scene to a project). Run Mock Playwright Tests. **After tests pass, comment out the original `add_scene` function in `api/projects.py`**.

*   **Endpoint 3.2: `PUT /projects/{project_id}/scenes/{scene_id}` (Update Scene)**
    - [ ] **Action:** Move the `update_scene` function logic. Decorate with `@scene_router.put("/projects/{project_id}/scenes/{scene_id}", ...)`.
    - [ ] **Test:** Restart backend. Perform Manual Browser Sanity Check (edit scene text). Run Mock Playwright Tests. **After tests pass, comment out the original `update_scene` function in `api/projects.py`**.

*   **Endpoint 3.3: `DELETE /projects/{project_id}/scenes/{scene_id}` (Delete Scene)**
    - [ ] **Action:** Move the `delete_scene` function logic. Decorate with `@scene_router.delete("/projects/{project_id}/scenes/{scene_id}", ...)`.
    - [ ] **Test:** Restart backend. Perform Manual Browser Sanity Check (delete a scene). Run Mock Playwright Tests. **After tests pass, comment out the original `delete_scene` function in `api/projects.py`**.

*   **Endpoint 3.4: `PUT /projects/{project_id}/scenes/reorder`**
    - [ ] **Action:** Move the `reorder_scenes` function logic. Decorate with `@scene_router.put("/projects/{project_id}/scenes/reorder", ...)`.
    - [ ] **Test:** Restart backend. Perform Manual Browser Sanity Check (drag/drop scenes). Run Mock Playwright Tests. **After tests pass, comment out the original `reorder_scenes` function in `api/projects.py`**.

*   **Endpoint 3.5: `PUT /projects/{project_id}/scenes/{scene_id}/trim`**
    - [ ] **Action:** Move the `update_scene_trim` function logic. Decorate with `@scene_router.put("/projects/{project_id}/scenes/{scene_id}/trim", ...)`.
    - [ ] **Test:** Restart backend. Perform Manual Browser Sanity Check (adjust scene trim). Run Mock Playwright Tests. **After tests pass, comment out the original `update_scene_trim` function in `api/projects.py`**.

*   **Phase 3 Completion Test:**
    - [ ] **Confirm:** Ask user if ready to run full API tests.
    - [ ] **Action:** Run Full API Playwright Tests (`MOCK_AUDIO=false`).

### Phase 4: Move Media Operations (Review Needed)
- [ ] **Action:** Review `api/projects.py` carefully. Are there *any* endpoints purely for media handling that are *not* part of scene logic (e.g., a general `/upload` endpoint not under `/scenes`)?
- [ ] **If YES:**
    - [ ] **Setup:** Initialize `media_operations.py`, add router to `main.py`. Test setup.
    - [ ] **Action:** Move identified media endpoint(s) one by one, decorating with appropriate `@media_router.<method>("/media/...")`.
    - [ ] **Test:** After each move: Restart backend. Manual check (if possible). Mock tests. **After tests pass, comment out the original function in `api/projects.py`**.
    - [ ] **Phase 4 Completion Test:** Run Full API Playwright Tests (`MOCK_AUDIO=false`).
- [ ] **If NO:**
    - [x] Mark Phase 4 as N/A. No standalone media endpoints found in `api/projects.py`.

### Phase 5: Move Generation Operations (Endpoint by Endpoint)

*   **Setup:**
    - [ ] **Action:** Initialize `generation_operations.py` with `APIRouter` instance (`generation_router = APIRouter()`).
    - [ ] **Action:** Update `main.py`: Add `from app.api.endpoints.generation_operations import generation_router` and `app.include_router(generation_router, prefix=settings.API_V1_STR)`.
    - [ ] **Test:** Restart backend. Perform Manual Browser Sanity Check. Run Mock Playwright Tests.

*   **Endpoint 5.1: `POST /projects/{project_id}/process` (Start Generation)**
    - [ ] **Action:** Move the `process_project` function logic. Decorate with `@generation_router.post("/projects/{project_id}/process", ...)`.
    - [ ] **Test:** Restart backend. Perform Manual Browser Sanity Check (click Generate Video). Run Mock Playwright Tests. **After tests pass, comment out the original `process_project` function in `api/projects.py`**.

*   **Endpoint 5.2: `GET /projects/{project_id}/process/{task_id}` (Get Status)**
    - [ ] **Action:** Move the `get_project_processing_status` function logic. Decorate with `@generation_router.get("/projects/{project_id}/process/{task_id}", ...)`.
    - [ ] **Test:** Restart backend. Manual check (verify status updates if possible). Run Mock Playwright Tests. **After tests pass, comment out the original `get_project_processing_status` function in `api/projects.py`**.

*   **(Optional) Endpoint 5.3: TTS Endpoint (If applicable)**
    - [ ] **Action:** Review `api/projects.py`. Was there a text-to-speech endpoint here? If yes, move it to `generation_operations.py`.
    - [ ] **Test:** If moved, restart & test. **After tests pass, comment out the original function in `api/projects.py`**.

*   **Phase 5 Completion Test:**
    - [ ] **Confirm:** Ask user if ready to run full API tests.
    - [ ] **Action:** Run Full API Playwright Tests (`MOCK_AUDIO=false`).

### Phase 6: Final Integration Verification
- [ ] **Action:** Review `main.py` - ensure all routers (`project_router`, `scene_router`, `media_router` (if used), `generation_router`) are included with the correct `/api/v1` prefix.
- [ ] **Action:** Review `api/projects.py` - all endpoint logic should now be moved and commented out (with `# TODO: Remove after verification` comments).
- [ ] **Test:** Run Mock Playwright Tests.
- [ ] **Test:** Run Full API Playwright Tests.
- [ ] **Test:** Perform comprehensive Manual Browser Sanity Checks covering all moved functionality.

### Phase 7: Deprecation and Clean Up
- [ ] **Action:** Once Phase 6 testing passes consistently: The original functions in `api/projects.py` should already be commented out. Consider adding `@router.deprecated()` to the original router instance or file docstring for clarity if needed.
- [ ] **Action:** (Future) After a period of stability, physically remove the commented-out endpoint code from `api/projects.py`.
- [ ] **Action:** Update external documentation (e.g., README) if necessary.

## Implementation Notes

*   **API Compatibility:** CRITICAL. Maintain exact routes, request/response schemas, and auth.
*   **Dependency Diligence:** CRITICAL. When moving a function, ensure *all* required imports (FastAPI, Pydantic, DB, services, utils, errors, etc.), local helper functions (if only used by that endpoint), `Depends` clauses, and specific error handling logic are also moved or correctly referenced.
*   **Helper Functions Scope:** Large helper functions (e.g., `cleanup_project_storage`) used by a moved endpoint will initially reside in the new endpoint file. Further refactoring *within* these new files is a potential future step, not part of this plan.
*   **Testing:** Be meticulous. Do not skip tests after any step. Comment out original functions only *after* tests pass.
*   **Service Layer:** Use functions from `web/backend/app/services/` where possible. Do not duplicate service logic in endpoint files.
*   **Error Handling:** Maintain consistent patterns.

## Progress Tracking
Update checkboxes `[ ]` to `[x]` as steps are completed.
