"""
Database module for MongoDB connection with improved reliability.
"""

import json
import logging
import os
import re
from contextlib import asynccontextmanager
from datetime import datetime

from bson import ObjectId
from fastapi.responses import JSONResponse
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo.errors import ServerSelectionTimeoutError, ConnectionFailure

from app.core.config import settings
from app.core.json_encoder import MongoJSONEncoder

logger = logging.getLogger(__name__)


class Database:
    client: AsyncIOMotorClient = None
    is_mock: bool = False
    db_name: str = "autoshortsdb"  # Explicitly set the database name

    def get_client(self) -> AsyncIOMotorClient:
        """
        Returns an instance of the database client
        """
        return self.client

    def get_db(self):
        """
        Returns the database
        """
        if self.client:
            return self.client[self.db_name]
        return None

    async def connect(self):
        """
        Connect to MongoDB Atlas, or use a mock if not available
        """
        try:
            # Create a sanitized URI for logging (hide password)
            if '@' in settings.MONGODB_URI:
                uri_prefix = settings.MONGODB_URI.split('@')[0]
                uri_suffix = settings.MONGODB_URI.split('@')[1]
                sanitized_uri = f"{uri_prefix.rsplit(':', 1)[0]}:***@{uri_suffix}"
            else:
                sanitized_uri = "..."
            
            logger.info(f"Connecting to MongoDB using URI: {sanitized_uri}")
            
            # Extract hostname for logging
            hostname = None
            match = re.search(r'@([^/?]+)', settings.MONGODB_URI)
            if match:
                hostname = match.group(1)
                logger.info(f"Extracted hostname: {hostname}")
            
            # Configure client with improved connection settings
            self.client = AsyncIOMotorClient(
                settings.MONGODB_URI,
                serverSelectionTimeoutMS=30000,  # Increase timeout to 30 seconds
                connectTimeoutMS=30000,
                socketTimeoutMS=30000,
                maxPoolSize=10,
                retryWrites=True,
                w="majority",
                maxIdleTimeMS=30000,
                appName="autoshorts-app"
            )
            
            # Validate connection
            await self.client.admin.command("ping")
            logger.info(
                f"Connected to MongoDB successfully. Using database: {self.db_name}"
            )

            # Log available collections
            db = self.client[self.db_name]
            collections = await db.list_collection_names()
            logger.info(f"Available collections: {collections}")

            self.is_mock = False
        except Exception as e:
            logger.warning(f"Could not connect to MongoDB: {e}")
            logger.warning("Using mock database instead")
            self.is_mock = True
            self._setup_mock_database()

    def _setup_mock_database(self):
        """Set up a more complete mock database with in-memory storage"""
        class MockCollection:
            def __init__(self, name):
                self.name = name
                self.documents = {}
                logger.info(f"Created mock collection: {name}")
            
            async def find_one(self, query):
                if "_id" in query and query["_id"] in self.documents:
                    logger.debug(f"Mock find_one in {self.name}: {query}")
                    return self.documents[query["_id"]]
                
                # Simple search for other fields
                for doc in self.documents.values():
                    match = True
                    for k, v in query.items():
                        if k not in doc or doc[k] != v:
                            match = False
                            break
                    if match:
                        return doc
                return None
            
            async def find(self, query=None, **kwargs):
                if query is None:
                    query = {}
                
                class MockCursor:
                    def __init__(self, docs):
                        self.docs = docs
                    
                    async def to_list(self, length=100):
                        return self.docs[:length]
                
                results = []
                for doc in self.documents.values():
                    if not query:  # No filter, return all
                        results.append(doc)
                        continue
                    
                    match = True
                    for k, v in query.items():
                        if k not in doc or doc[k] != v:
                            match = False
                            break
                    if match:
                        results.append(doc)
                
                logger.debug(f"Mock find in {self.name}: {len(results)} results")
                return MockCursor(results)
            
            async def insert_one(self, document):
                if "_id" not in document:
                    document["_id"] = str(ObjectId())
                self.documents[document["_id"]] = document
                logger.debug(f"Mock insert into {self.name}: {document['_id']}")
                return type("obj", (object,), {"inserted_id": document["_id"]})
            
            async def update_one(self, query, update, **kwargs):
                doc = await self.find_one(query)
                if doc:
                    # Handle $set operator
                    if "$set" in update:
                        for k, v in update["$set"].items():
                            doc[k] = v
                    # Handle direct field updates
                    for k, v in update.items():
                        if not k.startswith("$"):
                            doc[k] = v
                    logger.debug(f"Mock update in {self.name}: {doc['_id']}")
                    return type("obj", (object,), {"modified_count": 1})
                return type("obj", (object,), {"modified_count": 0})
            
            async def delete_one(self, query):
                doc = await self.find_one(query)
                if doc and "_id" in doc:
                    del self.documents[doc["_id"]]
                    logger.debug(f"Mock delete in {self.name}: {doc['_id']}")
                    return type("obj", (object,), {"deleted_count": 1})
                return type("obj", (object,), {"deleted_count": 0})
            
            async def delete_many(self, query):
                docs = []
                async for doc in await self.find(query):
                    docs.append(doc)
                
                deleted = 0
                for doc in docs:
                    if "_id" in doc and doc["_id"] in self.documents:
                        del self.documents[doc["_id"]]
                        deleted += 1
                
                logger.debug(f"Mock delete_many in {self.name}: {deleted}")
                return type("obj", (object,), {"deleted_count": deleted})
            
            async def count_documents(self, query=None):
                if query is None:
                    query = {}
                
                count = 0
                for doc in self.documents.values():
                    match = True
                    for k, v in query.items():
                        if k not in doc or doc[k] != v:
                            match = False
                            break
                    if match:
                        count += 1
                
                return count

        class MockDB:
            def __init__(self):
                self.collections = {}
                # Create default collections
                self.collections["projects"] = MockCollection("projects")
                self.collections["users"] = MockCollection("users")
                self.collections["file_paths"] = MockCollection("file_paths")
            
            def __getitem__(self, name):
                if name not in self.collections:
                    self.collections[name] = MockCollection(name)
                return self.collections[name]
            
            def __getattr__(self, name):
                if name not in self.collections:
                    self.collections[name] = MockCollection(name)
                return self.collections[name]
            
            async def list_collection_names(self):
                return list(self.collections.keys())

        class MockClient:
            def __init__(self):
                self.admin = MockDB()
                self.dbs = {"autoshortsdb": MockDB()}
            
            def __getitem__(self, name):
                if name not in self.dbs:
                    self.dbs[name] = MockDB()
                return self.dbs[name]
            
            def close(self):
                pass

        self.client = MockClient()

    async def close(self):
        """
        Close the database connection
        """
        if self.client and not self.is_mock:
            self.client.close()
            logger.info("MongoDB connection closed")


db = Database()

async def init_db():
    """
    Initialize the database connection.
    This function is called during app startup.
    """
    await db.connect()

async def close_db():
    """
    Close the database connection.
    This function is called during app shutdown.
    """
    await db.close()

class MongoJSONResponse(JSONResponse):
    """
    Custom JSON response that handles MongoDB ObjectId serialization.
    """
    def render(self, content) -> bytes:
        return json.dumps(
            content,
            cls=MongoJSONEncoder,
            ensure_ascii=False,
            allow_nan=False,
            indent=None,
            separators=(",", ":"),
        ).encode("utf-8")
