from datetime import datetime
from typing import Optional, List, Dict, Any

from bson import ObjectId
from pydantic import BaseModel, ConfigDict, Field

from app.models.project import PyObjectId


class R2FilePathBase(BaseModel):
    """Base model for tracking R2 file paths"""
    project_id: str
    object_key: str
    scene_id: Optional[str] = None
    file_type: Optional[str] = None
    user_id: Optional[str] = None
    size_bytes: Optional[int] = None
    content_type: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None

    model_config = ConfigDict(extra="allow", populate_by_name=True)


class R2FilePathCreate(R2FilePathBase):
    """Model for creating a new R2 file path record"""
    pass


class R2FilePath(R2FilePathBase):
    """Model for a R2 file path record with ID and timestamps"""
    id: Optional[PyObjectId] = Field(default_factory=PyObjectId, alias="_id")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(
        populate_by_name=True,
        arbitrary_types_allowed=True,
        json_encoders={ObjectId: str, datetime: lambda dt: dt.isoformat()},
        extra="allow",
    )


class R2FilePathResponse(BaseModel):
    """Model for R2 file path responses"""
    id: str
    project_id: str
    object_key: str
    scene_id: Optional[str] = None
    file_type: Optional[str] = None
    user_id: Optional[str] = None
    size_bytes: Optional[int] = None
    content_type: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(
        populate_by_name=True,
        from_attributes=True,
        extra="allow",
        json_encoders={ObjectId: str, datetime: lambda dt: dt.isoformat()},
    ) 