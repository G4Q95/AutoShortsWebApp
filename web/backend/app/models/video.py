from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field, HttpUrl

class VideoBase(BaseModel):
    title: str
    source_url: HttpUrl
    user_id: str
    
class VideoCreate(VideoBase):
    pass

class VideoUpdate(BaseModel):
    title: Optional[str] = None
    status: Optional[str] = None

class VideoInDB(VideoBase):
    id: str = Field(alias="_id")
    created_at: datetime
    updated_at: datetime
    status: str = "pending"  # pending, processing, completed, failed
    storage_url: Optional[str] = None
    duration_seconds: Optional[float] = None
    character_count: Optional[int] = None
    expires_at: Optional[datetime] = None
    voice_id: Optional[str] = None
    
class Video(VideoInDB):
    class Config:
        from_attributes = True 