"""
MongoDB database connection utilities.
"""

import logging
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

from app.core.database import db

# Set up logging
logger = logging.getLogger(__name__)

async def get_database() -> AsyncIOMotorDatabase:
    """
    Get a reference to the MongoDB database.
    Uses the existing db connection from core.database.
    
    Returns:
        AsyncIOMotorDatabase: Database connection
    """
    return db.get_db() 