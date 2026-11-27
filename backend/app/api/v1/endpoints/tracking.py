import uuid
from typing import Annotated
from fastapi import APIRouter, Depends, status, Query
from sqlalchemy.orm import Session
from app.api.deps import get_db, get_current_user, require_admin, require_supervisor_or_admin
from app.models.user import User
from app.schemas.tracking import (
    TrackingSessionStart,
    TrackingSessionStop,
    WorkerLocationCreate,
    WorkerLocationRead,
    LiveWorkerLocationRead,
    TrackingSessionRead,
    TeamLocationSummary,
)
from app.services.tracking_service import TrackingService

router = APIRouter(prefix="/tracking", tags=["Field Tracking & Geolocation"])


@router.post("/sessions/start", response_model=TrackingSessionRead, status_code=status.HTTP_201_CREATED)
def start_tracking_session(
    start_in: TrackingSessionStart,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    """
    Start an authorized GPS tracking session for an active task.
    Explicit worker consent is strictly required.
    """
    return TrackingService.start_session(db, start_in, current_user)


@router.post("/sessions/{session_id}/stop", response_model=TrackingSessionRead)
def stop_tracking_session(
    session_id: uuid.UUID,
    stop_in: TrackingSessionStop,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    """
    Stop an active GPS tracking session.
    """
    return TrackingService.stop_session(db, session_id, stop_in, current_user)


@router.post("/locations", response_model=WorkerLocationRead, status_code=status.HTTP_201_CREATED)
def record_location_update(
    loc_in: WorkerLocationCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    """
    Record a live GPS coordinate point for the worker's active tracking session.
    Validates coordinate bounds and throttles bursts.
    """
    return TrackingService.record_location(db, loc_in, current_user)


@router.get("/live", response_model=list[LiveWorkerLocationRead])
def get_live_workforce_locations(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    team_id: uuid.UUID | None = Query(None),
):
    """
    Get latest live GPS locations of field workforce. Scoped by role:
    - ADMIN: All active field workers organization-wide.
    - SUPERVISOR: Workers in supervised teams only.
    - WORKER: Own live location only.
    """
    return TrackingService.get_live_locations(db, current_user, team_id=team_id)


@router.get("/workers/{worker_id}/history", response_model=list[WorkerLocationRead])
@router.get("/history/worker/{worker_id}", response_model=list[WorkerLocationRead])
def get_worker_location_history(
    worker_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    session_id: uuid.UUID | None = Query(None),
    limit: int = Query(200, ge=1, le=1000),
):
    """
    Get authorized location breadcrumbs / trail for a worker.
    - ADMIN: Any worker.
    - SUPERVISOR: Supervised team workers only.
    - WORKER: Own history only.
    """
    return TrackingService.get_worker_location_history(
        db, worker_id, current_user, session_id=session_id, limit=limit
    )


@router.get("/teams/{team_id}/summary", response_model=TeamLocationSummary)
def get_team_location_summary(
    team_id: uuid.UUID,
    current_user: Annotated[User, Depends(require_supervisor_or_admin)],
    db: Annotated[Session, Depends(get_db)],
):
    """
    Get live location overview for a specific team (Supervisor or Admin).
    """
    return TrackingService.get_team_summary(db, team_id, current_user)


@router.get("/sessions/{session_id}", response_model=TrackingSessionRead)
def get_session_details(
    session_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    """
    Get full tracking session details and trail points.
    """
    return TrackingService.get_session_details(db, session_id, current_user)


@router.post("/retention/cleanup")
@router.post("/prune")
def cleanup_retention_locations(
    _: Annotated[User, Depends(require_admin)],
    db: Annotated[Session, Depends(get_db)],
):
    """
    Trigger location-history retention policy pruning (Admin only).
    Removes location points older than LOCATION_RETENTION_DAYS.
    """
    deleted_count = TrackingService.cleanup_old_locations(db)
    return {
        "status": "success",
        "deleted_records": deleted_count,
        "retention_days": 30,
    }
