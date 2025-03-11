import asyncio
import json
import logging
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

import motor.motor_asyncio
from bson import ObjectId
from bson.errors import InvalidId
from fastapi import APIRouter, BackgroundTasks, Body, HTTPException, Response, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from app.core.database import MongoJSONEncoder, db
from app.models.project import Project, ProjectCreate, ProjectResponse
from app.services.video_processing import video_processor

# Configure logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)


# Custom JSON response for handling MongoDB ObjectId
class MongoJSONResponse(JSONResponse):
    def render(self, content: Any) -> bytes:
        return json.dumps(
            content,
            cls=MongoJSONEncoder,
            ensure_ascii=False,
            allow_nan=False,
            indent=None,
            separators=(",", ":"),
        ).encode("utf-8")


router = APIRouter(
    prefix="/projects",
    tags=["projects"],
    responses={404: {"description": "Not found"}},
)


# Define models for project processing
class ProcessProjectRequest(BaseModel):
    mode: str = "custom"  # 'custom' or 'fast'


class ProcessProjectResponse(BaseModel):
    task_id: str
    message: str


# Simple in-memory task storage for project processing
project_processing_tasks = {}


@router.post(
    "/",
    response_model=ProjectResponse,
    status_code=status.HTTP_201_CREATED,
    response_class=MongoJSONResponse,
)
async def create_project(project: ProjectCreate = Body(...)):
    """
    Create a new project.
    """
    try:
        logger.debug(f"Creating new project: {project.title}")
        # Convert pydantic model to dict for MongoDB
        project_dict = project.model_dump(by_alias=True)

        # Add timestamps
        project_dict["created_at"] = datetime.utcnow()
        project_dict["updated_at"] = project_dict["created_at"]

        # Insert project document
        if not db.is_mock:
            mongo_db = db.get_db()
            result = await mongo_db.projects.insert_one(project_dict)
            project_id = result.inserted_id

            # Retrieve created project
            created_project = await mongo_db.projects.find_one({"_id": project_id})
            if created_project:
                # Create a clean project response
                response = {
                    "id": str(created_project.get("_id")),
                    "title": created_project.get("title", ""),
                    "description": created_project.get("description"),
                    "user_id": created_project.get("user_id"),
                    "scenes": created_project.get("scenes", []),
                    "created_at": created_project.get("created_at"),
                    "updated_at": created_project.get("updated_at"),
                }
                logger.debug(f"Project created with ID: {response['id']}")
                return response
            raise HTTPException(
                status_code=404,
                detail="Project not found after creation"
            )
        else:
            # Mock database response
            mock_id = str(ObjectId())
            response = {
                "id": mock_id,
                "title": project.title,
                "description": project.description,
                "user_id": project.user_id,
                "scenes": project.scenes,
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow(),
            }
            return response
    except Exception as e:
        logger.error(f"Error creating project: {str(e)}")
        logger.exception("Full traceback:")
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")


@router.get("/test", response_model=Dict[str, Any])
async def test_projects():
    """
    Test endpoint to check MongoDB connection.
    """
    if not db.is_mock:
        try:
            # Get a single project
            project = await db.client[db.db_name].projects.find_one()
            if project:
                project["id"] = str(project["_id"])
                return {"status": "ok", "project": project}
            return {"status": "ok", "project": None}
        except Exception as e:
            return {"status": "error", "message": str(e)}
    else:
        return {"status": "mock", "message": "Using mock database"}


@router.get("/raw", response_class=JSONResponse)
async def get_projects_raw():
    """
    Retrieve all projects without Pydantic validation.
    """
    if not db.is_mock:
        try:
            # Convert to list first
            cursor = db.client[db.db_name].projects.find()
            projects_list = await cursor.to_list(length=100)

            # Convert ObjectId to string
            for project in projects_list:
                project["_id"] = str(project["_id"])

            return projects_list
        except Exception as e:
            return JSONResponse(status_code=500, content={"error": f"Database error: {str(e)}"})
    else:
        # Return mock data
        return [
            {
                "_id": str(ObjectId()),
                "title": "Mock Project",
                "description": "This is a mock project",
                "user_id": None,
                "scenes": [],
                "created_at": datetime.utcnow().isoformat(),
                "updated_at": datetime.utcnow().isoformat(),
            }
        ]


