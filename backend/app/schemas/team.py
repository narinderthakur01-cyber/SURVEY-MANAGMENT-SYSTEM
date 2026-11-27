import uuid
from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field
from app.schemas.user import UserRead


class TeamMemberRead(BaseModel):
    id: uuid.UUID
    team_id: uuid.UUID
    user_id: uuid.UUID
    joined_at: datetime
    user: UserRead | None = None

    model_config = ConfigDict(from_attributes=True)


class TeamBase(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    description: str | None = None
    supervisor_id: uuid.UUID | None = None


class TeamCreate(TeamBase):
    pass


class TeamUpdate(BaseModel):
    name: str | None = Field(None, min_length=2, max_length=100)
    description: str | None = None
    supervisor_id: uuid.UUID | None = None
    is_active: bool | None = None


class TeamMemberAdd(BaseModel):
    user_id: uuid.UUID


class TeamRead(TeamBase):
    id: uuid.UUID
    is_active: bool
    created_at: datetime
    updated_at: datetime
    supervisor: UserRead | None = None
    members: list[TeamMemberRead] = []

    model_config = ConfigDict(from_attributes=True)
