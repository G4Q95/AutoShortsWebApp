# Auto Shorts Web App - API Endpoints

This document provides an overview of the main API endpoints available in the Auto Shorts Web App.

## Base URL

- Development: `http://localhost:8000`
- Docker Development: `http://backend:8000` (from frontend container)

## API Version

All endpoints use the prefix `/api/v1/` to support future API versioning.

## API Code Organization

The API code has been organized into modular components for better maintainability:

1. **Project Operations** (`web/backend/app/api/endpoints/project_operations.py`)
   - Contains CRUD operations for projects
   - Endpoints: `/api/v1/projects`

2. **Scene Operations** (`web/backend/app/api/endpoints/scene_operations.py`)
   - Manages scene-related functionality
   - Endpoints: `/api/v1/projects/{project_id}/scenes`

3. **Media Operations** (`web/backend/app/api/endpoints/media_operations.py`)
   - Handles media uploads and processing
   - Endpoints: `/api/v1/media`

4. **Generation Operations** (`web/backend/app/api/endpoints/generation_operations.py`)
   - Controls video generation processes
   - Endpoints: `/api/v1/projects/{project_id}/process`

5. **Core Configuration** (`web/backend/app/api/projects.py`)
   - Contains shared models and background tasks
   - Includes debug endpoints

This organization improves code maintainability while maintaining the same API surface for clients.

## Health Checks

### Get API Health
- **GET** `/api/v1/health`
- Returns the health status of the API
- No authentication required
- Example response:
  ```json
  {
    "success": true,
    "message": "OK",
    "data": {
      "status": "healthy",
      "version": "0.1.0",
      "timestamp": "2023-03-12T10:30:45.123Z"
    },
    "timestamp": "2023-03-12T10:30:45.123Z"
  }
  ```

## Content Extraction

### Extract Content from URL
- **POST** `/api/v1/content/extract`
- Extracts content from a URL (primarily Reddit)
- Request body:
  ```json
  {
    "url": "https://www.reddit.com/r/example/comments/123456/example_post/"
  }
  ```
- Example success response:
  ```json
  {
    "success": true,
    "message": "Content extracted successfully",
    "data": {
      "title": "Example Post Title",
      "text": "This is the content of the post",
      "media": [
        {
          "type": "image",
          "url": "https://example.com/image.jpg",
          "width": 800,
          "height": 600
        }
      ],
      "author": "exampleUser",
      "source_url": "https://www.reddit.com/r/example/comments/123456/example_post/",
      "timestamp": "2023-03-12T10:30:45.123Z"
    },
    "timestamp": "2023-03-12T10:30:45.123Z"
  }
  ```
- Possible error codes:
  - `validation_error` (422) - Invalid URL format
  - `content_extraction_error` (500) - Error extracting content
  - `content_not_found` (404) - No content found at URL

## Projects

### Create New Project
- **POST** `/api/v1/projects`
- Creates a new project
- Request body:
  ```json
  {
    "title": "My Example Project",
    "description": "This is an example project"
  }
  ```
- Example success response:
  ```json
  {
    "success": true,
    "message": "Project created successfully",
    "data": {
      "project_id": "60f8b1a9c1d9a51234567890",
      "title": "My Example Project",
      "description": "This is an example project",
      "created_at": "2023-03-12T10:30:45.123Z",
      "updated_at": "2023-03-12T10:30:45.123Z"
    },
    "timestamp": "2023-03-12T10:30:45.123Z"
  }
  ```

### Get All Projects
- **GET** `/api/v1/projects`
- Returns a list of all projects
- Example success response:
  ```json
  {
    "success": true,
    "message": "Projects retrieved successfully",
    "data": {
      "projects": [
        {
          "project_id": "60f8b1a9c1d9a51234567890",
          "title": "My Example Project",
          "description": "This is an example project",
          "created_at": "2023-03-12T10:30:45.123Z",
          "updated_at": "2023-03-12T10:30:45.123Z"
        },
        {
          "project_id": "60f8b1a9c1d9a51234567891",
          "title": "Another Project",
          "description": "Another example project",
          "created_at": "2023-03-12T10:35:45.123Z",
          "updated_at": "2023-03-12T10:35:45.123Z"
        }
      ],
      "total": 2
    },
    "timestamp": "2023-03-12T10:40:45.123Z"
  }
  ```

