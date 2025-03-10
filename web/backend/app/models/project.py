from pydantic import BaseModel, Field, field_validator
from typing import List, Optional, Any, ClassVar, Dict
from datetime import datetime
from bson import ObjectId
import json

# MongoDB ObjectId custom Pydantic field
class PyObjectId(ObjectId):
    @classmethod
    def __get_validators__(cls):
        yield cls.validate

    @classmethod
    def validate(cls, v):
        if not ObjectId.is_valid(v):
            raise ValueError("Invalid ObjectId")
        return ObjectId(v)

    @classmethod
    def __get_pydantic_json_schema__(cls, _schema_generator):
        return {"type": "string"}

# Scene model
class SceneBase(BaseModel):
    url: str
    title: Optional[str] = None
    text_content: Optional[str] = None
    media_url: Optional[str] = None
    media_type: Optional[str] = None  # image, video, gallery
    author: Optional[str] = None

class SceneCreate(SceneBase):
    pass

class Scene(SceneBase):
    id: PyObjectId = Field(default_factory=PyObjectId, alias="_id")
    
    model_config: ClassVar[dict] = {
        "populate_by_name": True,
        "arbitrary_types_allowed": True,
        "json_encoders": {ObjectId: str}
    }

# Project model
class ProjectBase(BaseModel):
    title: str
    description: Optional[str] = None
    user_id: Optional[str] = None

class ProjectCreate(ProjectBase):
    scenes: Optional[List[SceneBase]] = []

class Project(ProjectBase):
    id: PyObjectId = Field(default_factory=PyObjectId, alias="_id")
    scenes: List[Scene] = []
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: Optional[datetime] = None
    
    model_config: ClassVar[dict] = {
        "populate_by_name": True,
        "arbitrary_types_allowed": True,
        "json_encoders": {ObjectId: str, datetime: lambda dt: dt.isoformat()}
    }

# Project response model - simplified to accept any fields
class ProjectResponse(BaseModel):
    id: str
    title: str
    description: Optional[str] = None
    user_id: Optional[str] = None
    scenes: Optional[List[Dict[str, Any]]] = []
    
    # Allow extra fields
    model_config: ClassVar[dict] = {
        "populate_by_name": True,
        "from_attributes": True,
        "extra": "allow"
    } 