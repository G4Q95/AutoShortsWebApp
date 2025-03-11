import asyncio
import json
import os
from datetime import datetime

from bson import ObjectId
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

# Load environment variables from .env file
load_dotenv()


class JSONEncoder(json.JSONEncoder):
    def default(self, o):
        if isinstance(o, ObjectId):
            return str(o)
        if isinstance(o, datetime):
            return o.isoformat()
        return json.JSONEncoder.default(self, o)


async def create_test_project():
    # Get MongoDB URI from environment
    mongodb_uri = os.getenv("MONGODB_URI", "mongodb://localhost:27017/autoshorts")

    # Connect to MongoDB
    client = AsyncIOMotorClient(mongodb_uri)

    # Get a reference to the database
    db = client.autoshortsdb

    # Create a test project
    project = {
        "title": "Sample Project",
        "description": "A sample project for testing MongoDB integration",
        "user_id": None,
        "scenes": [
            {
                "url": "https://www.reddit.com/r/funny/comments/sample",
                "title": "Sample Scene",
                "text_content": "This is a sample scene for testing",
                "media_url": None,
                "media_type": None,
                "author": "test_user",
            }
        ],
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
    }

    # Insert the project
    result = await db.projects.insert_one(project)
    print(f"Inserted project with ID: {result.inserted_id}")

    # Retrieve and verify the project
    inserted_project = await db.projects.find_one({"_id": result.inserted_id})
    print("\nRetrieved project:")
    print(json.dumps(inserted_project, cls=JSONEncoder, indent=2))

    # Close the connection
    client.close()


if __name__ == "__main__":
    asyncio.run(create_test_project())