### Get Project by ID
- **GET** `/api/v1/projects/{project_id}`
- Returns a specific project by ID
- Example success response:
  ```json
  {
    "success": true,
    "message": "Project retrieved successfully",
    "data": {
      "project_id": "60f8b1a9c1d9a51234567890",
      "title": "My Example Project",
      "description": "This is an example project",
      "scenes": [
        {
          "scene_id": "60f8b1a9c1d9a51234567892",
          "position": 0,
          "content": {
            "title": "Example Post Title",
            "text": "This is the content of the post",
            "media": [
              {
                "type": "image",
                "url": "https://example.com/image.jpg",
                "width": 800,
                "height": 600
              }
            ],
            "author": "exampleUser",
            "source_url": "https://www.reddit.com/r/example/comments/123456/example_post/"
          }
        }
      ],
      "created_at": "2023-03-12T10:30:45.123Z",
      "updated_at": "2023-03-12T10:30:45.123Z"
    },
    "timestamp": "2023-03-12T10:40:45.123Z"
  }
  ```
- Possible error codes:
  - `resource_not_found` (404) - Project not found

### Update Project
- **PUT** `/api/v1/projects/{project_id}`
- Updates an existing project
- Request body:
  ```json
  {
    "title": "Updated Project Title",
    "description": "Updated project description"
  }
  ```
- Example success response:
  ```json
  {
    "success": true,
    "message": "Project updated successfully",
    "data": {
      "project_id": "60f8b1a9c1d9a51234567890",
      "title": "Updated Project Title",
      "description": "Updated project description",
      "updated_at": "2023-03-12T11:30:45.123Z"
    },
    "timestamp": "2023-03-12T11:30:45.123Z"
  }
  ```
- Possible error codes:
  - `resource_not_found` (404) - Project not found
  - `validation_error` (422) - Invalid input parameters

### Delete Project
- **DELETE** `/api/v1/projects/{project_id}`
- Deletes a project
- Example success response:
  ```json
  {
    "success": true,
    "message": "Project deleted successfully",
    "data": null,
    "timestamp": "2023-03-12T11:35:45.123Z"
  }
  ```
- Possible error codes:
  - `resource_not_found` (404) - Project not found

## Scenes

### Add Scene to Project
- **POST** `/api/v1/projects/{project_id}/scenes`
- Adds a new scene to a project
- Request body:
  ```json
  {
    "content": {
      "title": "Scene Title",
      "text": "Scene content text",
      "media": [
        {
          "type": "image",
          "url": "https://example.com/image.jpg",
          "width": 800,
          "height": 600
        }
      ],
      "author": "exampleUser",
      "source_url": "https://www.reddit.com/r/example/comments/123456/example_post/"
    },
    "position": 0
  }
  ```
- Example success response:
  ```json
  {
    "success": true,
    "message": "Scene added successfully",
    "data": {
      "scene_id": "60f8b1a9c1d9a51234567892",
      "position": 0,
      "content": {
        "title": "Scene Title",
        "text": "Scene content text",
        "media": [
          {
            "type": "image",
            "url": "https://example.com/image.jpg",
            "width": 800,
            "height": 600
          }
        ],
        "author": "exampleUser",
        "source_url": "https://www.reddit.com/r/example/comments/123456/example_post/"
      }
    },
    "timestamp": "2023-03-12T11:40:45.123Z"
  }
  ```
- Possible error codes:
  - `resource_not_found` (404) - Project not found
  - `validation_error` (422) - Invalid scene data