@router.get("/", response_model=List[ProjectResponse], response_class=MongoJSONResponse)
async def get_projects():
    """
    Retrieve all projects.
    """
    try:
        logger.debug("Retrieving all projects...")
        if not db.is_mock:
            try:
                # Get database reference
                mongo_db = db.get_db()
                logger.debug(f"Using database: {db.db_name}")

                # Get projects
                cursor = mongo_db.projects.find()
                projects_list = await cursor.to_list(length=100)

                logger.debug(f"Found {len(projects_list)} projects")

                # Process the projects for the response
                formatted_projects = []
                for project in projects_list:
                    # Create a clean project dictionary
                    processed_project = {
                        "id": str(project.get("_id")),
                        "title": project.get("title", ""),
                        "description": project.get("description"),
                        "user_id": project.get("user_id"),
                        "scenes": project.get("scenes", []),
                        "created_at": project.get("created_at") or project.get("createdAt"),
                        "updated_at": project.get("updated_at") or project.get("created_at"),
                    }
                    formatted_projects.append(processed_project)

                logger.debug("Returning projects list")
                return formatted_projects
            except Exception as e:
                logger.error(f"Database error: {str(e)}")
                logger.exception("Full traceback:")
                raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
        else:
            # Return mock data
            logger.debug("Using mock data")
            return [
                {
                    "id": str(ObjectId()),
                    "title": "Mock Project",
                    "description": "This is a mock project",
                    "user_id": None,
                    "scenes": [],
                    "created_at": datetime.utcnow(),
                    "updated_at": datetime.utcnow(),
                }
            ]
    except Exception as e:
        logger.error(f"Unexpected error: {str(e)}")
        logger.exception("Full traceback:")
        raise HTTPException(status_code=500, detail=f"Unexpected error: {str(e)}")


@router.get("/{project_id}", response_model=ProjectResponse, response_class=MongoJSONResponse)
async def get_project(project_id: str):
    """
    Get a project by its ID.
    """
    try:
        # Try to convert to ObjectId if it's a valid format
        if len(project_id) == 24 and all(
            c in "0123456789abcdef" for c in project_id.lower()
        ):
            obj_id = ObjectId(project_id)
        else:
            # For non-standard IDs, we'll just use it as is for lookups
            obj_id = project_id
    except Exception:
        # If conversion fails, use the ID as is
        obj_id = project_id

    if not db.is_mock:
        # Use flexible query that works with both ObjectId and string IDs
        project = await db.client[db.db_name].projects.find_one({"_id": obj_id})
        if project:
            return {
                "id": str(project["_id"]),
                "title": project.get("title", ""),
                "description": project.get("description", ""),
                "status": project.get("status", ""),
                "error": project.get("error", ""),
                "created_at": project.get("created_at"),
                "updated_at": project.get("updated_at"),
            }
        raise HTTPException(
            status_code=404,
            detail=f"Project with ID {project_id} not found"
        )
    else:
        # Return mock data for a specific project
        mock_id = project_id
        return {
            "id": mock_id,
            "title": "Mock Project Detail",
            "description": "This is a mock project detail",
            "user_id": None,
            "scenes": [],
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
        }


