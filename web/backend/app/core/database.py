import json
import logging

from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorClient

from app.core.config import settings

logger = logging.getLogger(__name__)


# Custom JSON encoder to handle MongoDB ObjectId and dates
class MongoJSONEncoder(json.JSONEncoder):
    def default(self, o):
        if isinstance(o, ObjectId):
            return str(o)
        if hasattr(o, "isoformat"):  # This handles date and datetime
            return o.isoformat()
        return super().default(o)


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
            logger.info(
                f"Connecting to MongoDB using URI: {settings.MONGODB_URI.split('@')[0]}:***@{settings.MONGODB_URI.split('@')[1] if '@' in settings.MONGODB_URI else '...'}"
            )
            self.client = AsyncIOMotorClient(settings.MONGODB_URI, serverSelectionTimeoutMS=5000)
            # Validate connection
            await self.client.admin.command("ping")
            logger.info(f"Connected to MongoDB successfully. Using database: {self.db_name}")

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