### Update Scene
- **PUT** `/api/v1/projects/{project_id}/scenes/{scene_id}`
- Updates an existing scene
- Request body:
  ```json
  {
    "content": {
      "title": "Updated Scene Title",
      "text": "Updated scene content text",
      "media": [
        {
          "type": "image",
          "url": "https://example.com/updated-image.jpg",
          "width": 800,
          "height": 600
        }
      ],
      "author": "exampleUser",
      "source_url": "https://www.reddit.com/r/example/comments/123456/example_post/"
    },
    "position": 1
  }
  ```
- Example success response:
  ```json
  {
    "success": true,
    "message": "Scene updated successfully",
    "data": {
      "scene_id": "60f8b1a9c1d9a51234567892",
      "position": 1,
      "content": {
        "title": "Updated Scene Title",
        "text": "Updated scene content text",
        "media": [
          {
            "type": "image",
            "url": "https://example.com/updated-image.jpg",
            "width": 800,
            "height": 600
          }
        ],
        "author": "exampleUser",
        "source_url": "https://www.reddit.com/r/example/comments/123456/example_post/"
      }
    },
    "timestamp": "2023-03-12T11:45:45.123Z"
  }
  ```
- Possible error codes:
  - `resource_not_found` (404) - Project or scene not found
  - `validation_error` (422) - Invalid scene data

### Delete Scene
- **DELETE** `/api/v1/projects/{project_id}/scenes/{scene_id}`

## Error Responses

All error responses follow this format:

```json
{
  "success": false,
  "message": "Error message explaining what went wrong",
  "error": {
    "code": "error_code",
    "details": {}
  },
  "timestamp": "2023-03-12T13:10:45.123Z"
}
```

Common error codes are:
- `validation_error` (422) - Invalid input data
- `authentication_required` (401) - User is not authenticated
- `permission_denied` (403) - User does not have permission
- `resource_not_found` (404) - Requested resource not found
- `method_not_allowed` (405) - HTTP method not allowed for endpoint
- `action_limit_reached` (429) - Rate limit or quota exceeded
- `internal_server_error` (500) - Unexpected server error

## API Implementation Reference

This section provides a reference for developers who need to locate or modify specific API endpoints in the codebase.

### Project Operations
- **File**: `web/backend/app/api/endpoints/project_operations.py`
- **Router**: `project_router`
- **Endpoints**:
  - `GET /api/v1/projects` - List all projects
  - `POST /api/v1/projects` - Create new project
  - `GET /api/v1/projects/{project_id}` - Get project details
  - `PUT /api/v1/projects/{project_id}` - Update project
  - `DELETE /api/v1/projects/{project_id}` - Delete project

### Scene Operations
- **File**: `web/backend/app/api/endpoints/scene_operations.py`
- **Router**: `scene_router`
- **Endpoints**:
  - `POST /api/v1/projects/{project_id}/scenes` - Add scene
  - `PUT /api/v1/projects/{project_id}/scenes/{scene_id}` - Update scene
  - `DELETE /api/v1/projects/{project_id}/scenes/{scene_id}` - Delete scene
  - `PUT /api/v1/projects/{project_id}/scenes/reorder` - Reorder scenes
  - `PUT /api/v1/projects/{project_id}/scenes/{scene_id}/trim` - Update scene trim

### Media Operations
- **File**: `web/backend/app/api/endpoints/media_operations.py`
- **Router**: `media_router`
- **Endpoints**:
  - `POST /api/v1/media/store` - Store media file
  - `GET /api/v1/media/{media_id}` - Get media file
  - `GET /api/v1/proxy/{media_type}/{encoded_url}` - Proxy media content

### Generation Operations
- **File**: `web/backend/app/api/endpoints/generation_operations.py`
- **Router**: `generation_router`
- **Endpoints**:
  - `POST /api/v1/projects/{project_id}/process` - Start project processing
  - `GET /api/v1/projects/{project_id}/process/{task_id}` - Get processing status

### Core Configuration and Background Tasks
- **File**: `web/backend/app/api/projects.py`
- **Contains**:
  - Background task processing function
  - Debug endpoint for storage cleanup
  - Shared models and task storage
  - Custom JSON response handlers for MongoDB