@router.put("/{project_id}", response_model=ProjectResponse)
async def update_project(project_id: str, project_update: ProjectCreate = Body(...)):
    """
    Update a project by ID.
    """
    try:
        obj_id = ObjectId(project_id)
    except InvalidId:
        raise HTTPException(status_code=400, detail="Invalid project ID format")

    update_data = project_update.model_dump(exclude_unset=True)
    update_data["updated_at"] = datetime.utcnow()

    if not db.is_mock:
        result = await db.client[db.db_name].projects.update_one(
            {"_id": obj_id}, {"$set": update_data}
        )

        if result.modified_count == 0:
            raise HTTPException(status_code=404, detail=f"Project {project_id} not found")

        # Retrieve updated project
        updated_project = await db.client[db.db_name].projects.find_one({"_id": obj_id})
        if updated_project:
            updated_project["id"] = str(updated_project["_id"])

            # Handle different field names for timestamps
            if "createdAt" in updated_project and "created_at" not in updated_project:
                updated_project["created_at"] = updated_project["createdAt"]

            # Ensure all required fields exist
            if "description" not in updated_project:
                updated_project["description"] = None
            if "user_id" not in updated_project:
                updated_project["user_id"] = None
            if "scenes" not in updated_project:
                updated_project["scenes"] = []

            return updated_project
        raise HTTPException(status_code=404, detail=f"Project {project_id} not found after update")
    else:
        # Return mock data
        return {
            "id": project_id,
            **update_data,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
        }


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project(project_id: str):
    """
    Delete a project by ID.
    """
    try:
        obj_id = ObjectId(project_id)
    except InvalidId:
        raise HTTPException(status_code=400, detail="Invalid project ID format")

    if not db.is_mock:
        result = await db.client[db.db_name].projects.delete_one({"_id": obj_id})
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail=f"Project {project_id} not found")
    # No return for 204 response


@router.post("/{project_id}/process", response_model=ProcessProjectResponse)
async def process_project(
    project_id: str,
    request: ProcessProjectRequest = Body(...),
    background_tasks: BackgroundTasks = None,
):
    """
    Process a project to create a video.
    """
    # Try to convert project_id to ObjectId if possible
    try:
        # Try to convert to ObjectId if it's a valid format
        if len(project_id) == 24 and all(c in "0123456789abcdef" for c in project_id.lower()):
            obj_id = ObjectId(project_id)
        else:
            # For non-standard IDs, we'll just use it as is for lookups
            obj_id = project_id
    except Exception:
        # If conversion fails, use the ID as is
        obj_id = project_id

    # Check if project exists
    if not db.is_mock:
        # Use flexible query that works with both ObjectId and string IDs
        if isinstance(obj_id, ObjectId):
            project = await db.client[db.db_name].projects.find_one({"_id": obj_id})
        else:
            # Try to find by string ID (could be in an "id" field or other format)
            project = await db.client[db.db_name].projects.find_one(
                {"$or": [{"_id": obj_id}, {"id": project_id}]}
            )

        if not project:
            # For development purposes, create a mock project
            project = {
                "_id": project_id,
                "title": f"Mock Project {project_id}",
                "scenes": [
                    {
                        "text_content": "This is a test scene for project processing.",
                        "url": "https://example.com/test",
                    }
                ],
            }
    else:
        # For mock database, pretend the project exists
        project = {
            "_id": project_id,
            "title": f"Mock Project {project_id}",
            "scenes": [
                {
                    "text_content": "This is a test scene for project processing.",
                    "url": "https://example.com/test",
                }
            ],
        }

    # Generate a task ID
    task_id = str(uuid.uuid4())

    # Store initial task status
    project_processing_tasks[task_id] = {
        "status": "queued",
        "project_id": project_id,
        "mode": request.mode,
    }

    # Add processing task to background tasks
    if background_tasks:
        background_tasks.add_task(
            process_project_background, task_id=task_id, project_id=project_id, mode=request.mode
        )
    else:
        # For testing or if background_tasks is not available
        asyncio.create_task(
            process_project_background(task_id=task_id, project_id=project_id, mode=request.mode)
        )

    return ProcessProjectResponse(
        task_id=task_id,
        message="Project processing started. Check status with the /status endpoint.",
    )


@router.get("/{project_id}/process/{task_id}", response_model=Dict[str, Any])
async def get_project_processing_status(project_id: str, task_id: str):
    """
    Get the status of a project processing task.
    """
    if task_id not in project_processing_tasks:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")

    task_info = project_processing_tasks[task_id]

    # Check if the task is for the requested project
    if task_info["project_id"] != project_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Task ID does not match project ID"
        )

    return {
        "task_id": task_id,
        "status": task_info["status"],
        "project_id": project_id,
        "video_id": task_info.get("video_id"),
        "storage_url": task_info.get("storage_url"),
        "error": task_info.get("error"),
    }


