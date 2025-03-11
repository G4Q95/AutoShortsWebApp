import asyncio
import logging
from motor.motor_asyncio import AsyncIOMotorClient
import json
from bson import ObjectId
from datetime import datetime
import os
from dotenv import load_dotenv
import traceback

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

async def test_direct():
    try:
        # Get MongoDB URI from environment
        mongodb_uri = os.getenv("MONGODB_URI", "mongodb://localhost:27017/autoshorts")
        logger.debug(f"MongoDB URI: {mongodb_uri.replace(mongodb_uri.split('@')[0], '***')}")
        
        # Connect to MongoDB
        logger.debug("Attempting to connect to MongoDB...")
        client = AsyncIOMotorClient(mongodb_uri)
        
        # Test connection with ping
        logger.debug("Testing connection with ping...")
        await client.admin.command('ping')
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
        print(json.dumps(projects_list, cls=JSONEncoder, indent=2))
        
        # Close the connection
        client.close()
        logger.debug("Connection closed")
        
    except Exception as e:
        logger.error(f"Error: {str(e)}")
        logger.error(traceback.format_exc())

if __name__ == "__main__":
    asyncio.run(test_direct()) 