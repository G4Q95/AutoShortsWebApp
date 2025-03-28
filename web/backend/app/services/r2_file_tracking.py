"""
R2 File Tracking Service
This service handles tracking and managing R2 file paths in the database.
"""

import logging
from datetime import datetime
from typing import List, Dict, Any, Optional

from app.core.database import db
from app.models.storage import R2FilePathCreate, R2FilePath

logger = logging.getLogger(__name__)

class R2FileTrackingService:
    """Service for tracking R2 file paths"""
    
    async def create_file_record(self, file_data: R2FilePathCreate) -> str:
        """
        Create a new R2 file path record in the database.
        
        Args:
            file_data: The file path data to create
            
        Returns:
            The ID of the created record
        """
        logger.info(f"Creating R2 file path record for project: {file_data.project_id}, key: {file_data.object_key}")
        
        # Convert to dict for insertion
        file_dict = file_data.dict()
        file_dict["created_at"] = datetime.utcnow()
        file_dict["updated_at"] = file_dict["created_at"]
        
        try:
            if not db.is_mock:
                # Get database reference
                mongo_db = db.get_db()
                
                # Insert into database
                result = await mongo_db.r2_file_paths.insert_one(file_dict)
                file_id = str(result.inserted_id)
                
                logger.info(f"Created R2 file path record with ID: {file_id}")
                return file_id
            else:
                # Mock database just returns a placeholder ID
                logger.info("Using mock database - creating simulated record")
                return "mock_file_path_id"
        except Exception as e:
            logger.error(f"Error creating R2 file path record: {str(e)}")
            # Still return a success signal since the file was uploaded even if tracking failed
            return None
    
    async def get_project_files(self, project_id: str) -> List[Dict[str, Any]]:
        """
        Get all file records for a specific project.
        
        Args:
            project_id: The project ID to get files for
            
        Returns:
            List of file records for the project
        """
        logger.info(f"Getting R2 file records for project: {project_id}")
        
        try:
            if not db.is_mock:
                # Get database reference
                mongo_db = db.get_db()
                
                # Query for files with this project ID
                cursor = mongo_db.r2_file_paths.find({"project_id": project_id})
                file_records = await cursor.to_list(length=1000)  # Limit to 1000 files per project
                
                logger.info(f"Found {len(file_records)} file records for project {project_id}")
                
                # Convert ObjectId to string
                for record in file_records:
                    if "_id" in record:
                        record["id"] = str(record["_id"])
                
                return file_records
            else:
                # Mock database returns empty list
                logger.info("Using mock database - returning empty file list")
                return []
        except Exception as e:
            logger.error(f"Error retrieving R2 file records for project {project_id}: {str(e)}")
            return []
    
    async def delete_project_files(self, project_id: str) -> int:
        """
        Delete all file tracking records for a specific project.
        
        Args:
            project_id: The project ID to delete files for
            
        Returns:
            Number of records deleted
        """
        logger.info(f"Deleting R2 file records for project: {project_id}")
        
        try:
            if not db.is_mock:
                # Get database reference
                mongo_db = db.get_db()
                
                # Delete all files for this project
                result = await mongo_db.r2_file_paths.delete_many({"project_id": project_id})
                deleted_count = result.deleted_count
                
                logger.info(f"Deleted {deleted_count} file records for project {project_id}")
                return deleted_count
            else:
                # Mock database just returns success
                logger.info("Using mock database - simulating deletion")
                return 0
        except Exception as e:
            logger.error(f"Error deleting R2 file records for project {project_id}: {str(e)}")
            return 0

# Create a singleton instance
r2_file_tracking = R2FileTrackingService() 