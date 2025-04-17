from fastapi import APIRouter, Depends, HTTPException, status
from pymongo.database import Database
from bson import ObjectId
from typing import List, Dict, Any
import json

# Use absolute paths based on the known structure
from app.db.session import get_db
from app.models.project import ProjectCreate, Project, ProjectResponse, ProjectUpdate
from app.core.response import ApiResponse
from app.utils.bson_encoders import json_encoder

router = APIRouter()

# MongoDB interaction functions - modified for synchronous operation
async def db_create_project(db: Database, project_data: dict) -> dict:
    """
    Create a new project in the database.
    
    Args:
        db: MongoDB database
        project_data: Project data
        
    Returns:
        Created project document
    """
    from datetime import datetime
    
    # Ensure scenes array exists
    if 'scenes' not in project_data or project_data['scenes'] is None:
        project_data['scenes'] = []
    
    # Add timestamps
    project_data['created_at'] = datetime.utcnow()
    project_data['updated_at'] = datetime.utcnow()
    
    # Insert into database - synchronous operation with PyMongo
    result = db.projects.insert_one(project_data)
    
    # Retrieve the inserted document - synchronous operation with PyMongo
    created_doc = db.projects.find_one({"_id": result.inserted_id})
    
    return created_doc

async def db_get_project(db: Database, project_id: str) -> dict | None:
    """
    Get a project from the database.
    
    Args:
        db: MongoDB database
        project_id: Project ID
        
    Returns:
        Project document or None if not found
    """
    # Validate ObjectId
    if not ObjectId.is_valid(project_id):
        return None
    
    # Find project - synchronous operation with PyMongo
    project = db.projects.find_one({"_id": ObjectId(project_id)})
    
    return project

async def db_update_project(db: Database, project_id: str, update_data: dict) -> dict | None:
    """
    Update a project in the database.
    
    Args:
        db: MongoDB database
        project_id: Project ID
        update_data: Update data
        
    Returns:
        Updated project document or None if not found
    """
    from datetime import datetime
    
    # Validate ObjectId
    if not ObjectId.is_valid(project_id):
        return None
    
    # Add updated_at timestamp
    update_data['updated_at'] = datetime.utcnow()
    
    # Handle scenes update: convert objects to dicts
    if 'scenes' in update_data and update_data['scenes'] is not None:
        # Ensure scenes is a list
        scenes = update_data.get('scenes', [])
        # Convert to list of dicts if not already
        if isinstance(scenes, list):
            scenes_dicts = []
            for scene in scenes:
                if hasattr(scene, 'model_dump'):
                    scene_dict = scene.model_dump(exclude_unset=True)
                    scenes_dicts.append(scene_dict)
                elif isinstance(scene, dict):
                    scenes_dicts.append(scene)
            update_data['scenes'] = scenes_dicts
    
    # Update project - synchronous operation with PyMongo
    result = db.projects.update_one(
        {"_id": ObjectId(project_id)},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        return None
    
    # Retrieve updated document - synchronous operation with PyMongo
    updated_doc = db.projects.find_one({"_id": ObjectId(project_id)})
    
    return updated_doc

async def db_get_all_projects(db: Database) -> List[dict]:
    """
    Get all projects from the database.
    
    Args:
        db: MongoDB database
        
    Returns:
        List of project documents
    """
    # Using synchronous PyMongo operation
    cursor = db.projects.find({})
    projects = list(cursor)
    
    return projects


@router.post(
    "/", 
    response_model=ApiResponse[ProjectResponse], 
    status_code=status.HTTP_201_CREATED,
    summary="Create a new project"
)
async def create_project(
    project: ProjectCreate,
    db: Database = Depends(get_db)
):
    """
    Create a new project with the given title and optional description/scenes.
    """
    try:
        project_dict = project.model_dump(exclude_unset=True)
        
        # Create project in database
        created_project_doc = await db_create_project(db, project_dict)
        
        if not created_project_doc:
             raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to create project in database")

        # Convert the MongoDB document to a dict that can be serialized
        # First convert to a JSON string with a custom encoder, then parse back to dict
        json_str = json.dumps(created_project_doc, default=json_encoder)
        serializable_doc = json.loads(json_str)
        
        # Ensure id field exists
        if '_id' in created_project_doc:
            serializable_doc['id'] = str(created_project_doc['_id'])

        # Validate the data structure before returning
        validated_project = ProjectResponse.model_validate(serializable_doc)

        return ApiResponse[ProjectResponse](success=True, data=validated_project)

    except Exception as e:
        print(f"Error creating project: {e}") # Log the error
        # Consider more specific error handling
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, 
            detail=f"An unexpected error occurred: {str(e)}"
        )

