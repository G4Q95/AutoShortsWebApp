import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import json
from bson import ObjectId
from datetime import datetime

class JSONEncoder(json.JSONEncoder):
    def default(self, o):
        if isinstance(o, ObjectId):
            return str(o)
        if isinstance(o, datetime):
            return o.isoformat()
        return json.JSONEncoder.default(self, o)

async def create_project():
    # Connect to MongoDB
    client = AsyncIOMotorClient("mongodb://localhost:27017/autoshorts")
    
    # Get a reference to the database
    db = client.autoshorts
    
    # Get a reference to the collection
    collection = db.projects
    
    # Create a new project
    project = {
        "title": "Test Project from Script",
        "description": "A test project created from a Python script",
        "user_id": None,
        "scenes": [],
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }
    
    # Insert the project
    result = await collection.insert_one(project)
    
    # Print the result
    print(f"Inserted project with ID: {result.inserted_id}")
    
    # Find all documents
    cursor = collection.find()
    documents = await cursor.to_list(length=100)
    
    # Print the documents
    print(json.dumps(documents, cls=JSONEncoder, indent=2))
    
    # Close the connection
    client.close()

if __name__ == "__main__":
    asyncio.run(create_project()) 