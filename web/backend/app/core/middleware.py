"""
Middleware to ensure consistent API responses and handle exceptions.
"""

import json
from typing import Callable, Dict, Any

from fastapi import Request, Response, status
from fastapi.responses import JSONResponse, StreamingResponse
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp

from app.core.errors import create_error_response, ErrorCodes


class ApiResponseMiddleware(BaseHTTPMiddleware):
    """
    Middleware to ensure all API responses follow the standard format.
    
    This middleware intercepts responses and applies the following rules:
    1. Binary/streaming responses are passed through unchanged
    2. JSON responses that are not already in the standard format are wrapped
    3. Error responses are standardized
    
    This provides a consistent API response format without having to modify 
    each endpoint individually.
    """
    
    def __init__(self, app: ASGIApp, exclude_paths: list = None):
        """
        Initialize the middleware.
        
        Args:
            app: The ASGI application
            exclude_paths: List of paths to exclude from standardization
        """
        super().__init__(app)
        # Default paths to exclude from API standardization
        self.exclude_paths = exclude_paths or [
            "/docs",
            "/redoc",
            "/openapi.json",
        ]
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """
        Process a request and response through the middleware.
        
        Args:
            request: The request
            call_next: The next middleware or endpoint handler
            
        Returns:
            The processed response
        """
        # Get the current path
        current_path = request.url.path
        
        # Skip standardization for:
        # 1. Proxy endpoints that return binary/streaming data
        if "/proxy/" in current_path:
            return await call_next(request)
        
        # 2. Documentation and excluded paths
        if any(current_path.startswith(path) for path in self.exclude_paths):
            return await call_next(request)
        
        # 3. Content extraction requests if they're not GET requests
        # This allows GET requests to be standardized but passes other methods through
        if "/content/extract" in current_path and request.method != "GET":
            return await call_next(request)
        
        # Process the request
        try:
            response = await call_next(request)
            
            # Don't modify streaming responses
            if isinstance(response, StreamingResponse):
                return response
                
            # Don't modify non-JSON responses
            if not isinstance(response, JSONResponse):
                return response
            
            # If this is already a standard API response, don't modify it
            try:
                body = json.loads(response.body.decode())
                if isinstance(body, dict) and "success" in body and "timestamp" in body:
                    # Already standardized, return as is
                    return response
            except (json.JSONDecodeError, UnicodeDecodeError):
                # Not valid JSON, return as is
                return response
            
            # Wrap the JSON response in the standard format
            # Only do this for 2xx status codes
            if 200 <= response.status_code < 300:
                status_message = "OK"
                if response.status_code == status.HTTP_201_CREATED:
                    status_message = "Created"
                elif response.status_code == status.HTTP_204_NO_CONTENT:
                    status_message = "No Content"
                
                # Create a standardized response
                standardized_content = {
                    "success": True,
                    "message": status_message,
                    "data": body,
                    "timestamp": None  # This will be filled by the Pydantic model
                }
                
                return JSONResponse(
                    content=standardized_content,
                    status_code=response.status_code,
                    headers=dict(response.headers)
                )
            
            return response
            
        except Exception as e:
            # Create a standardized error response
            error_response = create_error_response(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                message=f"An unexpected error occurred: {str(e)}",
                error_code=ErrorCodes.INTERNAL_SERVER_ERROR
            )
            
            return JSONResponse(
                content=error_response,
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR
            ) 