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


async def test_connection():
    # Get MongoDB URI from environment
    mongodb_uri = os.getenv("MONGODB_URI", "mongodb://localhost:27017/autoshorts")

    # Connect to MongoDB
    client = AsyncIOMotorClient(mongodb_uri)

    # Get a reference to the database
    db = client.autoshortsdb

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
