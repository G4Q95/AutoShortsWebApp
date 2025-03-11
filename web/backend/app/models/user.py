from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, EmailStr, Field


class UserBase(BaseModel):
    email: EmailStr
    name: str


class UserCreate(UserBase):
    pass


class UserUpdate(BaseModel):
    name: Optional[str] = None
    subscription_tier: Optional[str] = None


class UserInDB(UserBase):
    id: str = Field(alias="_id")
    created_at: datetime
    updated_at: datetime
    subscription_tier: str = "free"  # free, premium, pro
    videos_generated_this_month: int = 0
    subscription_renews_at: Optional[datetime] = None


class User(UserInDB):
    class Config:
        from_attributes = True
