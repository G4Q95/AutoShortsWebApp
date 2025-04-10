"""
Authentication utilities for the Auto Shorts API.
"""

import logging
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from typing import Optional

from app.models.user import User
from app.core.database import db

# Set up logging
logger = logging.getLogger(__name__)

# OAuth2 scheme for token authentication
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/users/token")

async def get_current_user(token: str = Depends(oauth2_scheme)) -> User:
    """
    Dependency to get the current authenticated user.
    
    Args:
        token: OAuth2 token from the request
        
    Returns:
        User model with user information
        
    Raises:
        HTTPException: If authentication fails
    """
    try:
        # For now, return a mock user since we haven't implemented full auth yet
        # In a real implementation, you would verify the token and get the user from the database
        
        # This is just a temporary solution for development
        mock_user = User(
            id="user_123456",
            email="user@example.com",
            is_active=True,
            is_superuser=False
        )
        
        return mock_user
        
        # TODO: Implement real authentication when ready
        # The real implementation would look something like:
        # - Verify token validity
        # - Decode token to get user ID
        # - Fetch user from database
        # - Return user if valid, raise exception if not
        
    except Exception as e:
        logger.error(f"Authentication error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        ) 