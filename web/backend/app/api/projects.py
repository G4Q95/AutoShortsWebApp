from fastapi import APIRouter, HTTPException, status, Body
from typing import List, Dict, Any
from app.models.project import Project, ProjectCreate, ProjectResponse
from app.core.database import db
from datetime import datetime
from bson import ObjectId
import motor.motor_asyncio
from fastapi.responses import JSONResponse

router = APIRouter(
    prefix="/projects",
    tags=["projects"],
    responses={404: {"description": "Not found"}},
)

@router.post("/", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
async def create_project(project: ProjectCreate = Body(...)):
    """
    Create a new project.
    """
    # Convert pydantic model to dict for MongoDB
    project_dict = project.model_dump()
    
    # Add timestamps
    project_dict["created_at"] = datetime.utcnow()
    project_dict["updated_at"] = project_dict["created_at"]
    
    # Insert project document
    if not db.is_mock:
        result = await db.client.autoshorts.projects.insert_one(project_dict)
        project_id = result.inserted_id
        
        # Retrieve created project
        created_project = await db.client.autoshorts.projects.find_one({"_id": project_id})
        if created_project:
            # Convert ObjectId to string for the response
            created_project["id"] = str(created_project["_id"])
            return created_project
        raise HTTPException(status_code=404, detail=f"Project not found after creation")
    else:
        # Mock database response
        mock_id = str(ObjectId())
        return {
            "id": mock_id,
            "_id": mock_id,
            **project_dict
        }

@router.get("/test", response_model=Dict[str, Any])
async def test_projects():
    """
    Test endpoint to check MongoDB connection.
    """
    if not db.is_mock:
        try:
            # Get a single project
            project = await db.client.autoshorts.projects.find_one()
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
            cursor = db.client.autoshorts.projects.find()
            projects_list = await cursor.to_list(length=100)
            
            # Convert ObjectId to string
            for project in projects_list:
                project["_id"] = str(project["_id"])
                
            return projects_list
        except Exception as e:
            return JSONResponse(
                status_code=500,
                content={"error": f"Database error: {str(e)}"}
            )
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
                "updated_at": datetime.utcnow().isoformat()
            }
        ]

@router.get("/", response_model=List[ProjectResponse])
async def get_projects():
    """
    Retrieve all projects.
    """
    if not db.is_mock:
        try:
            # Simpler approach: convert to list first
            cursor = db.client.autoshorts.projects.find()
            projects_list = await cursor.to_list(length=100)
            
            # Add id field to each project and normalize field names
            for project in projects_list:
                project["id"] = str(project["_id"])
                
                # Handle different field names for timestamps
                if "createdAt" in project and "created_at" not in project:
                    project["created_at"] = project["createdAt"]
                
                # Ensure all required fields exist
                if "description" not in project:
                    project["description"] = None
                if "user_id" not in project:
                    project["user_id"] = None
                if "scenes" not in project:
                    project["scenes"] = []
                if "updated_at" not in project:
                    project["updated_at"] = project.get("created_at") or project.get("createdAt")
                
            return projects_list
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
    else:
        # Return mock data
        return [
            {
                "id": str(ObjectId()),
                "title": "Mock Project",
                "description": "This is a mock project",
                "user_id": None,
                "scenes": [],
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow()
            }
        ]

@router.get("/{project_id}", response_model=ProjectResponse)
async def get_project(project_id: str):
    """
    Retrieve a specific project by ID.
    """
    try:
        obj_id = ObjectId(project_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid project ID format")
    
    if not db.is_mock:
        project = await db.client.autoshorts.projects.find_one({"_id": obj_id})
        if project:
            project["id"] = str(project["_id"])
            
            # Handle different field names for timestamps
            if "createdAt" in project and "created_at" not in project:
                project["created_at"] = project["createdAt"]
            
            # Ensure all required fields exist
            if "description" not in project:
                project["description"] = None
            if "user_id" not in project:
                project["user_id"] = None
            if "scenes" not in project:
                project["scenes"] = []
            if "updated_at" not in project:
                project["updated_at"] = project.get("created_at") or project.get("createdAt")
                
            return project
        raise HTTPException(status_code=404, detail=f"Project {project_id} not found")
    else:
        # Return mock data
        return {
            "id": project_id,
            "title": "Mock Project",
            "description": "This is a mock project",
            "user_id": None,
            "scenes": [],
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }

@router.put("/{project_id}", response_model=ProjectResponse)
async def update_project(project_id: str, project_update: ProjectCreate = Body(...)):
    """
    Update a project.
    """
    try:
        obj_id = ObjectId(project_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid project ID format")
    
    update_data = project_update.model_dump(exclude_unset=True)
    update_data["updated_at"] = datetime.utcnow()
    
    if not db.is_mock:
        result = await db.client.autoshorts.projects.update_one(
            {"_id": obj_id},
            {"$set": update_data}
        )
        
        if result.modified_count == 0:
            raise HTTPException(status_code=404, detail=f"Project {project_id} not found")
            
        # Retrieve updated project
        updated_project = await db.client.autoshorts.projects.find_one({"_id": obj_id})
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
            "updated_at": datetime.utcnow()
        }

@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project(project_id: str):
    """
    Delete a project.
    """
    try:
        obj_id = ObjectId(project_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid project ID format")
    
    if not db.is_mock:
        result = await db.client.autoshorts.projects.delete_one({"_id": obj_id})
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail=f"Project {project_id} not found")
    # No return for 204 response 