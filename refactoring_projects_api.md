# Projects API Refactoring Guide

## Goal
Refactor the `web/backend/app/api/endpoints/projects.py` file to improve code organization, maintainability, and readability by extracting related endpoints into separate files based on their functionality.

## Current Issues
- The projects.py file has grown too large with multiple endpoint groups
- Code is becoming difficult to maintain and navigate
- Related functionality is spread across the file rather than grouped logically

## Refactoring Strategy
We'll split the existing monolithic file into multiple smaller files, each with a focused responsibility:

1. `project_operations.py` - Core CRUD operations for projects
2. `scene_operations.py` - Scene-related operations
3. `media_operations.py` - Media-related operations
4. `generation_operations.py` - Generation and processing operations

## Detailed Implementation Plan

### Step 1: Setup Project Structure
- [x] Create new files for each logical group
- [x] Set up proper imports and router configurations in each file

### Step 2: Extract Project CRUD Operations
- [ ] Move the following endpoints to `project_operations.py`:
  - GET /projects - List all projects
  - POST /projects - Create a new project
  - GET /projects/{project_id} - Get a specific project
  - PUT /projects/{project_id} - Update a project
  - DELETE /projects/{project_id} - Delete a project

### Step 3: Extract Scene Operations
- [ ] Move the following endpoints to `scene_operations.py`:
  - POST /projects/{project_id}/scenes - Add a scene
  - PUT /projects/{project_id}/scenes/{scene_id} - Update a scene
  - DELETE /projects/{project_id}/scenes/{scene_id} - Delete a scene
  - PUT /projects/{project_id}/scenes/reorder - Reorder scenes

### Step 4: Extract Media Operations
- [ ] Move the following endpoints to `media_operations.py`:
  - POST /projects/upload - Upload media
  - GET /projects/media/{media_id} - Get media
  - DELETE /projects/media/{media_id} - Delete media

### Step 5: Extract Generation Operations
- [ ] Move the following endpoints to `generation_operations.py`:
  - POST /projects/{project_id}/generate - Generate video
  - GET /projects/{project_id}/generations/{generation_id} - Get generation
  - POST /projects/{project_id}/scenes/{scene_id}/tts - Text-to-speech

### Step 6: Update Main Router
- [ ] Update main.py to include all new routers
- [ ] Ensure proper prefixes and dependencies are maintained

### Step 7: Testing
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