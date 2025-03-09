from motor.motor_asyncio import AsyncIOMotorClient
from app.core.config import settings

class Database:
    client: AsyncIOMotorClient = None
    
    def get_client(self) -> AsyncIOMotorClient:
        """
        Returns an instance of the database client
        """
        return self.client
    
    async def connect(self):
        """
        Connect to MongoDB Atlas
        """
        self.client = AsyncIOMotorClient(settings.MONGODB_URI)
        
    async def close(self):
        """
        Close the database connection
        """
        if self.client:
            self.client.close()

db = Database() 