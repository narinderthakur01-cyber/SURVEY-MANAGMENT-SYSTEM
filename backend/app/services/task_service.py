import uuid
from datetime import datetime, timezone
from fastapi import HTTPException, status
from sqlalchemy.orm import Session, joinedload
from app.models.task import (
    Task,
    TaskAssignment,
    TaskAssistanceRequest,
    TaskIssue,
    TaskStatus,
    TaskPriority,
)
from app.models.survey import SurveyVersion, SurveyVersionStatus
from app.models.team import Team
from app.models.team_member import TeamMember
from app.models.user import User
from app.schemas.task import (
    TaskCreate,
    TaskUpdate,
    TaskAssign,
    TaskReject,
    TaskComplete,
    TaskAssistanceCreate,
    TaskAssistanceResolve,
    TaskIssueCreate,
    TaskIssueResolve,
    TaskRead,
    TaskAssignmentRead,
    TaskAssistanceRead,
    TaskIssueRead,
)


class TaskService:
    @staticmethod
    def _to_read_dto(task: Task) -> TaskRead:
        """Helper to convert Task ORM to TaskRead DTO with enriched names."""
        survey_title = None
        version_number = None
        if task.survey_version:
            version_number = task.survey_version.version_number
            if hasattr(task.survey_version, 'survey') and task.survey_version.survey:
                survey_title = task.survey_version.survey.title

        return TaskRead(
            id=task.id,
            title=task.title,
            description=task.description,
            survey_version_id=task.survey_version_id,
            survey_title=survey_title,
            version_number=version_number,
            team_id=task.team_id,
            team_name=task.team.name if task.team else None,
            assigned_worker_id=task.assigned_worker_id,
            assigned_worker_name=task.assigned_worker.full_name if task.assigned_worker else None,
            created_by_id=task.created_by_id,
            creator_name=task.creator.full_name if task.creator else None,
            status=task.status,
            priority=task.priority,
            due_date=task.due_date,
            location_name=task.location_name,
            target_latitude=task.target_latitude,
            target_longitude=task.target_longitude,
            created_at=task.created_at,
            assigned_at=task.assigned_at,
            accepted_at=task.accepted_at,
            started_at=task.started_at,
            completed_at=task.completed_at,
            cancelled_at=task.cancelled_at,
            rejection_reason=task.rejection_reason,
            completion_notes=task.completion_notes,
            survey_response_data=task.survey_response_data,
            updated_at=task.updated_at,
            assignment_history=[
                TaskAssignmentRead(
                    id=a.id,
                    task_id=a.task_id,
                    worker_id=a.worker_id,
                    worker_name=a.worker.full_name if a.worker else None,
                    assigned_by_id=a.assigned_by_id,
                    assigned_by_name=a.assigned_by.full_name if a.assigned_by else None,
                    assigned_at=a.assigned_at,
                    status=a.status,
                    rejection_reason=a.rejection_reason,
                    notes=a.notes,
                )
                for a in task.assignment_history
            ],
            assistance_requests=[
                TaskAssistanceRead(
                    id=ar.id,
                    task_id=ar.task_id,
                    worker_id=ar.worker_id,
                    worker_name=ar.worker.full_name if ar.worker else None,
                    message=ar.message,
                    status=ar.status,
                    supervisor_response=ar.supervisor_response,
                    resolved_by_id=ar.resolved_by_id,
                    resolved_by_name=ar.resolved_by.full_name if ar.resolved_by else None,
                    created_at=ar.created_at,
                    resolved_at=ar.resolved_at,
                )
                for ar in task.assistance_requests
            ],
            issues=[
                TaskIssueRead(
                    id=iss.id,
                    task_id=iss.task_id,
                    reported_by_id=iss.reported_by_id,
                    reported_by_name=iss.reported_by.full_name if iss.reported_by else None,
                    issue_type=iss.issue_type,
                    description=iss.description,
                    status=iss.status,
                    resolution_notes=iss.resolution_notes,
                    created_at=iss.created_at,
                    resolved_at=iss.resolved_at,
                )
                for iss in task.issues
            ],
        )

    @staticmethod
    def create_task(db: Session, task_in: TaskCreate, current_user: User) -> TaskRead:
        """Create a new survey task linked to a published survey version."""
        # 1. Survey Version Integrity: Must reference a PUBLISHED version
        version = db.query(SurveyVersion).filter(SurveyVersion.id == task_in.survey_version_id).first()
        if not version:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Survey version not found")

        if version.status != SurveyVersionStatus.PUBLISHED.value:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Tasks can only be created for published survey versions",
            )

        # 2. Team & Supervisor Validation
        if current_user.role.name == "SUPERVISOR":
            if not task_in.team_id:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Supervisors must specify a team for the task",
                )
            team = db.query(Team).filter(Team.id == task_in.team_id).first()
            if not team or team.supervisor_id != current_user.id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Cannot create a task for a team you do not supervise",
                )
        elif task_in.team_id:
            team = db.query(Team).filter(Team.id == task_in.team_id).first()
            if not team:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Team not found")

        # 3. Worker Validation (if assigned on creation)
        initial_status = TaskStatus.PENDING.value
        assigned_at = None
        if task_in.assigned_worker_id:
            worker = db.query(User).filter(User.id == task_in.assigned_worker_id).first()
            if not worker or not worker.is_active:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Assigned worker not found or inactive")

            # If team is set, worker must be a member of that team
            if task_in.team_id:
                membership = (
                    db.query(TeamMember)
                    .filter(TeamMember.team_id == task_in.team_id, TeamMember.user_id == worker.id)
                    .first()
                )
                if not membership:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="Assigned worker is not a member of the specified team",
                    )

            initial_status = TaskStatus.ASSIGNED.value
            assigned_at = datetime.now(timezone.utc)

        task = Task(
            title=task_in.title.strip(),
            description=task_in.description.strip() if task_in.description else None,
            survey_version_id=task_in.survey_version_id,
            team_id=task_in.team_id,
            assigned_worker_id=task_in.assigned_worker_id,
            created_by_id=current_user.id,
            status=initial_status,
            priority=task_in.priority.value if hasattr(task_in.priority, 'value') else str(task_in.priority),
            due_date=task_in.due_date,
            location_name=task_in.location_name.strip() if task_in.location_name else None,
            target_latitude=task_in.target_latitude,
            target_longitude=task_in.target_longitude,
            assigned_at=assigned_at,
        )
        db.add(task)
        db.flush()

        if task.assigned_worker_id:
            assignment = TaskAssignment(
                task_id=task.id,
                worker_id=task.assigned_worker_id,
                assigned_by_id=current_user.id,
                assigned_at=assigned_at,
                status=TaskStatus.ASSIGNED.value,
                notes="Initial task assignment",
            )
            db.add(assignment)

        db.commit()
        db.refresh(task)
        return TaskService.get_task(db, task.id, current_user)

    @staticmethod
    def get_task(db: Session, task_id: uuid.UUID, current_user: User) -> TaskRead:
        """Get task details with full access control verification."""
        task = (
            db.query(Task)
            .options(
                joinedload(Task.survey_version).joinedload(SurveyVersion.survey),
                joinedload(Task.team),
                joinedload(Task.assigned_worker),
                joinedload(Task.creator),
                joinedload(Task.assignment_history).joinedload(TaskAssignment.worker),
                joinedload(Task.assignment_history).joinedload(TaskAssignment.assigned_by),
                joinedload(Task.assistance_requests).joinedload(TaskAssistanceRequest.worker),
                joinedload(Task.assistance_requests).joinedload(TaskAssistanceRequest.resolved_by),
                joinedload(Task.issues).joinedload(TaskIssue.reported_by),
            )
            .filter(Task.id == task_id)
            .first()
        )
        if not task:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")

        # Authorization check
        if current_user.role.name == "ADMIN":
            pass
        elif current_user.role.name == "SUPERVISOR":
            if not task.team or task.team.supervisor_id != current_user.id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Cannot access a task outside your supervised teams",
                )
        elif current_user.role.name == "WORKER":
            if task.assigned_worker_id != current_user.id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Access denied. You can only view tasks assigned to you",
                )

        return TaskService._to_read_dto(task)

    @staticmethod
    def list_tasks(
        db: Session,
        current_user: User,
        team_id: uuid.UUID | None = None,
        worker_id: uuid.UUID | None = None,
        status_filter: str | None = None,
    ) -> list[TaskRead]:
        """List tasks scoped strictly by role and permissions."""
        query = db.query(Task).options(
            joinedload(Task.survey_version).joinedload(SurveyVersion.survey),
            joinedload(Task.team),
            joinedload(Task.assigned_worker),
            joinedload(Task.creator),
        )

        if current_user.role.name == "ADMIN":
            if team_id:
                query = query.filter(Task.team_id == team_id)
            if worker_id:
                query = query.filter(Task.assigned_worker_id == worker_id)
        elif current_user.role.name == "SUPERVISOR":
            # Only tasks belonging to teams supervised by this supervisor
            supervised_teams = db.query(Team.id).filter(Team.supervisor_id == current_user.id).all()
            supervised_team_ids = [t[0] for t in supervised_teams]
            query = query.filter(Task.team_id.in_(supervised_team_ids))
            if team_id:
                if team_id not in supervised_team_ids:
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail="Cannot filter by a team you do not supervise",
                    )
                query = query.filter(Task.team_id == team_id)
            if worker_id:
                query = query.filter(Task.assigned_worker_id == worker_id)
        elif current_user.role.name == "WORKER":
            # Worker can ONLY see tasks assigned to them!
            query = query.filter(Task.assigned_worker_id == current_user.id)

        if status_filter:
            query = query.filter(Task.status == status_filter.upper())

        tasks = query.order_by(Task.created_at.desc()).all()
        return [TaskService._to_read_dto(t) for t in tasks]

    @staticmethod
    def assign_worker(db: Session, task_id: uuid.UUID, assign_in: TaskAssign, current_user: User) -> TaskRead:
        """Assign or reassign a field worker to a task."""
        task = db.query(Task).filter(Task.id == task_id).first()
        if not task:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")

        # Lifecycle check: cannot assign completed or cancelled task
        if task.status in [TaskStatus.COMPLETED.value, TaskStatus.CANCELLED.value]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot assign or reassign a {task.status.lower()} task",
            )

        # Authorization check
        if current_user.role.name == "SUPERVISOR":
            if not task.team or task.team.supervisor_id != current_user.id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Cannot assign tasks for a team you do not supervise",
                )
        elif current_user.role.name != "ADMIN":
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Operation not permitted")

        # Worker Validation
        worker = db.query(User).filter(User.id == assign_in.worker_id).first()
        if not worker or not worker.is_active:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Worker not found or inactive")

        # If task has a team, worker must be a member of that team
        if task.team_id:
            membership = (
                db.query(TeamMember)
                .filter(TeamMember.team_id == task.team_id, TeamMember.user_id == worker.id)
                .first()
            )
            if not membership:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Worker is not a member of the assigned team",
                )

        # Prevent duplicate assignment if worker is already assigned and active
        if task.assigned_worker_id == worker.id and task.status in [
            TaskStatus.ASSIGNED.value,
            TaskStatus.ACCEPTED.value,
            TaskStatus.IN_PROGRESS.value,
        ]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Task is already actively assigned to this worker",
            )

        now = datetime.now(timezone.utc)
        task.assigned_worker_id = worker.id
        task.status = TaskStatus.ASSIGNED.value
        task.assigned_at = now
        task.rejection_reason = None

        # Record assignment history
        assignment = TaskAssignment(
            task_id=task.id,
            worker_id=worker.id,
            assigned_by_id=current_user.id,
            assigned_at=now,
            status=TaskStatus.ASSIGNED.value,
            notes=assign_in.notes.strip() if assign_in.notes else None,
        )
        db.add(assignment)
        db.commit()
        return TaskService.get_task(db, task.id, current_user)

    @staticmethod
    def accept_task(db: Session, task_id: uuid.UUID, current_user: User) -> TaskRead:
        """Worker accepts an assigned task."""
        task = db.query(Task).filter(Task.id == task_id).first()
        if not task:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")

        if task.assigned_worker_id != current_user.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You are not assigned to this task")

        if task.status == TaskStatus.ACCEPTED.value:
            # Idempotent: already accepted
            return TaskService.get_task(db, task.id, current_user)

        if task.status != TaskStatus.ASSIGNED.value:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot accept a task in '{task.status}' status (must be ASSIGNED)",
            )

        now = datetime.now(timezone.utc)
        task.status = TaskStatus.ACCEPTED.value
        task.accepted_at = now

        # Record in assignment history
        assignment = (
            db.query(TaskAssignment)
            .filter(TaskAssignment.task_id == task.id, TaskAssignment.worker_id == current_user.id)
            .order_by(TaskAssignment.assigned_at.desc())
            .first()
        )
        if assignment:
            assignment.status = TaskStatus.ACCEPTED.value

        db.commit()
        return TaskService.get_task(db, task.id, current_user)

    @staticmethod
    def reject_task(db: Session, task_id: uuid.UUID, reject_in: TaskReject, current_user: User) -> TaskRead:
        """Worker rejects an assigned task with a required reason."""
        task = db.query(Task).filter(Task.id == task_id).first()
        if not task:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")

        if task.assigned_worker_id != current_user.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You are not assigned to this task")

        if task.status != TaskStatus.ASSIGNED.value:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot reject a task in '{task.status}' status (must be ASSIGNED)",
            )

        now = datetime.now(timezone.utc)
        reason = reject_in.rejection_reason.strip()
        task.status = TaskStatus.REJECTED.value
        task.rejection_reason = reason

        # Record in assignment history
        assignment = (
            db.query(TaskAssignment)
            .filter(TaskAssignment.task_id == task.id, TaskAssignment.worker_id == current_user.id)
            .order_by(TaskAssignment.assigned_at.desc())
            .first()
        )
        if assignment:
            assignment.status = TaskStatus.REJECTED.value
            assignment.rejection_reason = reason

        db.commit()
        return TaskService.get_task(db, task.id, current_user)

    @staticmethod
    def start_task(db: Session, task_id: uuid.UUID, current_user: User) -> TaskRead:
        """Worker begins survey execution on an accepted task."""
        task = db.query(Task).filter(Task.id == task_id).first()
        if not task:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")

        if task.assigned_worker_id != current_user.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You are not assigned to this task")

        if task.status == TaskStatus.IN_PROGRESS.value:
            # Idempotent: already started
            return TaskService.get_task(db, task.id, current_user)

        if task.status != TaskStatus.ACCEPTED.value:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot start task from status '{task.status}' (must be ACCEPTED)",
            )

        task.status = TaskStatus.IN_PROGRESS.value
        task.started_at = datetime.now(timezone.utc)
        db.commit()
        return TaskService.get_task(db, task.id, current_user)

    @staticmethod
    def complete_task(db: Session, task_id: uuid.UUID, complete_in: TaskComplete, current_user: User) -> TaskRead:
        """Worker completes the survey and submits response data."""
        task = db.query(Task).filter(Task.id == task_id).first()
        if not task:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")

        if task.assigned_worker_id != current_user.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You are not assigned to this task")

        if task.status != TaskStatus.IN_PROGRESS.value:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot complete a task in status '{task.status}' (must be IN_PROGRESS)",
            )

        if not complete_in.survey_response_data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Survey responses are required to complete the task",
            )

        now = datetime.now(timezone.utc)
        task.status = TaskStatus.COMPLETED.value
        task.completed_at = now
        task.survey_response_data = complete_in.survey_response_data
        task.completion_notes = complete_in.completion_notes.strip() if complete_in.completion_notes else None
        db.commit()
        return TaskService.get_task(db, task.id, current_user)

    @staticmethod
    def cancel_task(db: Session, task_id: uuid.UUID, current_user: User) -> TaskRead:
        """Admin or Supervisor cancels a task."""
        task = db.query(Task).filter(Task.id == task_id).first()
        if not task:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")

        # Authorization check
        if current_user.role.name == "SUPERVISOR":
            if not task.team or task.team.supervisor_id != current_user.id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Cannot cancel a task outside your supervised teams",
                )
        elif current_user.role.name != "ADMIN":
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Operation not permitted")

        if task.status == TaskStatus.COMPLETED.value:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot cancel a completed task")

        task.status = TaskStatus.CANCELLED.value
        task.cancelled_at = datetime.now(timezone.utc)
        db.commit()
        return TaskService.get_task(db, task.id, current_user)

    @staticmethod
    def request_assistance(db: Session, task_id: uuid.UUID, req_in: TaskAssistanceCreate, current_user: User) -> TaskRead:
        """Worker requests assistance for a task."""
        task = db.query(Task).filter(Task.id == task_id).first()
        if not task:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")

        if task.assigned_worker_id != current_user.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You are not assigned to this task")

        req = TaskAssistanceRequest(
            task_id=task.id,
            worker_id=current_user.id,
            message=req_in.message.strip(),
            status="OPEN",
        )
        db.add(req)
        db.commit()
        return TaskService.get_task(db, task.id, current_user)

    @staticmethod
    def resolve_assistance(
        db: Session, task_id: uuid.UUID, request_id: uuid.UUID, res_in: TaskAssistanceResolve, current_user: User
    ) -> TaskRead:
        """Supervisor or Admin responds to and resolves an assistance request."""
        task = db.query(Task).filter(Task.id == task_id).first()
        if not task:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")

        if current_user.role.name == "SUPERVISOR":
            if not task.team or task.team.supervisor_id != current_user.id:
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
        elif current_user.role.name != "ADMIN":
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Operation not permitted")

        req = (
            db.query(TaskAssistanceRequest)
            .filter(TaskAssistanceRequest.id == request_id, TaskAssistanceRequest.task_id == task_id)
            .first()
        )
        if not req:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Assistance request not found")

        req.status = "RESOLVED"
        req.supervisor_response = res_in.supervisor_response.strip()
        req.resolved_by_id = current_user.id
        req.resolved_at = datetime.now(timezone.utc)
        db.commit()
        return TaskService.get_task(db, task.id, current_user)

    @staticmethod
    def report_issue(db: Session, task_id: uuid.UUID, issue_in: TaskIssueCreate, current_user: User) -> TaskRead:
        """Report an issue encountered on a task."""
        task = db.query(Task).filter(Task.id == task_id).first()
        if not task:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")

        if current_user.role.name == "WORKER" and task.assigned_worker_id != current_user.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

        issue = TaskIssue(
            task_id=task.id,
            reported_by_id=current_user.id,
            issue_type=issue_in.issue_type.strip(),
            description=issue_in.description.strip(),
            status="OPEN",
        )
        db.add(issue)
        db.commit()
        return TaskService.get_task(db, task.id, current_user)

    @staticmethod
    def resolve_issue(
        db: Session, task_id: uuid.UUID, issue_id: uuid.UUID, res_in: TaskIssueResolve, current_user: User
    ) -> TaskRead:
        """Resolve a reported task issue."""
        task = db.query(Task).filter(Task.id == task_id).first()
        if not task:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")

        if current_user.role.name == "SUPERVISOR":
            if not task.team or task.team.supervisor_id != current_user.id:
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
        elif current_user.role.name != "ADMIN":
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Operation not permitted")

        issue = (
            db.query(TaskIssue)
            .filter(TaskIssue.id == issue_id, TaskIssue.task_id == task_id)
            .first()
        )
        if not issue:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task issue not found")

        issue.status = "RESOLVED"
        issue.resolution_notes = res_in.resolution_notes.strip()
        issue.resolved_at = datetime.now(timezone.utc)
        db.commit()
        return TaskService.get_task(db, task.id, current_user)
