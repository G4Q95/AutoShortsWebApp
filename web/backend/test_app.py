import json
import logging
import os
import traceback
from datetime import datetime
from typing import Any, Dict, List

import uvicorn
from bson import ObjectId
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from motor.motor_asyncio import AsyncIOMotorClient

# Configure logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

# Load environment variables from .env file
load_dotenv()

app = FastAPI(title="Test API")

# MongoDB connection
client = None
db_name = "autoshortsdb"


class JSONEncoder(json.JSONEncoder):
    def default(self, o):
        if isinstance(o, ObjectId):
            return str(o)
        if isinstance(o, datetime):
            return o.isoformat()
        return json.JSONEncoder.default(self, o)


@app.on_event("startup")
async def startup_db_client():
    global client
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
    except Exception as e:
        logger.error(f"Error connecting to MongoDB: {str(e)}")
        logger.error(traceback.format_exc())
        raise


@app.on_event("shutdown")
async def shutdown_db_client():
    global client
    if client:
        client.close()
        logger.debug("MongoDB connection closed")


@app.get("/")
async def root():
    return {"message": "Test API is running"}


@app.get("/projects")
async def get_projects():
    try:
        logger.debug("Retrieving all projects...")
        global client, db_name

        # Get database
        db = client[db_name]
        logger.debug(f"Using database: {db_name}")

        # Get projects
        cursor = db.projects.find()
        projects_list = await cursor.to_list(length=100)
        logger.debug(f"Found {len(projects_list)} projects")

        # Format projects
        formatted_projects = []
        for project in projects_list:
            project["id"] = str(project["_id"])
            formatted_projects.append(project)

        return formatted_projects
    except Exception as e:
        logger.error(f"Error retrieving projects: {str(e)}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    uvicorn.run("test_app:app", host="0.0.0.0", port=8005, reload=True)
