from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from typing import List, Optional
from bson import ObjectId

from ...core.auth import get_current_user
from ...schemas.project import ProjectResponse, ProjectCreate, ProjectUpdate
from ...db.mongodb import get_database
from ...services.projects import (
    create_project_service,
    get_projects_service,
    get_project_service,
    update_project_service,
    delete_project_service,
)
from ...models.user import User

# Create router
project_router = APIRouter(
    prefix="/projects",
    tags=["projects"],
)

# We'll move the following endpoints from projects.py:
# 1. GET /projects - List all projects
# 2. POST /projects - Create a new project
# 3. GET /projects/{project_id} - Get a specific project
# 4. PUT /projects/{project_id} - Update a project
# 5. DELETE /projects/{project_id} - Delete a project

# The actual implementation will be extracted from projects.py 