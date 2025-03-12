from datetime import datetime
from typing import Any, Dict, Generic, List, Optional, TypeVar, Union

from pydantic import BaseModel, ConfigDict, Field

T = TypeVar('T')

class ApiResponse(BaseModel, Generic[T]):
    """Base model for all API responses"""
    success: bool = True
    message: Optional[str] = None
    data: Optional[T] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)

    model_config = ConfigDict(
        json_encoders={datetime: lambda dt: dt.isoformat()},
        extra="allow"
    )

class ContentExtractionResponse(BaseModel):
    """Model for content extraction response data"""
    title: str
    text: str
    media_url: Optional[str] = None
    media_type: Optional[str] = None
    author: Optional[str] = None
    platform: Optional[str] = None
    subreddit: Optional[str] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)

class UrlPreviewResponse(BaseModel):
    """Model for URL preview response data"""
    title: str
    description: str
    thumbnail: Optional[str] = None
    author: Optional[str] = None
    subreddit: Optional[str] = None
    platform: str = "unknown"

# Example usage:
# ApiResponse[ContentExtractionResponse]
# ApiResponse[UrlPreviewResponse]
# ApiResponse[List[Dict[str, Any]]] 