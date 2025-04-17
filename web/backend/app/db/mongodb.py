import logging
from typing import Dict, Optional, Any, Iterator, ContextManager, Generator
from contextlib import contextmanager
from urllib.parse import urlparse

from pymongo import MongoClient
from pymongo.database import Database

from app.core.config import settings

# Configure logging
logger = logging.getLogger(__name__)

# Type alias for database sessions
DatabaseSession = Iterator[Database]

def extract_db_name_from_uri(uri: str) -> str:
    """
    Extract database name from MongoDB URI.
    
    Args:
        uri: MongoDB URI
        
    Returns:
        Database name
    """
    # For MongoDB Atlas, if no specific database is specified, use 'autoshortsdb'
    default_db_name = "autoshortsdb"
    
    if "mongodb+srv" in uri:
        # Parse the URI
        parsed_uri = urlparse(uri)
        path = parsed_uri.path
        
        # Extract database name from path or use default
        if path and path != "/" and len(path) > 1:
            db_name = path.strip("/")
        else:
            # Default database name for Atlas if not specified
            db_name = default_db_name
            logger.info(f"No database specified in MongoDB URI, using default: {db_name}")
    else:
        # Standard mongodb:// URI
        parsed_uri = urlparse(uri)
        path = parsed_uri.path
        
        # Extract database name or use default
        if path and path != "/" and len(path) > 1:
            db_name = path.strip("/")
        else:
            db_name = default_db_name
            logger.info(f"No database specified in MongoDB URI, using default: {db_name}")
    
    return db_name

def get_database() -> Database:
    """
    Get a MongoDB database connection.
    
    Returns:
        Database: MongoDB database connection
        
    Note: This doesn't automatically close the connection. For automatic cleanup,
    use get_db() from session.py or the get_database_session context manager.
    """
    try:
        # Connect to MongoDB
        client = MongoClient(settings.MONGODB_URI)
        
        # Extract database name from connection string
        db_name = extract_db_name_from_uri(settings.MONGODB_URI)
        
        # Get database
        db = client[db_name]
        logger.debug(f"Connected to MongoDB database: {db_name}")
        return db
    except Exception as e:
        logger.error(f"Failed to connect to MongoDB: {e}")
        raise

@contextmanager
def get_database_session() -> Generator[Database, None, None]:
    """
    Context manager for MongoDB database connection.
    Ensures connection is properly closed after use.
    
    Yields:
        Database: MongoDB database connection
    """
    client = None
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
        if client:
            client.close()
            logger.debug("Closed MongoDB connection")

def get_test_database() -> Database:
    """
    Get a test MongoDB database connection.
    Used for testing purposes.
    
    Returns:
        Database: MongoDB test database connection
    """
    try:
        # Connect to MongoDB with test database name
        client = MongoClient(settings.MONGODB_URI)
        # Use test database
        db = client["auto-shorts-test"]
        logger.debug("Connected to MongoDB test database")
        return db
    except Exception as e:
        logger.error(f"Failed to connect to MongoDB test database: {e}")
        raise 