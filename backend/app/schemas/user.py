import uuid
from datetime import datetime
from pydantic import BaseModel, EmailStr, ConfigDict, Field
from app.schemas.role import RoleRead


class UserBase(BaseModel):
    email: EmailStr
    full_name: str = Field(..., min_length=2, max_length=150)
    phone_number: str | None = None


class UserCreate(UserBase):
    password: str = Field(..., min_length=8, max_length=128)
    role_id: uuid.UUID


class UserUpdate(BaseModel):
    full_name: str | None = Field(None, min_length=2, max_length=150)
    phone_number: str | None = None
    role_id: uuid.UUID | None = None


class UserStatusUpdate(BaseModel):
    is_active: bool


class UserRead(UserBase):
    id: uuid.UUID
    role_id: uuid.UUID
    role: RoleRead | None = None
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
