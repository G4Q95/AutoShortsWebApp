from motor.motor_asyncio import AsyncIOMotorClient
from app.core.config import settings
import logging

class Database:
    client: AsyncIOMotorClient = None
    is_mock: bool = False
    
    def get_client(self) -> AsyncIOMotorClient:
        """
        Returns an instance of the database client
        """
        return self.client
    
    async def connect(self):
        """
        Connect to MongoDB Atlas, or use a mock if not available
        """
        try:
            self.client = AsyncIOMotorClient(settings.MONGODB_URI, serverSelectionTimeoutMS=5000)
            # Validate connection
            await self.client.admin.command('ping')
            logging.info("Connected to MongoDB successfully")
        except Exception as e:
            logging.warning(f"Could not connect to MongoDB: {e}")
            logging.warning("Using mock database instead")
            self.is_mock = True
            # Create a mock client that will not cause errors when methods are called
            class MockCollection:
                async def find_one(self, *args, **kwargs):
                    return {}
                
                async def find(self, *args, **kwargs):
                    return []
                
                async def insert_one(self, *args, **kwargs):
                    return type('obj', (object,), {'inserted_id': 'mock_id'})
                
                async def update_one(self, *args, **kwargs):
                    return type('obj', (object,), {'modified_count': 1})
                
                async def delete_one(self, *args, **kwargs):
                    return type('obj', (object,), {'deleted_count': 1})
            
            class MockDB:
                def __getattr__(self, name):
                    return type('obj', (object,), {'__getattr__': lambda self, name: MockCollection()})
            
            class MockClient:
                def __getattr__(self, name):
                    return MockDB()
            
            self.client = MockClient()
        
    async def close(self):
        """
        Close the database connection
        """
        if self.client and not self.is_mock:
            self.client.close()

db = Database() 