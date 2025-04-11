### In Progress (Estimate: 35% complete)

*   **Scene Management & Media Handling (50%):**
    *   [x] Basic scene creation from URL
    *   [x] Fetching content (text, media URL)
    *   [x] Basic media display (image/video)
    *   [x] Storing media in R2 (Backend complete, Frontend integration ongoing)
    *   [ ] Scene reordering (UI implemented, backend API exists, needs connection)
    *   [x] Scene deletion (UI/Backend connected)
    *   [x] Audio Generation (ElevenLabs API integration)
    *   [x] Audio Playback
    *   [ ] Audio Storage in R2 (Backend endpoint exists, needs frontend integration)
    *   [x] Video Trimming (UI controls implemented, API connected, persistence fixed)
    *   [ ] Synchronized Playback (Audio + Video/Image)
*   **UI Enhancements (20%):**
    *   [x] Basic project list and creation UI
    *   [x] Scene card layout
    *   [ ] Improved loading states and error handling
    *   [ ] Responsive design improvements
    *   [ ] Consistent UI components (using Shadcn/ui)
*   **Testing (15%):**
    *   [x] Basic Playwright setup
    *   [ ] E2E tests for core features (project creation, scene addition, media trimming)

### Completed Tasks

*   **Project Setup & Core Structure:**
    *   [x] Initial Next.js + FastAPI setup
    *   [x] Docker configuration for frontend and backend
    *   [x] Basic project state management (`ProjectProvider`)
    *   [x] LocalStorage persistence for projects
*   **Backend Core:**
    *   [x] FastAPI application structure
    *   [x] MongoDB connection (Atlas)
    *   [x] Basic Project/Scene models (Pydantic)
    *   [x] CRUD API endpoints for projects
    *   [x] Content extraction endpoint (`/extract/`)
    *   [x] Cloudflare R2 integration for media storage (`/r2/`)
    *   [x] ElevenLabs API integration for voice generation (`/tts/`)
*   **Bug Fixes:**
    *   [x] Fixed issue where trim settings were not persisting due to incorrect save/load paths in backend and frontend data migration.
*   **Project Deletion Refactoring**: Successfully moved `DELETE /projects/{project_id}` to `project_operations.py` and verified.
*   **Project List Refactoring**: Moved `GET /projects` to `project_operations.py`.
*   **Project Create Refactoring**: Moved `POST /projects` to `project_operations.py`.
*   **Scene Trim Endpoint Refactoring**: Moved `PUT /projects/{project_id}/scenes/{scene_id}/trim` to `scene_operations.py` using a shadow implementation, verified routing, and commented out the original.
*   **UI/UX**: Implemented scene reordering via drag-and-drop on the frontend.
*   **UI/UX**: Addressed project card loading issues.
*   **UI/UX**: Fixed issues with project creation and scene addition flows.

### Next Steps

*   Connect scene reordering UI to backend API.
*   Implement audio storage in R2 via frontend. 