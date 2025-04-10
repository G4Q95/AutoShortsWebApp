import json
from datetime import datetime
from typing import Annotated, Any, ClassVar, Dict, List, Optional

from bson import ObjectId
from pydantic import BaseModel, ConfigDict, Field, field_validator


# MongoDB ObjectId custom Pydantic field for v2
class PyObjectId(str):
    """Custom type for handling MongoDB ObjectId in Pydantic models."""

    @classmethod
    def __get_validators__(cls):
        yield cls.validate

    @classmethod
    def validate(cls, v):
        if isinstance(v, ObjectId):
            return str(v)
        if not ObjectId.is_valid(v):
            raise ValueError("Invalid ObjectId")
        return str(v)

    @classmethod
    def __get_pydantic_core_schema__(cls, _source_type, _handler):
        """Used by Pydantic v2 for schema validation."""
        from pydantic_core import core_schema

        return core_schema.str_schema()

    @classmethod
    def __get_pydantic_json_schema__(cls, _schema, _handler):
        """Used by Pydantic v2 for OpenAPI schema generation."""
        return {"type": "string", "format": "objectid"}


# Scene model
class SceneBase(BaseModel):
    url: str
    title: Optional[str] = None
    text_content: Optional[str] = None
    media_url: Optional[str] = None
    media_type: Optional[str] = None  # image, video, gallery
    author: Optional[str] = None
    trim_start: Optional[float] = Field(0.0, description="Start time for trim in seconds")
    trim_end: Optional[float] = Field(None, description="End time for trim in seconds")

    model_config = ConfigDict(extra="allow", populate_by_name=True)


class SceneCreate(SceneBase):
    pass


class Scene(SceneBase):
    id: Optional[PyObjectId] = Field(default_factory=PyObjectId, alias="_id")

    model_config = ConfigDict(
        populate_by_name=True,
        arbitrary_types_allowed=True,
        json_encoders={ObjectId: str},
        extra="allow",
    )


# Project model
class ProjectBase(BaseModel):
    title: str
    description: Optional[str] = None
    user_id: Optional[str] = None

    model_config = ConfigDict(extra="allow", populate_by_name=True)


class ProjectCreate(ProjectBase):
    scenes: Optional[List[SceneBase]] = []


class Project(ProjectBase):
    id: Optional[PyObjectId] = Field(default_factory=PyObjectId, alias="_id")
    scenes: List[Scene] = []
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(
        populate_by_name=True,
        arbitrary_types_allowed=True,
        json_encoders={ObjectId: str, datetime: lambda dt: dt.isoformat()},
        extra="allow",
    )


# Project response model - simplified for API responses
class ProjectResponse(BaseModel):
    id: str
    title: str
    description: Optional[str] = None
    user_id: Optional[str] = None
    scenes: List[Dict[str, Any]] = []
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    # Allow extra fields
    model_config = ConfigDict(
        populate_by_name=True,
        from_attributes=True,
        extra="allow",
        json_encoders={ObjectId: str, datetime: lambda dt: dt.isoformat()},
    )
