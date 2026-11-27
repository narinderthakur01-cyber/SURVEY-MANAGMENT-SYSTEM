import uuid
from datetime import datetime
from typing import Any
from pydantic import BaseModel, ConfigDict, Field
from app.models.task import TaskStatus, TaskPriority


# --- Assignment History ---
class TaskAssignmentRead(BaseModel):
    id: uuid.UUID
    task_id: uuid.UUID
    worker_id: uuid.UUID
    worker_name: str | None = None
    assigned_by_id: uuid.UUID
    assigned_by_name: str | None = None
    assigned_at: datetime
    status: str
    rejection_reason: str | None = None
    notes: str | None = None

    model_config = ConfigDict(from_attributes=True)


# --- Worker Assistance Requests ---
class TaskAssistanceCreate(BaseModel):
    message: str = Field(..., min_length=2)


class TaskAssistanceResolve(BaseModel):
    supervisor_response: str = Field(..., min_length=2)


class TaskAssistanceRead(BaseModel):
    id: uuid.UUID
    task_id: uuid.UUID
    worker_id: uuid.UUID
    worker_name: str | None = None
    message: str
    status: str
    supervisor_response: str | None = None
    resolved_by_id: uuid.UUID | None = None
    resolved_by_name: str | None = None
    created_at: datetime
    resolved_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


# --- Task Issues ---
class TaskIssueCreate(BaseModel):
    issue_type: str = Field(..., min_length=2, max_length=50)
    description: str = Field(..., min_length=2)


class TaskIssueResolve(BaseModel):
    resolution_notes: str = Field(..., min_length=2)


class TaskIssueRead(BaseModel):
    id: uuid.UUID
    task_id: uuid.UUID
    reported_by_id: uuid.UUID
    reported_by_name: str | None = None
    issue_type: str
    description: str
    status: str
    resolution_notes: str | None = None
    created_at: datetime
    resolved_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


# --- Task Base & Operations ---
class TaskBase(BaseModel):
    title: str = Field(..., min_length=2, max_length=200)
    description: str | None = None
    priority: TaskPriority = TaskPriority.MEDIUM
    due_date: datetime | None = None
    location_name: str | None = None
    target_latitude: float | None = None
    target_longitude: float | None = None


class TaskCreate(TaskBase):
    survey_version_id: uuid.UUID
    team_id: uuid.UUID | None = None
    assigned_worker_id: uuid.UUID | None = None


class TaskUpdate(BaseModel):
    title: str | None = Field(None, min_length=2, max_length=200)
    description: str | None = None
    priority: TaskPriority | None = None
    due_date: datetime | None = None
    location_name: str | None = None
    target_latitude: float | None = None
    target_longitude: float | None = None


class TaskAssign(BaseModel):
    worker_id: uuid.UUID
    notes: str | None = None


class TaskReject(BaseModel):
    rejection_reason: str = Field(..., min_length=2)


class TaskComplete(BaseModel):
    survey_response_data: dict[str, Any]
    completion_notes: str | None = None


class TaskRead(TaskBase):
    id: uuid.UUID
    survey_version_id: uuid.UUID
    survey_title: str | None = None
    version_number: int | None = None
    team_id: uuid.UUID | None = None
    team_name: str | None = None
    assigned_worker_id: uuid.UUID | None = None
    assigned_worker_name: str | None = None
    created_by_id: uuid.UUID
    creator_name: str | None = None
    status: TaskStatus
    created_at: datetime
    assigned_at: datetime | None = None
    accepted_at: datetime | None = None
    started_at: datetime | None = None
    completed_at: datetime | None = None
    cancelled_at: datetime | None = None
    rejection_reason: str | None = None
    completion_notes: str | None = None
    survey_response_data: dict[str, Any] | None = None
    updated_at: datetime
    assignment_history: list[TaskAssignmentRead] = []
    assistance_requests: list[TaskAssistanceRead] = []
    issues: list[TaskIssueRead] = []

    model_config = ConfigDict(from_attributes=True)


class TaskSummaryMetrics(BaseModel):
    total: int
    pending: int
    assigned: int
    accepted: int
    in_progress: int
    completed: int
    rejected: int
    cancelled: int
