import uuid
from typing import Annotated
from fastapi import APIRouter, Depends, status, Query
from sqlalchemy.orm import Session
from app.api.deps import get_db, get_current_user, require_supervisor_or_admin
from app.models.user import User
from app.schemas.task import (
    TaskCreate,
    TaskAssign,
    TaskReject,
    TaskComplete,
    TaskAssistanceCreate,
    TaskAssistanceResolve,
    TaskIssueCreate,
    TaskIssueResolve,
    TaskRead,
)
from app.services.task_service import TaskService

router = APIRouter(prefix="/tasks", tags=["Workforce Tasks"])


@router.post("", response_model=TaskRead, status_code=status.HTTP_201_CREATED)
def create_task(
    task_in: TaskCreate,
    current_user: Annotated[User, Depends(require_supervisor_or_admin)],
    db: Annotated[Session, Depends(get_db)],
):
    """
    Create a new survey task linked to a published survey version (Admin or Supervisor).
    """
    return TaskService.create_task(db, task_in, current_user)


@router.get("", response_model=list[TaskRead])
def list_tasks(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    team_id: uuid.UUID | None = Query(None),
    worker_id: uuid.UUID | None = Query(None),
    status_filter: str | None = Query(None, alias="status"),
):
    """
    List tasks scoped strictly by user role:
    - ADMIN: All tasks organization-wide.
    - SUPERVISOR: Only tasks belonging to their supervised teams.
    - WORKER: Only tasks assigned to this worker.
    """
    return TaskService.list_tasks(
        db, current_user, team_id=team_id, worker_id=worker_id, status_filter=status_filter
    )


@router.get("/{task_id}", response_model=TaskRead)
def get_task(
    task_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    """
    Get detailed information about a task. Access is enforced by role.
    """
    return TaskService.get_task(db, task_id, current_user)


@router.post("/{task_id}/assign", response_model=TaskRead)
def assign_worker(
    task_id: uuid.UUID,
    assign_in: TaskAssign,
    current_user: Annotated[User, Depends(require_supervisor_or_admin)],
    db: Annotated[Session, Depends(get_db)],
):
    """
    Assign or reassign a field worker to a task (Admin or Supervisor).
    """
    return TaskService.assign_worker(db, task_id, assign_in, current_user)


@router.post("/{task_id}/accept", response_model=TaskRead)
def accept_task(
    task_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    """
    Worker accepts an assigned task (Status: ASSIGNED -> ACCEPTED).
    """
    return TaskService.accept_task(db, task_id, current_user)


@router.post("/{task_id}/reject", response_model=TaskRead)
def reject_task(
    task_id: uuid.UUID,
    reject_in: TaskReject,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    """
    Worker rejects an assigned task with a required reason.
    """
    return TaskService.reject_task(db, task_id, reject_in, current_user)


@router.post("/{task_id}/start", response_model=TaskRead)
def start_task(
    task_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    """
    Worker starts survey execution on an accepted task (Status: ACCEPTED -> IN_PROGRESS).
    """
    return TaskService.start_task(db, task_id, current_user)


@router.post("/{task_id}/complete", response_model=TaskRead)
def complete_task(
    task_id: uuid.UUID,
    complete_in: TaskComplete,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    """
    Worker completes the survey and submits response data (Status: IN_PROGRESS -> COMPLETED).
    """
    return TaskService.complete_task(db, task_id, complete_in, current_user)


@router.post("/{task_id}/cancel", response_model=TaskRead)
def cancel_task(
    task_id: uuid.UUID,
    current_user: Annotated[User, Depends(require_supervisor_or_admin)],
    db: Annotated[Session, Depends(get_db)],
):
    """
    Admin or Supervisor cancels a task.
    """
    return TaskService.cancel_task(db, task_id, current_user)


@router.post("/{task_id}/assistance", response_model=TaskRead)
def request_assistance(
    task_id: uuid.UUID,
    req_in: TaskAssistanceCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    """
    Worker requests assistance for their assigned task.
    """
    return TaskService.request_assistance(db, task_id, req_in, current_user)


@router.post("/{task_id}/assistance/{request_id}/resolve", response_model=TaskRead)
def resolve_assistance(
    task_id: uuid.UUID,
    request_id: uuid.UUID,
    res_in: TaskAssistanceResolve,
    current_user: Annotated[User, Depends(require_supervisor_or_admin)],
    db: Annotated[Session, Depends(get_db)],
):
    """
    Supervisor or Admin responds to and resolves a worker's assistance request.
    """
    return TaskService.resolve_assistance(db, task_id, request_id, res_in, current_user)


@router.post("/{task_id}/issues", response_model=TaskRead)
def report_issue(
    task_id: uuid.UUID,
    issue_in: TaskIssueCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    """
    Report an issue on a task.
    """
    return TaskService.report_issue(db, task_id, issue_in, current_user)


@router.post("/{task_id}/issues/{issue_id}/resolve", response_model=TaskRead)
def resolve_issue(
    task_id: uuid.UUID,
    issue_id: uuid.UUID,
    res_in: TaskIssueResolve,
    current_user: Annotated[User, Depends(require_supervisor_or_admin)],
    db: Annotated[Session, Depends(get_db)],
):
    """
    Supervisor or Admin resolves a reported task issue.
    """
    return TaskService.resolve_issue(db, task_id, issue_id, res_in, current_user)
