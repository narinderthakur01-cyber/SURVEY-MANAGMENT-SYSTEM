import uuid
from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field


class TrackingSessionStart(BaseModel):
    task_id: uuid.UUID
    consent_granted: bool = Field(..., description="Worker must explicitly give consent")
    device_info: str | None = None


class TrackingSessionStop(BaseModel):
    termination_reason: str | None = Field("WORKER_STOPPED", max_length=100)


class WorkerLocationCreate(BaseModel):
    session_id: uuid.UUID
    latitude: float = Field(..., ge=-90.0, le=90.0, description="Valid latitude between -90 and 90")
    longitude: float = Field(..., ge=-180.0, le=180.0, description="Valid longitude between -180 and 180")
    accuracy: float = Field(..., ge=0.0, description="GPS accuracy radius in meters")
    speed: float | None = Field(None, ge=0.0, description="Speed in m/s")
    heading: float | None = Field(None, ge=0.0, le=360.0, description="Heading in degrees (0-360)")
    recorded_at: datetime | None = None


class WorkerLocationRead(BaseModel):
    id: uuid.UUID
    session_id: uuid.UUID
    worker_id: uuid.UUID
    worker_name: str | None = None
    task_id: uuid.UUID
    task_title: str | None = None
    latitude: float
    longitude: float
    accuracy: float
    speed: float | None = None
    heading: float | None = None
    recorded_at: datetime

    model_config = ConfigDict(from_attributes=True)


class LiveWorkerLocationRead(BaseModel):
    worker_id: uuid.UUID
    worker_name: str
    worker_email: str
    session_id: uuid.UUID
    session_status: str
    task_id: uuid.UUID
    task_title: str
    team_id: uuid.UUID | None = None
    team_name: str | None = None
    latitude: float
    longitude: float
    accuracy: float
    speed: float | None = None
    heading: float | None = None
    last_updated: datetime
    is_stale: bool = False

    model_config = ConfigDict(from_attributes=True)


class TrackingSessionRead(BaseModel):
    id: uuid.UUID
    worker_id: uuid.UUID
    worker_name: str | None = None
    task_id: uuid.UUID
    task_title: str | None = None
    status: str
    consent_granted: bool
    started_at: datetime
    ended_at: datetime | None = None
    termination_reason: str | None = None
    device_info: str | None = None
    breadcrumbs_count: int = 0
    locations: list[WorkerLocationRead] = []

    model_config = ConfigDict(from_attributes=True)


class TeamLocationSummary(BaseModel):
    team_id: uuid.UUID
    team_name: str
    active_workers_count: int
    workers: list[LiveWorkerLocationRead] = []
