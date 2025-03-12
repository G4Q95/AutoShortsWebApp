# Auto Shorts Web App - API Endpoints

This document provides an overview of the main API endpoints available in the Auto Shorts Web App.

## Base URL

- Development: `http://localhost:8000`
- Docker Development: `http://backend:8000` (from frontend container)

## API Version

All endpoints use the prefix `/api/v1/` to support future API versioning.

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
- Deletes a scene from a project
- Example success response:
  ```json
  {
    "success": true,
    "message": "Scene deleted successfully",
    "data": null,
    "timestamp": "2023-03-12T11:50:45.123Z"
  }
  ```
- Possible error codes:
  - `resource_not_found` (404) - Project or scene not found

### Reorder Scenes
- **PUT** `/api/v1/projects/{project_id}/scenes/reorder`
- Reorders the scenes in a project
- Request body:
  ```json
  {
    "scene_ids": [
      "60f8b1a9c1d9a51234567893",
      "60f8b1a9c1d9a51234567892",
      "60f8b1a9c1d9a51234567894"
    ]
  }
  ```
- Example success response:
  ```json
  {
    "success": true,
    "message": "Scenes reordered successfully",
    "data": {
      "scenes": [
        {
          "scene_id": "60f8b1a9c1d9a51234567893",
          "position": 0
        },
        {
          "scene_id": "60f8b1a9c1d9a51234567892",
          "position": 1
        },
        {
          "scene_id": "60f8b1a9c1d9a51234567894",
          "position": 2
        }
      ]
    },
    "timestamp": "2023-03-12T11:55:45.123Z"
  }
  ```
- Possible error codes:
  - `resource_not_found` (404) - Project or one of the scenes not found
  - `validation_error` (422) - Invalid scene order or missing scenes

## Video Processing

### Create Video from Project
- **POST** `/api/v1/videos/create`
- Creates a video from a project
- Request body:
  ```json
  {
    "project_id": "60f8b1a9c1d9a51234567890",
    "title": "My Video",
    "settings": {
      "voice_id": "default",
      "text_style": "engaging",
      "transition_style": "fade",
      "music_enabled": true
    }
  }
  ```
- Example success response:
  ```json
  {
    "success": true,
    "message": "Video creation started",
    "data": {
      "video_id": "60f8b1a9c1d9a51234567895",
      "task_id": "60f8b1a9c1d9a51234567896",
      "status": "processing",
      "project_id": "60f8b1a9c1d9a51234567890",
      "estimated_completion_time": "2023-03-12T12:30:45.123Z"
    },
    "timestamp": "2023-03-12T12:00:45.123Z"
  }
  ```
- Possible error codes:
  - `resource_not_found` (404) - Project not found
  - `validation_error` (422) - Invalid settings
  - `action_limit_reached` (429) - Video creation limit reached

### Get Video Status
- **GET** `/api/v1/videos/{video_id}/status`
- Gets the status of a video processing task
- Example success response:
  ```json
  {
    "success": true,
    "message": "Video status retrieved successfully",
    "data": {
      "video_id": "60f8b1a9c1d9a51234567895",
      "status": "processing",
      "progress": 65,
      "task_id": "60f8b1a9c1d9a51234567896",
      "current_stage": "processing_scenes",
      "stages_completed": ["extraction", "text_processing"],
      "estimated_completion_time": "2023-03-12T12:30:45.123Z"
    },
    "timestamp": "2023-03-12T12:15:45.123Z"
  }
  ```
- Possible error codes:
  - `resource_not_found` (404) - Video not found

### Get Completed Video
- **GET** `/api/v1/videos/{video_id}`
- Gets information about a completed video
- Example success response:
  ```json
  {
    "success": true,
    "message": "Video retrieved successfully",
    "data": {
      "video_id": "60f8b1a9c1d9a51234567895",
      "title": "My Video",
      "status": "completed",
      "url": "https://example.com/videos/my-video.mp4",
      "thumbnail_url": "https://example.com/thumbnails/my-video.jpg",
      "duration": 45.5,
      "resolution": "720p",
      "file_size": 12500000,
      "created_at": "2023-03-12T12:00:45.123Z",
      "completed_at": "2023-03-12T12:30:45.123Z"
    },
    "timestamp": "2023-03-12T12:35:45.123Z"
  }
  ```
- Possible error codes:
  - `resource_not_found` (404) - Video not found
  - `content_not_found` (404) - Video processing not completed yet

## Media Proxy

### Proxy Media Content
- **GET** `/api/v1/proxy/{media_type}/{encoded_url}`
- Proxies media content to avoid CORS issues
- URL parameters:
  - `media_type`: Type of media (image, video, gif)
  - `encoded_url`: Base64-encoded URL of the media
- Response: The media content with appropriate content type header
- Possible error codes:
  - `validation_error` (422) - Invalid media type or URL
  - `content_not_found` (404) - Media not found
  - `external_service_error` (500) - Error fetching media

## Users and Authentication

### Get Current User
- **GET** `/api/v1/users/me`
- Returns information about the currently authenticated user
- Requires authentication
- Example success response:
  ```json
  {
    "success": true,
    "message": "User retrieved successfully",
    "data": {
      "user_id": "60f8b1a9c1d9a51234567897",
      "username": "exampleuser",
      "email": "user@example.com",
      "created_at": "2023-03-01T10:30:45.123Z",
      "plan": "free",
      "usage": {
        "videos_created": 3,
        "videos_limit": 5,
        "storage_used": 45000000,
        "storage_limit": 100000000
      }
    },
    "timestamp": "2023-03-12T13:00:45.123Z"
  }
  ```
- Possible error codes:
  - `authentication_required` (401) - User is not authenticated 