async def process_project_background(task_id: str, project_id: str, mode: str):
    """
    Background task to process a project and create a video.
    """
    try:
        # Update status
        project_processing_tasks[task_id]["status"] = "processing"

        # Get project data - use same ID handling as in the endpoint
        try:
            if len(project_id) == 24 and all(c in "0123456789abcdef" for c in project_id.lower()):
                obj_id = ObjectId(project_id)
            else:
                obj_id = project_id
        except Exception:
            obj_id = project_id

        if not db.is_mock:
            # Use flexible query that works with both ObjectId and string IDs
            if isinstance(obj_id, ObjectId):
                project = await db.client[db.db_name].projects.find_one({"_id": obj_id})
            else:
                # Try to find by string ID
                project = await db.client[db.db_name].projects.find_one(
                    {"$or": [{"_id": obj_id}, {"id": project_id}]}
                )

            if not project:
                # For development, use a mock project
                project = {
                    "_id": project_id,
                    "title": f"Mock Project {project_id}",
                    "scenes": [
                        {
                            "text_content": "This is a test scene for project processing.",
                            "url": "https://example.com/test",
                        }
                    ],
                }
        else:
            # Mock project data
            project = {
                "_id": project_id,
                "title": f"Mock Project {project_id}",
                "scenes": [
                    {
                        "text_content": "This is a test scene for project processing.",
                        "url": "https://example.com/test",
                    }
                ],
            }

        # Check if project has scenes
        if not project.get("scenes"):
            project_processing_tasks[task_id]["status"] = "failed"
            project_processing_tasks[task_id]["error"] = "Project has no scenes to process"
            return

        # Get combined text from scenes
        combined_text = ""
        for scene in project.get("scenes", []):
            text = scene.get("text_content", "")
            if text:
                combined_text += text + "\n\n"

        if not combined_text.strip():
            project_processing_tasks[task_id]["status"] = "failed"
            project_processing_tasks[task_id]["error"] = "No text content found in project scenes"
            return

        # In a real implementation, we would:
        # 1. Generate voice audio from the text
        # 2. Combine scene media with audio
        # 3. Create the final video

        # For now, simulate the process with a delay
        await asyncio.sleep(2)

        # Process the video (using a simplified approach)
        mock_user_id = "user123"
        success, video_info = await video_processor.create_video(
            text=combined_text,
            voice_path="mock_voice_path.mp3",  # Would be a real path in production
            title=project.get("title", "Untitled Project"),
            user_id=project.get("user_id", mock_user_id),
        )

        if success:
            # Update the task status
            project_processing_tasks[task_id]["status"] = "completed"
            project_processing_tasks[task_id]["video_id"] = video_info.get("video_id")
            project_processing_tasks[task_id]["storage_url"] = video_info.get("storage_url")

            # Update the project status in the database
            if not db.is_mock:
                await db.client[db.db_name].projects.update_one(
                    {"_id": obj_id},
                    {
                        "$set": {
                            "status": "completed",
                            "video_id": video_info.get("video_id"),
                            "video_url": video_info.get("storage_url"),
                            "updated_at": datetime.utcnow(),
                        }
                    },
                )
        else:
            # Handle failure
            project_processing_tasks[task_id]["status"] = "failed"
            project_processing_tasks[task_id]["error"] = video_info.get(
                "error", "Unknown error during video processing"
            )

            # Update project status
            if not db.is_mock:
                await db.client[db.db_name].projects.update_one(
                    {"_id": obj_id},
                    {
                        "$set": {
                            "status": "error",
                            "error": video_info.get("error", "Unknown error"),
                            "updated_at": datetime.utcnow(),
                        }
                    },
                )

    except Exception as e:
        # Handle any unexpected errors
        project_processing_tasks[task_id]["status"] = "failed"
        project_processing_tasks[task_id]["error"] = str(e)

        # Try to update project status
        try:
            if not db.is_mock:
                await db.client[db.db_name].projects.update_one(
                    {"_id": obj_id},
                    {"$set": {"status": "error", "error": str(e), "updated_at": datetime.utcnow()}},
                )
        except Exception as db_error:
            print(f"Failed to update project error status: {db_error}")
            pass
