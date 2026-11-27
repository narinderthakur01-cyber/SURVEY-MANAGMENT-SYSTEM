import uuid
from datetime import datetime, timezone, timedelta
from fastapi import HTTPException, status
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import desc
from app.models.tracking import (
    TrackingSession,
    WorkerLocation,
    TrackingSessionStatus,
)
from app.models.task import Task, TaskStatus
from app.models.team import Team
from app.models.team_member import TeamMember
from app.models.user import User
from app.core.config import settings
from app.schemas.tracking import (
    TrackingSessionStart,
    TrackingSessionStop,
    WorkerLocationCreate,
    WorkerLocationRead,
    LiveWorkerLocationRead,
    TrackingSessionRead,
    TeamLocationSummary,
)


class TrackingService:
    @staticmethod
    def start_session(
        db: Session, start_in: TrackingSessionStart, current_user: User
    ) -> TrackingSessionRead:
        """
        Start an authorized tracking session for an active task.
        Consent is strictly required.
        """
        # 1. Explicit Consent Check
        if not start_in.consent_granted:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Worker consent is strictly required to enable location tracking",
            )

        # 2. Task Validation
        task = db.query(Task).filter(Task.id == start_in.task_id).first()
        if not task:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")

        # Worker Ownership Check: Worker can only track for tasks assigned to them
        if task.assigned_worker_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Cannot start a tracking session for a task not assigned to you",
            )

        # Task Status Check: Task must be active
        if task.status not in [TaskStatus.ACCEPTED.value, TaskStatus.IN_PROGRESS.value]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot start tracking on a task in '{task.status}' status (must be ACCEPTED or IN_PROGRESS)",
            )

        now = datetime.now(timezone.utc)

        # 3. Check for existing active session on this task (Idempotent)
        existing_session = (
            db.query(TrackingSession)
            .filter(
                TrackingSession.worker_id == current_user.id,
                TrackingSession.task_id == task.id,
                TrackingSession.status == TrackingSessionStatus.ACTIVE.value,
            )
            .first()
        )
        if existing_session:
            return TrackingService._to_session_dto(existing_session)

        # Terminate any other active sessions of this worker
        other_active = (
            db.query(TrackingSession)
            .filter(
                TrackingSession.worker_id == current_user.id,
                TrackingSession.status == TrackingSessionStatus.ACTIVE.value,
            )
            .all()
        )
        for s in other_active:
            s.status = TrackingSessionStatus.STOPPED.value
            s.ended_at = now
            s.termination_reason = "SWITCHED_TASK"

        # 4. Create new tracking session
        session = TrackingSession(
            worker_id=current_user.id,
            task_id=task.id,
            status=TrackingSessionStatus.ACTIVE.value,
            consent_granted=True,
            started_at=now,
            device_info=start_in.device_info.strip() if start_in.device_info else None,
        )
        db.add(session)
        db.commit()
        db.refresh(session)
        return TrackingService._to_session_dto(session)

    @staticmethod
    def stop_session(
        db: Session, session_id: uuid.UUID, stop_in: TrackingSessionStop, current_user: User
    ) -> TrackingSessionRead:
        """Worker stops an active tracking session."""
        session = db.query(TrackingSession).filter(TrackingSession.id == session_id).first()
        if not session:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tracking session not found")

        # Authorization: Worker owns session, or Admin/Supervisor can terminate
        if current_user.role.name == "WORKER" and session.worker_id != current_user.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot stop another worker's session")

        if session.status != TrackingSessionStatus.ACTIVE.value:
            return TrackingService._to_session_dto(session)

        session.status = TrackingSessionStatus.STOPPED.value
        session.ended_at = datetime.now(timezone.utc)
        session.termination_reason = stop_in.termination_reason or "WORKER_STOPPED"
        db.commit()
        db.refresh(session)
        return TrackingService._to_session_dto(session)

    @staticmethod
    def record_location(
        db: Session, loc_in: WorkerLocationCreate, current_user: User
    ) -> WorkerLocationRead:
        """
        Record a live GPS coordinate point for an active tracking session.
        Coordinates and bounds are validated.
        """
        # Session check
        session = db.query(TrackingSession).filter(TrackingSession.id == loc_in.session_id).first()
        if not session:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tracking session not found")

        if session.worker_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Cannot submit location updates for another worker's session",
            )

        if session.status != TrackingSessionStatus.ACTIVE.value:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot record location for a session in '{session.status}' status (must be ACTIVE)",
            )

        now = datetime.now(timezone.utc)
        rec_time = loc_in.recorded_at or now

        # Prevent excessive update frequency (rate limiting)
        latest_point = (
            db.query(WorkerLocation)
            .filter(WorkerLocation.session_id == session.id)
            .order_by(desc(WorkerLocation.recorded_at))
            .first()
        )
        if latest_point:
            diff = (now - latest_point.recorded_at).total_seconds()
            if diff < settings.MIN_LOCATION_UPDATE_INTERVAL_SECONDS:
                # Return latest without duplicate insert to throttle network bursts
                return TrackingService._to_location_dto(latest_point)

        location = WorkerLocation(
            session_id=session.id,
            worker_id=current_user.id,
            task_id=session.task_id,
            latitude=loc_in.latitude,
            longitude=loc_in.longitude,
            accuracy=loc_in.accuracy,
            speed=loc_in.speed,
            heading=loc_in.heading,
            recorded_at=rec_time,
            created_at=now,
        )
        db.add(location)
        db.commit()
        db.refresh(location)
        return TrackingService._to_location_dto(location)

    @staticmethod
    def get_live_locations(
        db: Session, current_user: User, team_id: uuid.UUID | None = None
    ) -> list[LiveWorkerLocationRead]:
        """
        Retrieve latest location for all active field workers.
        Access is strictly scoped by user role.
        """
        now = datetime.now(timezone.utc)
        query = (
            db.query(TrackingSession)
            .options(
                joinedload(TrackingSession.worker),
                joinedload(TrackingSession.task).joinedload(Task.team),
            )
            .filter(TrackingSession.status == TrackingSessionStatus.ACTIVE.value)
        )

        if current_user.role.name == "ADMIN":
            if team_id:
                query = query.join(Task).filter(Task.team_id == team_id)
        elif current_user.role.name == "SUPERVISOR":
            supervised_teams = db.query(Team.id).filter(Team.supervisor_id == current_user.id).all()
            supervised_team_ids = [t[0] for t in supervised_teams]
            query = query.join(Task).filter(Task.team_id.in_(supervised_team_ids))
            if team_id:
                if team_id not in supervised_team_ids:
                    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied to team")
                query = query.filter(Task.team_id == team_id)
        elif current_user.role.name == "WORKER":
            query = query.filter(TrackingSession.worker_id == current_user.id)

        active_sessions = query.all()
        results: list[LiveWorkerLocationRead] = []

        for s in active_sessions:
            latest_loc = (
                db.query(WorkerLocation)
                .filter(WorkerLocation.session_id == s.id)
                .order_by(desc(WorkerLocation.recorded_at))
                .first()
            )
            if not latest_loc:
                continue

            diff_sec = (now - latest_loc.recorded_at).total_seconds()
            is_stale = diff_sec > 300  # Stale if > 5 minutes without update

            results.append(
                LiveWorkerLocationRead(
                    worker_id=s.worker_id,
                    worker_name=s.worker.full_name,
                    worker_email=s.worker.email,
                    session_id=s.id,
                    session_status=s.status,
                    task_id=s.task_id,
                    task_title=s.task.title,
                    team_id=s.task.team_id,
                    team_name=s.task.team.name if s.task.team else None,
                    latitude=latest_loc.latitude,
                    longitude=latest_loc.longitude,
                    accuracy=latest_loc.accuracy,
                    speed=latest_loc.speed,
                    heading=latest_loc.heading,
                    last_updated=latest_loc.recorded_at,
                    is_stale=is_stale,
                )
            )

        return results

    @staticmethod
    def get_worker_location_history(
        db: Session,
        worker_id: uuid.UUID,
        current_user: User,
        session_id: uuid.UUID | None = None,
        limit: int = 200,
    ) -> list[WorkerLocationRead]:
        """
        Get authorized breadcrumb trail and location history for a worker.
        """
        # Authorization Check
        if current_user.role.name == "WORKER":
            if current_user.id != worker_id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Cannot view another worker's location history",
                )
        elif current_user.role.name == "SUPERVISOR":
            # Check if target worker belongs to any team supervised by current supervisor
            supervised_teams = db.query(Team.id).filter(Team.supervisor_id == current_user.id).all()
            supervised_team_ids = [t[0] for t in supervised_teams]
            is_member = (
                db.query(TeamMember)
                .filter(TeamMember.team_id.in_(supervised_team_ids), TeamMember.user_id == worker_id)
                .first()
            )
            if not is_member:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Cannot view location history for a worker outside your supervised teams",
                )

        query = db.query(WorkerLocation).filter(WorkerLocation.worker_id == worker_id)
        if session_id:
            query = query.filter(WorkerLocation.session_id == session_id)

        locations = query.order_by(WorkerLocation.recorded_at.asc()).limit(limit).all()
        return [TrackingService._to_location_dto(l) for l in locations]

    @staticmethod
    def get_session_details(
        db: Session, session_id: uuid.UUID, current_user: User
    ) -> TrackingSessionRead:
        """Get full details and trail points for a tracking session."""
        session = (
            db.query(TrackingSession)
            .options(
                joinedload(TrackingSession.worker),
                joinedload(TrackingSession.task).joinedload(Task.team),
                joinedload(TrackingSession.locations),
            )
            .filter(TrackingSession.id == session_id)
            .first()
        )
        if not session:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tracking session not found")

        # Authorization
        if current_user.role.name == "WORKER" and session.worker_id != current_user.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
        elif current_user.role.name == "SUPERVISOR":
            if not session.task.team or session.task.team.supervisor_id != current_user.id:
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

        return TrackingService._to_session_dto(session)

    @staticmethod
    def get_team_summary(
        db: Session, team_id: uuid.UUID, current_user: User
    ) -> TeamLocationSummary:
        """Get team location summary for supervisors and admins."""
        team = db.query(Team).filter(Team.id == team_id).first()
        if not team:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Team not found")

        if current_user.role.name == "SUPERVISOR" and team.supervisor_id != current_user.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied to team")

        live_locs = TrackingService.get_live_locations(db, current_user, team_id=team.id)
        return TeamLocationSummary(
            team_id=team.id,
            team_name=team.name,
            active_workers_count=len(live_locs),
            workers=live_locs,
        )

    @staticmethod
    def terminate_sessions_for_task(db: Session, task_id: uuid.UUID, reason: str = "TASK_TERMINATED") -> int:
        """
        Auto-terminate tracking sessions when a task completes or cancels.
        """
        active_sessions = (
            db.query(TrackingSession)
            .filter(
                TrackingSession.task_id == task_id,
                TrackingSession.status == TrackingSessionStatus.ACTIVE.value,
            )
            .all()
        )
        now = datetime.now(timezone.utc)
        for s in active_sessions:
            s.status = (
                TrackingSessionStatus.COMPLETED.value
                if "COMPLETE" in reason
                else TrackingSessionStatus.CANCELLED.value
            )
            s.ended_at = now
            s.termination_reason = reason

        db.flush()
        return len(active_sessions)

    @staticmethod
    def cleanup_old_locations(db: Session) -> int:
        """Configurable retention policy: prune locations older than retention window."""
        cutoff = datetime.now(timezone.utc) - timedelta(days=settings.LOCATION_RETENTION_DAYS)
        deleted = (
            db.query(WorkerLocation)
            .filter(WorkerLocation.recorded_at < cutoff)
            .delete(synchronize_session=False)
        )
        db.commit()
        return deleted

    @staticmethod
    def _to_session_dto(session: TrackingSession) -> TrackingSessionRead:
        worker_name = session.worker.full_name if session.worker else None
        task_title = session.task.title if session.task else None
        loc_dtos = [TrackingService._to_location_dto(l) for l in session.locations] if session.locations else []

        return TrackingSessionRead(
            id=session.id,
            worker_id=session.worker_id,
            worker_name=worker_name,
            task_id=session.task_id,
            task_title=task_title,
            status=session.status,
            consent_granted=session.consent_granted,
            started_at=session.started_at,
            ended_at=session.ended_at,
            termination_reason=session.termination_reason,
            device_info=session.device_info,
            breadcrumbs_count=len(loc_dtos),
            locations=loc_dtos,
        )

    @staticmethod
    def _to_location_dto(loc: WorkerLocation) -> WorkerLocationRead:
        worker_name = loc.worker.full_name if loc.worker else None
        task_title = loc.task.title if loc.task else None

        return WorkerLocationRead(
            id=loc.id,
            session_id=loc.session_id,
            worker_id=loc.worker_id,
            worker_name=worker_name,
            task_id=loc.task_id,
            task_title=task_title,
            latitude=loc.latitude,
            longitude=loc.longitude,
            accuracy=loc.accuracy,
            speed=loc.speed,
            heading=loc.heading,
            recorded_at=loc.recorded_at,
        )
