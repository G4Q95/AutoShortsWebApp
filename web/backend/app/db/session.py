import logging
from typing import Generator
from pymongo import MongoClient
from pymongo.database import Database
from urllib.parse import urlparse

from app.core.config import settings
from app.db.mongodb import extract_db_name_from_uri

# Configure logging
logger = logging.getLogger(__name__)

def get_db() -> Generator[Database, None, None]:
    """
    Get MongoDB database connection.
    
    Yields:
        Database: MongoDB database connection
    """
    try:
        # Connect to MongoDB
        client = MongoClient(settings.MONGODB_URI)
        
        # Extract database name from connection string
        db_name = extract_db_name_from_uri(settings.MONGODB_URI)
        
        # Get database
        db = client[db_name]
        logger.debug(f"Connected to MongoDB database: {db_name}")
        
        yield db
    except Exception as e:
        logger.error(f"Failed to connect to MongoDB: {e}")
        raise
    finally:
        # Close connection
        if 'client' in locals():
            client.close()
            logger.debug("Closed MongoDB connection") 