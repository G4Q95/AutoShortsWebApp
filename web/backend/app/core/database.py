"""
Database module for MongoDB connection.
"""

import json
import logging
import os
from contextlib import asynccontextmanager
from datetime import datetime

from bson import ObjectId
from fastapi.responses import JSONResponse
from motor.motor_asyncio import AsyncIOMotorClient

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
            
            self.client = AsyncIOMotorClient(
                settings.MONGODB_URI, 
                serverSelectionTimeoutMS=5000
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

            # Create a mock client that will not cause errors when methods are called
            class MockCollection:
                async def find_one(self, *args, **kwargs):
                    return {}

                async def find(self, *args, **kwargs):
                    class MockCursor:
                        async def to_list(self, length=100):
                            return []

                    return MockCursor()

                async def insert_one(self, *args, **kwargs):
                    return type("obj", (object,), {"inserted_id": "mock_id"})

                async def update_one(self, *args, **kwargs):
                    return type("obj", (object,), {"modified_count": 1})

                async def delete_one(self, *args, **kwargs):
                    return type("obj", (object,), {"deleted_count": 1})

                async def list_collection_names(self, *args, **kwargs):
                    return []

            class MockDB:
                def __getattr__(self, name):
                    return MockCollection()

                async def list_collection_names(self):
                    return []

            class MockClient:
                def __init__(self):
                    pass

                def __getitem__(self, name):
                    return MockDB()

                def __getattr__(self, name):
                    return MockDB()

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
