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
        if hasattr(o, 'isoformat'):  # This handles date and datetime
            return o.isoformat()
        return super().default(o)

async def test_mongodb_connection():
    try:
        # Get MongoDB URI from environment
        mongodb_uri = os.getenv("MONGODB_URI")
        if not mongodb_uri:
            logger.error("MONGODB_URI environment variable not set")
            return False
        
        logger.debug(f"MongoDB URI: {mongodb_uri.split('@')[0]}:***@{mongodb_uri.split('@')[1]}")
        
        # Connect to MongoDB
        logger.debug("Attempting to connect to MongoDB...")
        client = AsyncIOMotorClient(mongodb_uri, serverSelectionTimeoutMS=5000)
        
        # Test connection with ping
        logger.debug("Testing connection with ping...")
        await client.admin.command('ping')
        logger.debug("Ping successful!")
        
        # Get database name from URI or use default
        db_name = "autoshortsdb"
        db = client[db_name]
        logger.debug(f"Using database: {db_name}")
        
        # List collections
        logger.debug("Listing collections...")
        collections = await db.list_collection_names()
        logger.debug(f"Available collections: {collections}")
        
        # Create a test project
        test_project = {
            "title": "Test Project from Connection Script",
            "description": "Created to verify MongoDB connection",
            "user_id": None,
            "scenes": [
                {
                    "url": "https://www.example.com/test",
                    "title": "Test Scene",
                    "text_content": "This is a test scene",
                    "media_url": None,
                    "media_type": None,
                    "author": "test_script"
                }
            ],
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }
        
        # Insert test project
        logger.debug("Inserting test project...")
        result = await db.projects.insert_one(test_project)
        project_id = result.inserted_id
        logger.debug(f"Test project inserted with ID: {project_id}")
        
        # Retrieve test project
        logger.debug("Retrieving test project...")
        project = await db.projects.find_one({"_id": project_id})
        if project:
            logger.debug("Successfully retrieved test project:")
            print(json.dumps(project, cls=JSONEncoder, indent=2))
        else:
            logger.error("Failed to retrieve test project")
        
        # List all projects
        logger.debug("Listing all projects...")
        cursor = db.projects.find()
        projects = await cursor.to_list(length=100)
        logger.debug(f"Found {len(projects)} projects:")
        for i, p in enumerate(projects):
            print(f"\nProject {i+1}:")
            print(json.dumps(p, cls=JSONEncoder, indent=2))
        
        # Clean up test project
        logger.debug("Cleaning up test project...")
        await db.projects.delete_one({"_id": project_id})
        logger.debug("Test project deleted")
        
        # Close connection
        client.close()
        logger.debug("MongoDB connection closed")
        
        return True
    except Exception as e:
        logger.error(f"Error connecting to MongoDB: {e}")
        logger.error(traceback.format_exc())
        return False

if __name__ == "__main__":
    print("\n========== MongoDB Connection Test ==========\n")
    success = asyncio.run(test_mongodb_connection())
    if success:
        print("\n✅ MongoDB connection test passed successfully!\n")
    else:
        print("\n❌ MongoDB connection test failed!\n") 