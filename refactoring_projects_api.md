# Projects API Refactoring Guide

## Goal
Refactor the `web/backend/app/api/endpoints/projects.py` file to improve code organization, maintainability, and readability by extracting related endpoints into separate files based on their functionality.

## Current Issues
- The projects.py file has grown too large with multiple endpoint groups
- Code is becoming difficult to maintain and navigate
- Related functionality is spread across the file rather than grouped logically
- **UPDATE**: We found that the main projects.py file appears to be corrupted, with duplicate imports and potential content issues

## Refactoring Strategy
We'll split the existing monolithic file into multiple smaller files, each with a focused responsibility and recreate the needed functionality:

1. `project_operations.py` - Core CRUD operations for projects
2. `scene_operations.py` - Scene-related operations
3. `media_operations.py` - Media-related operations
4. `generation_operations.py` - Generation and processing operations

## Detailed Implementation Plan

### Step 1: Setup Project Structure
- [x] Create new files for each logical group
- [x] Set up proper imports and router configurations in each file

### Step 2: Create Service Layer
- [x] Create `projects.py` in services directory with core CRUD functions
- [x] Implement all necessary service functions for project operations
- [x] Ensure proper error handling and logging

### Step 3: Extract Project CRUD Operations
- [x] Create the following endpoints in `project_operations.py`:
  - [x] GET /projects - List all projects
  - [x] POST /projects - Create a new project
  - [x] GET /projects/{project_id} - Get a specific project
  - [x] PUT /projects/{project_id} - Update a project
  - [x] DELETE /projects/{project_id} - Delete a project

### Step 4: Register New Router
- [x] Add the project_operations router to main.py
- [x] Register routes under appropriate prefixes
- [x] Ensure both legacy and versioned endpoints are supported

### Step 5: Extract Scene Operations
- [ ] Move the following endpoints to `scene_operations.py`:
  - [ ] POST /projects/{project_id}/scenes - Add a scene
  - [ ] PUT /projects/{project_id}/scenes/{scene_id} - Update a scene
  - [ ] DELETE /projects/{project_id}/scenes/{scene_id} - Delete a scene
  - [ ] PUT /projects/{project_id}/scenes/reorder - Reorder scenes

### Step 6: Extract Media Operations
- [ ] Move the following endpoints to `media_operations.py`:
  - [ ] POST /projects/upload - Upload media
  - [ ] GET /projects/media/{media_id} - Get media
  - [ ] DELETE /projects/media/{media_id} - Delete media

### Step 7: Extract Generation Operations
- [ ] Move the following endpoints to `generation_operations.py`:
  - [ ] POST /projects/{project_id}/generate - Generate video
  - [ ] GET /projects/{project_id}/generations/{generation_id} - Get generation
  - [ ] POST /projects/{project_id}/scenes/{scene_id}/tts - Text-to-speech

### Step 8: Update Main Router
- [ ] Update main.py to include all new routers
- [ ] Ensure proper prefixes and dependencies are maintained
- [ ] Consider removing or deprecating the original projects router

### Step 9: Testing and Verification
- [ ] Verify all endpoints work as expected
- [ ] Ensure authentication is properly maintained
- [ ] Test error handling for each endpoint
- [ ] Confirm no regressions in functionality

## Tracking Progress
As we complete each step, we'll mark it as complete in this document to track our progress.

## Technical Notes
- Maintain consistent error handling across all files
- Ensure proper dependency injection for database access
- Keep authentication middleware consistent
- Verify all imports are correct in each file
- Maintain API documentation with appropriate tags
- Due to file corruption issues, some endpoints may need to be reconstructed from scratch rather than simply moved 