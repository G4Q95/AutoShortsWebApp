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


# Common error response codes
class ErrorCodes:
    """Common error codes for standardized responses."""
    # Resource errors
    RESOURCE_NOT_FOUND = "resource_not_found"
    RESOURCE_ALREADY_EXISTS = "resource_already_exists"
    RESOURCE_CONFLICT = "resource_conflict"
    
    # Validation errors
    VALIDATION_ERROR = "validation_error"
    INVALID_PARAMETERS = "invalid_parameters"
    MISSING_PARAMETERS = "missing_parameters"
    
    # Authentication errors
    AUTH_REQUIRED = "authentication_required"
    AUTH_FAILED = "authentication_failed"
    AUTH_EXPIRED = "authentication_expired"
    AUTH_INVALID = "invalid_authentication"
    
    # Authorization errors
    PERMISSION_DENIED = "permission_denied"
    ACCESS_FORBIDDEN = "access_forbidden"
    
    # Action errors
    ACTION_FAILED = "action_failed"
    ACTION_LIMIT_REACHED = "action_limit_reached"
    ACTION_NOT_ALLOWED = "action_not_allowed"
    
    # Integration errors
    INTEGRATION_ERROR = "integration_error"
    API_ERROR = "api_error"
    EXTERNAL_SERVICE_ERROR = "external_service_error"
    
    # Database errors
    DATABASE_ERROR = "database_error"
    DATABASE_CONNECTION_ERROR = "database_connection_error"
    DATABASE_QUERY_ERROR = "database_query_error"
    
    # Media processing errors
    MEDIA_PROCESSING_ERROR = "media_processing_error"
    MEDIA_NOT_SUPPORTED = "media_not_supported"
    MEDIA_TOO_LARGE = "media_too_large"
    
    # Content errors
    CONTENT_EXTRACTION_ERROR = "content_extraction_error"
    CONTENT_NOT_FOUND = "content_not_found"
    CONTENT_PROCESSING_ERROR = "content_processing_error"
    
    # System errors
    SYSTEM_ERROR = "system_error"
    INTERNAL_SERVER_ERROR = "internal_server_error"
    SERVICE_UNAVAILABLE = "service_unavailable"
    TIMEOUT_ERROR = "timeout_error"
    RATE_LIMIT_EXCEEDED = "rate_limit_exceeded"


class NotFoundError(HTTPException):
    """Resource not found error."""
    def __init__(self, resource_type: str, resource_id: str):
        super().__init__(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=create_error_response(
                status_code=status.HTTP_404_NOT_FOUND,
                message=f"{resource_type} with id {resource_id} not found",
                error_code=ErrorCodes.RESOURCE_NOT_FOUND,
            ),
        )


class ValidationError(HTTPException):
    """Validation error."""
    def __init__(
        self, 
        message: str, 
        details: Optional[List[Dict[str, Any]]] = None,
        error_code: str = ErrorCodes.VALIDATION_ERROR
    ):
        super().__init__(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=create_error_response(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                message=message,
                details=details,
                error_code=error_code,
            ),
        )


class DatabaseError(HTTPException):
    """Database operation error."""
    def __init__(self, message: str, error_code: str = ErrorCodes.DATABASE_ERROR):
        super().__init__(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=create_error_response(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                message=f"Database error: {message}",
                error_code=error_code,
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
                error_code=ErrorCodes.CONTENT_EXTRACTION_ERROR,
            ),
        )


class AuthenticationError(HTTPException):
    """Authentication error."""
    def __init__(self, message: str, error_code: str = ErrorCodes.AUTH_REQUIRED):
        super().__init__(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=create_error_response(
                status_code=status.HTTP_401_UNAUTHORIZED,
                message=message,
                error_code=error_code,
            ),
        )


class PermissionDeniedError(HTTPException):
    """Permission denied error."""
    def __init__(self, message: str = "You don't have permission to perform this action"):
        super().__init__(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=create_error_response(
                status_code=status.HTTP_403_FORBIDDEN,
                message=message,
                error_code=ErrorCodes.PERMISSION_DENIED,
            ),
        )


class ResourceConflictError(HTTPException):
    """Resource conflict error."""
    def __init__(self, message: str):
        super().__init__(
            status_code=status.HTTP_409_CONFLICT,
            detail=create_error_response(
                status_code=status.HTTP_409_CONFLICT,
                message=message,
                error_code=ErrorCodes.RESOURCE_CONFLICT,
            ),
        )


class ExternalServiceError(HTTPException):
    """External service error."""
    def __init__(self, service_name: str, message: str):
        super().__init__(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=create_error_response(
                status_code=status.HTTP_502_BAD_GATEWAY,
                message=f"{service_name} service error: {message}",
                error_code=ErrorCodes.EXTERNAL_SERVICE_ERROR,
            ),
        )


class RateLimitExceededError(HTTPException):
    """Rate limit exceeded error."""
    def __init__(self, message: str = "Rate limit exceeded. Please try again later."):
        super().__init__(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=create_error_response(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                message=message,
                error_code=ErrorCodes.RATE_LIMIT_EXCEEDED,
            ),
        )


class MediaProcessingError(HTTPException):
    """Media processing error."""
    def __init__(self, message: str):
        super().__init__(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=create_error_response(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                message=message,
                error_code=ErrorCodes.MEDIA_PROCESSING_ERROR,
            ),
        ) 