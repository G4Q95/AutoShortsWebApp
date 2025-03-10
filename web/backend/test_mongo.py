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

async def test_connection():
    # Connect to MongoDB
    client = AsyncIOMotorClient("mongodb://localhost:27017/autoshorts")
    
    # Get a reference to the database
    db = client.autoshorts
    
    # Get a reference to the collection
    collection = db.projects
    
    # Find all documents
    cursor = collection.find()
    documents = await cursor.to_list(length=100)
    
    # Print the documents
    print(json.dumps(documents, cls=JSONEncoder, indent=2))
    
    # Close the connection
    client.close()

if __name__ == "__main__":
    asyncio.run(test_connection()) 