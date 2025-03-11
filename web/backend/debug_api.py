import asyncio
import json
import logging
import os
import traceback
from datetime import datetime
from typing import Any, Dict, List

from bson import ObjectId
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel

# Configure logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

# Load environment variables from .env file
load_dotenv()


class JSONEncoder(json.JSONEncoder):
    def default(self, o):
        if isinstance(o, ObjectId):
            return str(o)
        if isinstance(o, datetime):
            return o.isoformat()
        return json.JSONEncoder.default(self, o)


class ProjectResponse(BaseModel):
    id: str
    title: str
    description: str = None
    scenes: List[Dict[str, Any]] = []
    created_at: datetime = None
    updated_at: datetime = None


async def debug_api():
    try:
        # Get MongoDB URI from environment
        mongodb_uri = os.getenv("MONGODB_URI", "mongodb://localhost:27017/autoshorts")
        logger.debug(f"MongoDB URI: {mongodb_uri.replace(mongodb_uri.split('@')[0], '***')}")

        # Connect to MongoDB
        logger.debug("Attempting to connect to MongoDB...")
        client = AsyncIOMotorClient(mongodb_uri)

        # Test connection with ping
        logger.debug("Testing connection with ping...")
        await client.admin.command("ping")
        logger.debug("Ping successful!")

        # Get database name from URI or use default
        db_name = "autoshortsdb"
        logger.debug(f"Using database: {db_name}")
        db = client[db_name]

        # List collections
        logger.debug("Listing collections...")
        collections = await db.list_collection_names()
        logger.debug(f"Collections: {collections}")

        # Try to access projects collection
        logger.debug("Accessing projects collection...")
        cursor = db.projects.find()
        projects_list = await cursor.to_list(length=100)

        # Print the documents
        logger.debug(f"Found {len(projects_list)} projects")

        # Format projects for API response
        formatted_projects = []
        for project in projects_list:
            # Add id field to each project
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

            formatted_projects.append(project)

        # Print formatted projects
        logger.debug("Formatted projects for API response:")
        print(json.dumps(formatted_projects, cls=JSONEncoder, indent=2))

        # Close the connection
        client.close()
        logger.debug("Connection closed")

    except Exception as e:
        logger.error(f"Error: {str(e)}")
        logger.error(traceback.format_exc())


if __name__ == "__main__":
    asyncio.run(debug_api())
