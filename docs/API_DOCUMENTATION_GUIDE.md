# API Documentation Guide for Auto Shorts Web App

This guide outlines the standards and best practices for documenting the Auto Shorts Web App API using FastAPI's Swagger UI integration.

## Table of Contents

1. [API Documentation Overview](#api-documentation-overview)
2. [Documentation Standards](#documentation-standards)
3. [Endpoint Documentation Structure](#endpoint-documentation-structure)
4. [Schema Documentation](#schema-documentation)
5. [Authentication Documentation](#authentication-documentation)
6. [Example Best Practices](#example-best-practices)
7. [Maintaining Documentation](#maintaining-documentation)
8. [Testing Documentation](#testing-documentation)

## API Documentation Overview

The Auto Shorts Web App API is documented using FastAPI's built-in Swagger UI integration, which provides:

- Interactive documentation for all API endpoints
- Request and response schema visualization
- Testing capabilities directly in the browser
- Authentication integration
- Example requests and responses

The API documentation is available at:
- **Swagger UI**: `http://localhost:8000/docs` (Development) or `https://api.autoshortsapp.com/docs` (Production)
- **ReDoc**: `http://localhost:8000/redoc` (Development) or `https://api.autoshortsapp.com/redoc` (Production)

## Documentation Standards

### General Guidelines

1. **Completeness**: Every endpoint must be fully documented
2. **Clarity**: Descriptions should be clear and concise
3. **Examples**: Include realistic examples for requests and responses
4. **Consistency**: Use consistent terminology and formatting
5. **Updates**: Documentation must be updated whenever the API changes
6. **Audience**: Write for developers who are new to the API

### Required Documentation Elements

Each API endpoint must include:

- **Summary**: Brief description (1 line)
- **Description**: Detailed explanation of the endpoint's purpose and behavior
- **Parameters**: All path, query, and header parameters with descriptions
- **Request Body**: Schema and example for endpoints that accept data
- **Responses**: All possible response codes with schemas and examples
- **Authentication**: Authentication requirements
- **Tags**: Appropriate categorization tags

## Endpoint Documentation Structure

### FastAPI Route Decorator

Use FastAPI route decorators with complete documentation:

```python
@router.post(
    "/projects/",
    response_model=ProjectResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new project",
    description="Creates a new video project with the provided name and returns the project details including the generated ID.",
    responses={
        201: {"description": "Project created successfully", "model": ProjectResponse},
        400: {"description": "Invalid input", "model": ErrorResponse},
        401: {"description": "Unauthorized", "model": ErrorResponse}
    },
    tags=["Projects"]
)
async def create_project(
    project: ProjectCreate = Body(..., example={"name": "My Awesome Video"}, 
                              description="The project details")
) -> ProjectResponse:
    # Function implementation
```

### Route Function Docstrings

Include detailed docstrings for each route function:

```python
async def create_project(project: ProjectCreate) -> ProjectResponse:
    """
    Create a new video project.
    
    This endpoint creates a new video project in the database with the provided name.
    Each project serves as a container for scenes that will form a video.
    
    Args:
        project: The project details including name
        
    Returns:
        The created project with its generated ID and creation timestamp
        
    Raises:
        HTTPException 400: If the project data is invalid
        HTTPException 401: If the user is not authenticated
    """
    # Function implementation
```

## Schema Documentation

### Pydantic Model Documentation

Document all Pydantic models with field descriptions:

```python
class ProjectCreate(BaseModel):
    """
    Data required to create a new project.
    """
    name: str = Field(
        ..., 
        description="The name of the project", 
        min_length=1,
        max_length=100,
        example="Reddit Compilation Video"
    )
    
    class Config:
        schema_extra = {
            "example": {
                "name": "My Reddit Compilation"
            }
        }
```

### Response Models

Define clear response models with examples:

```python
class ProjectResponse(BaseModel):
    """
    Response model for project data.
    """
    id: str = Field(..., description="The unique identifier for the project")
    name: str = Field(..., description="The name of the project")
    created_at: datetime = Field(..., description="When the project was created")
    scene_count: int = Field(0, description="Number of scenes in the project")
    
    class Config:
        schema_extra = {
            "example": {
                "id": "507f1f77bcf86cd799439011",
                "name": "My Reddit Compilation",
                "created_at": "2023-09-25T14:30:00Z",
                "scene_count": 0
            }
        }
```

## Authentication Documentation

### Describing Authentication Requirements

Document authentication clearly for protected endpoints:

```python
@router.get(
    "/projects/",
    response_model=List[ProjectResponse],
    summary="Get all projects",
    description="Retrieves all projects for the authenticated user.",
    responses={
        200: {"description": "List of projects", "model": List[ProjectResponse]},
        401: {"description": "Unauthorized", "model": ErrorResponse}
    },
    tags=["Projects"]
)
async def get_projects(
    current_user: User = Depends(get_current_user)
) -> List[ProjectResponse]:
    """Get all projects for the current user."""
    # Function implementation
```

### Security Schemes

Define security schemes in the FastAPI app:

```python
from fastapi.security import OAuth2PasswordBearer

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

app = FastAPI(
    title="Auto Shorts Web App API",
    description="API for creating short videos from social media content",
    version="1.0.0",
    openapi_tags=[
        {"name": "Authentication", "description": "User authentication operations"},
        {"name": "Projects", "description": "Project management operations"},
        {"name": "Scenes", "description": "Scene management operations"},
        {"name": "Content", "description": "Content extraction operations"},
        {"name": "Video", "description": "Video processing operations"}
    ],
    openapi_url="/openapi.json"
)

# Add security scheme
app.add_security_item(
    {"type": "http", "scheme": "bearer", "bearerFormat": "JWT"}
)
```

## Example Best Practices

### Request Examples

Provide realistic request examples:

```python
@router.post(
    "/content/extract/",
    response_model=ContentResponse,
    summary="Extract content from URL",
    description="Extracts media content and text from a provided URL (currently supports Reddit links).",
    responses={
        200: {"description": "Content extracted successfully", "model": ContentResponse},
        400: {"description": "Invalid URL", "model": ErrorResponse},
        422: {"description": "Extraction failed", "model": ErrorResponse}
    },
    tags=["Content"]
)
async def extract_content(
    content_request: ContentRequest = Body(
        ...,
        example={
            "url": "https://www.reddit.com/r/AskReddit/comments/example_post",
            "include_comments": True
        },
        description="URL and extraction options"
    )
) -> ContentResponse:
    """Extract content from a URL."""
    # Function implementation
```

### Response Examples

Include examples for all response codes:

```python
responses={
    200: {
        "description": "Content extracted successfully", 
        "model": ContentResponse,
        "content": {
            "application/json": {
                "example": {
                    "title": "What's your favorite programming language?",
                    "text": "I've been learning programming for a few months...",
                    "media": [
                        {
                            "type": "image",
                            "url": "https://example.com/image.jpg",
                            "width": 800,
                            "height": 600
                        }
                    ],
                    "source_url": "https://www.reddit.com/r/AskReddit/comments/example",
                    "author": "reddit_user123"
                }
            }
        }
    },
    400: {
        "description": "Invalid URL", 
        "model": ErrorResponse,
        "content": {
            "application/json": {
                "example": {
                    "error": "invalid_url",
                    "message": "The URL provided is not valid or supported"
                }
            }
        }
    }
}
```

## Maintaining Documentation

### Documentation Update Process

1. Update documentation whenever API changes:
   - New endpoints
   - Modified parameters
   - Changed response structures
   - New error responses

2. Documentation review should be part of the code review process

3. Use checklists for documentation completeness:
   - All parameters described
   - All responses documented with examples
   - Authentication requirements specified
   - Error cases documented

### Version Management

When making breaking changes:

1. Update the API version in the FastAPI app title
2. Document changes in the API description
3. Consider maintaining backward compatibility for a transition period

## Testing Documentation

### Validation Testing

1. Verify that the generated OpenAPI schema is valid
   - Test with a schema validator (e.g., Swagger Validator)

2. Ensure examples are valid and match the schema
   - Test example requests in the Swagger UI
   - Verify that example responses match the schema

### Documentation Review Process

Before merging API changes:

1. Review the documentation in Swagger UI
2. Verify all endpoints are properly documented
3. Test example requests in the Swagger UI
4. Check that response examples match actual responses

## Common Issues and Solutions

### Schema Not Showing Correctly

- Ensure Pydantic models have all type annotations
- Check for circular imports
- Verify that models use proper Pydantic Field types

### Examples Not Displaying

- Check that the example format matches the schema
- Ensure JSON examples are valid
- Verify that datetime formats are ISO 8601 compliant

### Missing Authentication Information

- Verify security scheme is correctly defined
- Ensure OAuth scopes are properly documented
- Check that protected endpoints use the correct security requirement

---

By following these guidelines, we ensure our API documentation remains comprehensive, accurate, and useful to developers working with the Auto Shorts Web App API. 