@router.get(
    "/{project_id}", 
    response_model=ApiResponse[ProjectResponse],
    summary="Get a project by ID"
)
async def get_project(
    project_id: str,
    db: Database = Depends(get_db)
):
    """
    Get a project by ID.
    """
    try:
        # Get project from database
        project_doc = await db_get_project(db, project_id)
        
        if not project_doc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
        
        # Convert the MongoDB document to a dict that can be serialized
        json_str = json.dumps(project_doc, default=json_encoder)
        serializable_doc = json.loads(json_str)
        
        # Ensure id field exists
        if '_id' in project_doc:
            serializable_doc['id'] = str(project_doc['_id'])
        
        # Validate the data structure before returning
        validated_project = ProjectResponse.model_validate(serializable_doc)
        
        return ApiResponse[ProjectResponse](success=True, data=validated_project)
    
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error getting project: {e}") # Log the error
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, 
            detail=f"An unexpected error occurred: {str(e)}"
        )

@router.patch(
    "/{project_id}", 
    response_model=ApiResponse[ProjectResponse],
    summary="Update a project"
)
async def update_project(
    project_id: str,
    project_update: ProjectUpdate,
    db: Database = Depends(get_db)
):
    """
    Update a project with the given data.
    """
    try:
        # Convert update model to dict
        update_data = project_update.model_dump(exclude_unset=True)
        
        # Update project in database
        updated_doc = await db_update_project(db, project_id, update_data)
        
        if not updated_doc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
        
        # Convert the MongoDB document to a dict that can be serialized
        json_str = json.dumps(updated_doc, default=json_encoder)
        serializable_doc = json.loads(json_str)
        
        # Ensure id field exists
        if '_id' in updated_doc:
            serializable_doc['id'] = str(updated_doc['_id'])
        
        # Validate the data structure before returning
        validated_project = ProjectResponse.model_validate(serializable_doc)
        
        return ApiResponse[ProjectResponse](success=True, data=validated_project)
    
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error updating project: {e}") # Log the error
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, 
            detail=f"An unexpected error occurred: {str(e)}"
        )

@router.get(
    "/", 
    response_model=ApiResponse[List[ProjectResponse]],
    summary="Get all projects"
)
async def get_all_projects(
    db: Database = Depends(get_db)
):
    """
    Get all projects.
    """
    try:
        # Get all projects from database
        projects_docs = await db_get_all_projects(db)
        
        # Convert the MongoDB documents to dicts that can be serialized
        serializable_projects = []
        for project_doc in projects_docs:
            # Convert document to JSON and back to get a serializable dict
            json_str = json.dumps(project_doc, default=json_encoder)
            serializable_doc = json.loads(json_str)
            
            # Ensure id field exists
            if '_id' in project_doc:
                serializable_doc['id'] = str(project_doc['_id'])
                
            serializable_projects.append(serializable_doc)
        
        # Validate the data structure before returning
        validated_projects = [ProjectResponse.model_validate(doc) for doc in serializable_projects]
        
        return ApiResponse[List[ProjectResponse]](success=True, data=validated_projects)
    
    except Exception as e:
        print(f"Error getting projects: {e}") # Log the error
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, 
            detail=f"An unexpected error occurred: {str(e)}"
        )

@router.delete(
    "/{project_id}",
    response_model=ApiResponse[Dict[str, Any]],
    summary="Delete a project"
)
async def delete_project(
    project_id: str,
    db: Database = Depends(get_db)
):
    """
    Delete a project.
    """
    try:
        # Validate ObjectId
        if not ObjectId.is_valid(project_id):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid project ID format")
        
        # Delete project - synchronous operation with PyMongo
        result = db.projects.delete_one({"_id": ObjectId(project_id)})
        
        if result.deleted_count == 0:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
        
        return ApiResponse[Dict[str, Any]](
            success=True, 
            data={"id": project_id, "deleted": True},
            message="Project deleted successfully"
        )
    
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error deleting project: {e}") # Log the error
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, 
            detail=f"An unexpected error occurred: {str(e)}"
        ) 