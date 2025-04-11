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
    - [x] **Action:** Move the `delete_project` function logic. Decorate with `@project_router.delete("/projects/{project_id}", ...)`.
    - [x] **Test:** Restart backend. Perform Manual Browser Sanity Check (delete a test project). Run Mock Playwright Tests. **After tests pass, comment out the original `delete_project` function in `api/projects.py`**.

*   **Endpoint 2.4: `GET /projects`**
    - [x] **Action:** Move the `get_projects` function logic. Decorate with `@project_router.get("/projects", ...)`.
    - [x] **Test:** Restart backend. Perform Manual Browser Sanity Check (verify My Projects page loads). Run Mock Playwright Tests. **After tests pass, comment out the original `get_projects` function in `api/projects.py`**.

*   **Endpoint 2.5: `POST /projects`**
    - [x] **Action:** Move the `create_project` function logic. Decorate with `@project_router.post("/projects", ...)`.
    - [x] **Test:** Restart backend. Perform Manual Browser Sanity Check (create a new project). Run Mock Playwright Tests. **After tests pass, comment out the original `create_project` function in `api/projects.py`**.

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
    - [x] **Action:** Move the `update_scene_trim` function logic. Decorate with `@scene_router.put("/projects/{project_id}/scenes/{scene_id}/trim", ...)`. (Implemented via shadow endpoint)
    - [x] **Test:** Restart backend. Perform Manual Browser Sanity Check (adjust scene trim). Run Mock Playwright Tests. **After tests pass, comment out the original `update_scene_trim` function in `api/projects.py`**. (Verified via manual testing and log check, original commented out)

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
    - [x] **Action:** Move the `process_project` function logic. Decorate with `@generation_router.post("/projects/{project_id}/process", ...)`. (Includes moving models and task dict)
    - [x] **Test:** Restart backend. Perform Manual Browser Sanity Check (click Generate Video). Run Mock Playwright Tests. **After tests pass, comment out the original `process_project` function in `api/projects.py`**. (Manual test passed, mock tests passed)

*   **Endpoint 5.2: `GET /projects/{project_id}/process/{task_id}` (Get Status)**
    - [x] **Action:** Move the `get_project_processing_status` function logic. Decorate with `@generation_router.get("/projects/{project_id}/process/{task_id}", ...)`. Ensure it uses the shared `project_processing_tasks` dict from `generation_operations.py`.
    - [x] **Test:** Restart backend. Manual check (verify status updates if possible). Run Mock Playwright Tests. **After tests pass, comment out the original `get_project_processing_status` function in `api/projects.py`**. (Mock tests passed)

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

**-- PAUSED --**
*   **Reason:** Addressing critical frontend re-rendering bug. See `docs/bugs/re-rendering-glitch.md`.
*   **Next Step (Backend):** Resume Phase 6 testing (Full API tests, Manual checks) after frontend bug is resolved.

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

## Failed Refactoring Approaches - Documentation

To avoid repeating the same mistakes, here's a record of approaches that did not work:

### All Previous Scene Refactoring Attempts Have Completely Failed
- **Consistent Symptom**: After refactoring scene endpoints, the UI shows only empty white squares with scene numbers.
- **Severity**: No scene content loads at all - not even a single scene renders properly.
- **Consistency**: This same exact failure has occurred with every refactoring attempt.

Initial approaches included:
1. Direct Router Migration with `/api/v1` prefix
2. URL Path Restructuring with `/api/v1/projects` prefix
3. Scene Retrieval Focus with custom handlers

None of these approaches resulted in any scenes loading in the UI. In every case, the scene containers were empty white squares showing only the scene number.

### Key Takeaways from Failed Attempts
1. **Endpoint Paths**: Must match exactly what frontend expects - prefixes, parameters, structure
2. **Router Registration**: Scene router must use `/api/v1/projects` prefix to maintain compatibility
3. **State Management**: Frontend state handling for scenes requires careful coordination with API responses
4. **Test Every Step**: After each small change, test multiple scene operations (create, view different scenes, update, delete)
5. **Incremental Approach**: Move only one endpoint at a time, test fully before proceeding
6. **Service Layer**: Leverage the service layer (ProjectsService) wherever possible rather than reimplementing logic
7. **Error Handling**: Maintain consistent error response patterns between original and refactored code

## Ultra-Incremental Approach for Scene Operations

Due to the consistent failure of all previous attempts, we will adopt an ultra-incremental approach for scene operations:

### 1. Diagnostic Phase
- Add extensive logging to both frontend and backend to trace exactly how scene data flows
- Create a "shadow implementation" that runs in parallel with the existing code but doesn't affect it
- Implement monitoring to compare responses between original and new implementations

### 2. Scaffolding Phase
- Create the scene_router but don't register it yet
- Add a feature flag system to control which implementation is used
- Create exact mirror endpoints that just call through to the original implementation

### 3. Ultra-Incremental Migration
- Start with the least complex/critical scene endpoint 
- Move just the route declaration but have it call the original function
- Test extensively, then gradually replace the implementation
- Use feature flags so we can instantly revert to original code

### 4. Deep Inspection of Frontend State
- Add detailed console logging in the frontend scene components
- Track exactly how scene data is loaded and processed
- Compare network requests between working and non-working implementations

### 5. Testing Strategy
- Create specific test cases that verify each scene operation separately
- Document exact steps to reproduce and verify each test case
- Establish clear success criteria for each test

This approach prioritizes understanding exactly what's happening in the existing code before making changes, and provides multiple safety mechanisms to revert immediately if issues arise.

## Revised Approach Recommendation
For the next attempt, consider creating a new branch and making the changes using a true strangler pattern:
1. Leave existing endpoints in place in projects.py
2. Create new endpoints in scene_operations.py that call the same service methods
3. Add a feature flag or A/B testing mechanism to gradually shift traffic to new endpoints
4. Only remove original endpoints after new ones are fully validated in production
