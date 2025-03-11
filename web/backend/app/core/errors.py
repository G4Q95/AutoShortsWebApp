"""
Error handling utilities and standardized error responses.
"""

from typing import Any, Dict, List, Optional, Union

from fastapi import HTTPException, status
from pydantic import BaseModel


class ErrorDetail(BaseModel):
    """Detailed error information."""
    loc: Optional[List[str]] = None  # Location of error (e.g., ["body", "field_name"])
    msg: str  # Error message
    type: str  # Error type (e.g., "value_error", "auth_error", "not_found", etc.)


class ErrorResponse(BaseModel):
    """Standardized error response model."""
    status_code: int
    message: str
    details: Optional[List[ErrorDetail]] = None
    error_code: Optional[str] = None  # Optional error code for client-side handling


def create_error_response(
    status_code: int,
    message: str,
    details: Optional[List[Dict[str, Any]]] = None,
    error_code: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Create a standardized error response dictionary.
    
    Args:
        status_code: HTTP status code
        message: Error message
        details: List of error details
        error_code: Optional error code for client-side handling
        
    Returns:
        Standardized error response dictionary
    """
    error_details = None
    if details:
        error_details = [ErrorDetail(**detail) for detail in details]
    
    return ErrorResponse(
        status_code=status_code,
        message=message,
        details=error_details,
        error_code=error_code,
    ).dict()


class NotFoundError(HTTPException):
    """Resource not found error."""
    def __init__(self, resource_type: str, resource_id: str):
        super().__init__(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=create_error_response(
                status_code=status.HTTP_404_NOT_FOUND,
                message=f"{resource_type} with id {resource_id} not found",
                error_code="resource_not_found",
            ),
        )


class ValidationError(HTTPException):
    """Validation error."""
    def __init__(
        self, 
        message: str, 
        details: Optional[List[Dict[str, Any]]] = None
    ):
        super().__init__(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=create_error_response(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                message=message,
                details=details,
                error_code="validation_error",
            ),
        )


class DatabaseError(HTTPException):
    """Database operation error."""
    def __init__(self, message: str):
        super().__init__(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=create_error_response(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                message=f"Database error: {message}",
                error_code="database_error",
            ),
        )


class ContentExtractionError(HTTPException):
    """Content extraction error."""
    def __init__(self, message: str):
        super().__init__(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=create_error_response(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                message=message,
                error_code="content_extraction_error",
            ),
        ) 