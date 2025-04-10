from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, EmailStr, Field


class UserBase(BaseModel):
    email: EmailStr
    name: Optional[str] = None
    is_active: Optional[bool] = True
    is_superuser: Optional[bool] = False


class UserCreate(UserBase):
    password: str


class UserUpdate(BaseModel):
    name: Optional[str] = None
    subscription_tier: Optional[str] = None


class UserInDB(UserBase):
    id: Optional[str] = None 
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    subscription_tier: str = "free"  # free, premium, pro
    videos_generated_this_month: int = 0
    subscription_renews_at: Optional[datetime] = None
    hashed_password: Optional[str] = None


class User(UserInDB):
    class Config:
        from_attributes = True
        
    # Constructor to facilitate creating user instances with custom ID
    def __init__(self, **data):
        # Handle both direct ID and MongoDB style _id
        if "_id" in data and "id" not in data:
            data["id"] = data.pop("_id")
        super().__init__(**data)
