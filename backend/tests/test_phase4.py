import uuid
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from app.main import app
from app.core.config import settings
from app.database.connection import SessionLocal
from app.models.survey import QuestionType
from app.models.user import User
from app.models.role import Role
from app.models.team import Team
from app.models.team_member import TeamMember
from app.core.security import get_password_hash

client = TestClient(app)


@pytest.fixture(scope="module")
def db():
    session = SessionLocal()
    yield session
    session.close()


@pytest.fixture(scope="module")
def admin_token():
    res = client.post("/api/v1/auth/login", json={
        "email": settings.FIRST_SUPERUSER_EMAIL,
        "password": settings.FIRST_SUPERUSER_PASSWORD,
    })
    assert res.status_code == 200
    return res.json()["access_token"]


@pytest.fixture(scope="module")
def supervisor_token():
    res = client.post("/api/v1/auth/login", json={
        "email": "supervisor@survey.org",
        "password": "Supervisor123!",
    })
    assert res.status_code == 200
    return res.json()["access_token"]


@pytest.fixture(scope="module")
def worker_token():
    res = client.post("/api/v1/auth/login", json={
        "email": "worker@survey.org",
        "password": "Worker123!",
    })
    assert res.status_code == 200
    return res.json()["access_token"]


@pytest.fixture(scope="module")
def test_setup(db: Session, admin_token: str):
    """
    Set up fresh users, teams, and published survey version for Phase 4 testing.
    """
    worker_role = db.query(Role).filter(Role.name == "WORKER").first()
    sup_role = db.query(Role).filter(Role.name == "SUPERVISOR").first()

    # 1. Create a second worker and second supervisor for isolation tests
    worker_2 = db.query(User).filter(User.email == "worker2@survey.org").first()
    if not worker_2:
        worker_2 = User(
            email="worker2@survey.org",
            full_name="Second Field Worker",
            hashed_password=get_password_hash("Worker123!"),
            role_id=worker_role.id,
            is_active=True,
        )
        db.add(worker_2)
        db.flush()

    sup_2 = db.query(User).filter(User.email == "supervisor2@survey.org").first()
    if not sup_2:
        sup_2 = User(
            email="supervisor2@survey.org",
            full_name="Second Supervisor",
            hashed_password=get_password_hash("Supervisor123!"),
            role_id=sup_role.id,
            is_active=True,
        )
        db.add(sup_2)
        db.flush()

    # Get Primary Supervisor and Worker 1
    sup_1 = db.query(User).filter(User.email == "supervisor@survey.org").first()
    worker_1 = db.query(User).filter(User.email == "worker@survey.org").first()

    # Create an external worker who is never added to Team A
    worker_ext = db.query(User).filter(User.email == "external_worker@survey.org").first()
    if not worker_ext:
        worker_ext = User(
            email="external_worker@survey.org",
            full_name="External Non-Member Worker",
            hashed_password=get_password_hash("Worker123!"),
            role_id=worker_role.id,
            is_active=True,
        )
        db.add(worker_ext)
        db.flush()

    # 2. Create Teams: Team A (sup_1) with worker_1, Team B (sup_2) with worker_2
    team_a = db.query(Team).filter(Team.name == "Alpha Unit Phase4").first()
    if not team_a:
        team_a = Team(name="Alpha Unit Phase4", description="Team A", supervisor_id=sup_1.id)
        db.add(team_a)
        db.flush()
        db.add(TeamMember(team_id=team_a.id, user_id=worker_1.id))

    team_b = db.query(Team).filter(Team.name == "Beta Unit Phase4").first()
    if not team_b:
        team_b = Team(name="Beta Unit Phase4", description="Team B", supervisor_id=sup_2.id)
        db.add(team_b)
        db.flush()
        db.add(TeamMember(team_id=team_b.id, user_id=worker_2.id))

    db.commit()

    # Login tokens for secondary accounts
    w2_res = client.post("/api/v1/auth/login", json={"email": "worker2@survey.org", "password": "Worker123!"})
    s2_res = client.post("/api/v1/auth/login", json={"email": "supervisor2@survey.org", "password": "Supervisor123!"})

    # 3. Create and publish a survey
    survey_res = client.post(
        "/api/v1/surveys",
        json={"title": "Phase 4 Household Audit", "description": "For task assignment tests"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    s_data = survey_res.json()
    survey_id = s_data["id"]
    v1_id = s_data["versions"][0]["id"]

    # Add questions and publish version 1
    client.post(
        f"/api/v1/surveys/{survey_id}/draft",
        json=[
            {
                "title": "Household Basics",
                "questions": [
                    {"question_text": "Household Head Name", "question_type": QuestionType.SHORT_TEXT.value, "is_required": True},
                    {"question_text": "Dwelling Condition (1-5)", "question_type": QuestionType.RATING.value, "is_required": True},
                ],
            }
        ],
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    client.post(
        f"/api/v1/surveys/versions/{v1_id}/publish",
        headers={"Authorization": f"Bearer {admin_token}"},
    )

    # Also create an unpublished draft survey
    draft_res = client.post(
        "/api/v1/surveys",
        json={"title": "Draft Only Survey", "description": "Unpublished"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    draft_v_id = draft_res.json()["versions"][0]["id"]

    return {
        "published_version_id": v1_id,
        "draft_version_id": draft_v_id,
        "team_a_id": str(team_a.id),
        "team_b_id": str(team_b.id),
        "worker_1_id": str(worker_1.id),
        "worker_2_id": str(worker_2.id),
        "external_worker_id": str(worker_ext.id),
        "worker_2_token": w2_res.json()["access_token"],
        "supervisor_2_token": s2_res.json()["access_token"],
    }


# ============================================================================
# 1. Survey Version Integrity & Task Creation
# ============================================================================

def test_task_creation_requires_published_survey(admin_token, test_setup):
    """Verify tasks can only be created for PUBLISHED survey versions."""
    # Attempt on DRAFT version -> strictly rejected (400)
    fail_res = client.post(
        "/api/v1/tasks",
        json={
            "title": "Invalid Draft Task",
            "survey_version_id": test_setup["draft_version_id"],
            "team_id": test_setup["team_a_id"],
        },
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert fail_res.status_code == 400
    assert "published survey versions" in fail_res.json()["detail"].lower()

    # Success on PUBLISHED version
    ok_res = client.post(
        "/api/v1/tasks",
        json={
            "title": "Valid Published Task",
            "survey_version_id": test_setup["published_version_id"],
            "team_id": test_setup["team_a_id"],
            "priority": "HIGH",
        },
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert ok_res.status_code == 201
    data = ok_res.json()
    assert data["status"] == "PENDING"
    assert data["priority"] == "HIGH"
    assert data["survey_version_id"] == test_setup["published_version_id"]


# ============================================================================
# 2. Authorization and Cross-Team Isolation
# ============================================================================

def test_supervisor_cross_team_access_denial(supervisor_token, test_setup):
    """
    Supervisor 1 (supervising Team A) cannot:
    - Create a task for Team B.
    - Assign a worker from Team B to Team A's task.
    """
    # 1. Create task for Team B as Supervisor 1 -> 403 Forbidden
    res = client.post(
        "/api/v1/tasks",
        json={
            "title": "Cross Team Creation Attempt",
            "survey_version_id": test_setup["published_version_id"],
            "team_id": test_setup["team_b_id"],
        },
        headers={"Authorization": f"Bearer {supervisor_token}"},
    )
    assert res.status_code == 403

    # 2. Create task for Team A (allowed)
    create_res = client.post(
        "/api/v1/tasks",
        json={
            "title": "Supervisor 1 Task",
            "survey_version_id": test_setup["published_version_id"],
            "team_id": test_setup["team_a_id"],
        },
        headers={"Authorization": f"Bearer {supervisor_token}"},
    )
    assert create_res.status_code == 201
    task_id = create_res.json()["id"]

    # 3. Attempt to assign an external worker (not a member of Team A) to Team A's task -> 400 Bad Request
    assign_fail = client.post(
        f"/api/v1/tasks/{task_id}/assign",
        json={"worker_id": test_setup["external_worker_id"]},
        headers={"Authorization": f"Bearer {supervisor_token}"},
    )
    assert assign_fail.status_code == 400
    assert "not a member" in assign_fail.json()["detail"].lower()


def test_worker_cannot_create_or_cancel_tasks(worker_token, test_setup):
    """Worker has read/action access only on their assigned tasks, cannot create or cancel."""
    res = client.post(
        "/api/v1/tasks",
        json={
            "title": "Worker Task Attempt",
            "survey_version_id": test_setup["published_version_id"],
        },
        headers={"Authorization": f"Bearer {worker_token}"},
    )
    assert res.status_code == 403


# ============================================================================
# 3. Worker Isolation: Access Control & Data Privacy
# ============================================================================

def test_worker_task_isolation(admin_token, worker_token, test_setup):
    """
    Worker 1 cannot see, accept, start, or submit tasks assigned to Worker 2.
    """
    # Admin creates task assigned to Worker 2
    res = client.post(
        "/api/v1/tasks",
        json={
            "title": "Worker 2 Private Task",
            "survey_version_id": test_setup["published_version_id"],
            "team_id": test_setup["team_b_id"],
            "assigned_worker_id": test_setup["worker_2_id"],
        },
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert res.status_code == 201
    task_id = res.json()["id"]

    # Worker 1 attempts to view Worker 2's task -> 403 Forbidden
    view_res = client.get(f"/api/v1/tasks/{task_id}", headers={"Authorization": f"Bearer {worker_token}"})
    assert view_res.status_code == 403

    # Worker 1 attempts to accept Worker 2's task -> 403 Forbidden
    accept_res = client.post(f"/api/v1/tasks/{task_id}/accept", headers={"Authorization": f"Bearer {worker_token}"})
    assert accept_res.status_code == 403

    # Worker 1 lists tasks -> Worker 2's task is NOT included in the list
    list_res = client.get("/api/v1/tasks", headers={"Authorization": f"Bearer {worker_token}"})
    assert list_res.status_code == 200
    task_ids = [t["id"] for t in list_res.json()]
    assert task_id not in task_ids


# ============================================================================
# 4. Task Lifecycle: PENDING -> ASSIGNED -> ACCEPTED -> IN_PROGRESS -> COMPLETED
# ============================================================================

def test_complete_task_lifecycle_and_transitions(admin_token, worker_token, test_setup):
    """
    Test full lifecycle transitions and rejection of invalid status transitions.
    """
    # 1. Create task in PENDING
    res = client.post(
        "/api/v1/tasks",
        json={
            "title": "Lifecycle Test Task",
            "survey_version_id": test_setup["published_version_id"],
            "team_id": test_setup["team_a_id"],
        },
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    task_id = res.json()["id"]
    assert res.json()["status"] == "PENDING"

    # Invalid: cannot start task from PENDING
    assert client.post(f"/api/v1/tasks/{task_id}/start", headers={"Authorization": f"Bearer {worker_token}"}).status_code in [400, 403]

    # 2. Assign Worker 1
    assign_res = client.post(
        f"/api/v1/tasks/{task_id}/assign",
        json={"worker_id": test_setup["worker_1_id"], "notes": "Urgent audit required"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert assign_res.status_code == 200
    assert assign_res.json()["status"] == "ASSIGNED"
    assert assign_res.json()["assigned_worker_id"] == test_setup["worker_1_id"]
    assert len(assign_res.json()["assignment_history"]) == 1

    # Duplicate assignment prevention
    dup_res = client.post(
        f"/api/v1/tasks/{task_id}/assign",
        json={"worker_id": test_setup["worker_1_id"]},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert dup_res.status_code == 400
    assert "already actively assigned" in dup_res.json()["detail"].lower()

    # Invalid: Worker cannot start task directly from ASSIGNED without accepting
    start_invalid = client.post(f"/api/v1/tasks/{task_id}/start", headers={"Authorization": f"Bearer {worker_token}"})
    assert start_invalid.status_code == 400
    assert "must be accepted" in start_invalid.json()["detail"].lower()

    # 3. Worker 1 accepts task
    accept_res = client.post(f"/api/v1/tasks/{task_id}/accept", headers={"Authorization": f"Bearer {worker_token}"})
    assert accept_res.status_code == 200
    assert accept_res.json()["status"] == "ACCEPTED"
    assert accept_res.json()["accepted_at"] is not None

    # 4. Worker 1 starts task
    start_res = client.post(f"/api/v1/tasks/{task_id}/start", headers={"Authorization": f"Bearer {worker_token}"})
    assert start_res.status_code == 200
    assert start_res.json()["status"] == "IN_PROGRESS"
    assert start_res.json()["started_at"] is not None

    # 5. Worker 1 completes task with survey response data
    survey_answers = {
        "q_1": "John Doe",
        "q_2": 5,
    }
    complete_res = client.post(
        f"/api/v1/tasks/{task_id}/complete",
        json={
            "survey_response_data": survey_answers,
            "completion_notes": "All questions answered on-site.",
        },
        headers={"Authorization": f"Bearer {worker_token}"},
    )
    assert complete_res.status_code == 200
    completed_data = complete_res.json()
    assert completed_data["status"] == "COMPLETED"
    assert completed_data["completed_at"] is not None
    assert completed_data["survey_response_data"] == survey_answers

    # Cannot cancel a completed task
    cancel_fail = client.post(f"/api/v1/tasks/{task_id}/cancel", headers={"Authorization": f"Bearer {admin_token}"})
    assert cancel_fail.status_code == 400
    assert "cannot cancel a completed task" in cancel_fail.json()["detail"].lower()


# ============================================================================
# 5. Rejection & Reassignment History Workflow
# ============================================================================

def test_rejection_and_reassignment_history(admin_token, supervisor_token, worker_token, test_setup, db: Session):
    """
    Worker 1 rejects assigned task with reason -> status becomes REJECTED.
    Supervisor adds Worker 2 to Team A and reassigns task to Worker 2.
    History logs both assignments accurately.
    """
    # 1. Supervisor creates task assigned to Worker 1
    create_res = client.post(
        "/api/v1/tasks",
        json={
            "title": "Rejection Test Task",
            "survey_version_id": test_setup["published_version_id"],
            "team_id": test_setup["team_a_id"],
            "assigned_worker_id": test_setup["worker_1_id"],
        },
        headers={"Authorization": f"Bearer {supervisor_token}"},
    )
    task_id = create_res.json()["id"]

    # 2. Worker 1 rejects assignment
    reject_res = client.post(
        f"/api/v1/tasks/{task_id}/reject",
        json={"rejection_reason": "Vehicle breakdown, unable to reach target location today."},
        headers={"Authorization": f"Bearer {worker_token}"},
    )
    assert reject_res.status_code == 200
    assert reject_res.json()["status"] == "REJECTED"
    assert "Vehicle breakdown" in reject_res.json()["rejection_reason"]

    # Add Worker 2 to Team A so reassignment is valid
    team_a_uuid = uuid.UUID(test_setup["team_a_id"])
    w2_uuid = uuid.UUID(test_setup["worker_2_id"])
    if not db.query(TeamMember).filter(TeamMember.team_id == team_a_uuid, TeamMember.user_id == w2_uuid).first():
        db.add(TeamMember(team_id=team_a_uuid, user_id=w2_uuid))
        db.commit()

    # 3. Supervisor reassigns task to Worker 2
    reassign_res = client.post(
        f"/api/v1/tasks/{task_id}/assign",
        json={"worker_id": test_setup["worker_2_id"], "notes": "Reassigned following worker 1 breakdown."},
        headers={"Authorization": f"Bearer {supervisor_token}"},
    )
    assert reassign_res.status_code == 200
    assert reassign_res.json()["status"] == "ASSIGNED"
    assert reassign_res.json()["assigned_worker_id"] == test_setup["worker_2_id"]

    # Verify assignment history
    history = reassign_res.json()["assignment_history"]
    assert len(history) == 2
    assert history[0]["worker_id"] == test_setup["worker_2_id"]
    assert history[0]["status"] == "ASSIGNED"
    assert history[1]["worker_id"] == test_setup["worker_1_id"]
    assert history[1]["status"] == "REJECTED"


# ============================================================================
# 6. Worker Assistance Requests & Issue Reporting
# ============================================================================

def test_assistance_request_and_issue_reporting(supervisor_token, worker_token, test_setup):
    """
    Test worker assistance request creation and supervisor resolution,
    and issue reporting on tasks.
    """
    # 1. Supervisor creates task assigned to Worker 1
    create_res = client.post(
        "/api/v1/tasks",
        json={
            "title": "Assistance Test Task",
            "survey_version_id": test_setup["published_version_id"],
            "team_id": test_setup["team_a_id"],
            "assigned_worker_id": test_setup["worker_1_id"],
        },
        headers={"Authorization": f"Bearer {supervisor_token}"},
    )
    task_id = create_res.json()["id"]

    # 2. Worker requests assistance
    asst_res = client.post(
        f"/api/v1/tasks/{task_id}/assistance",
        json={"message": "Gate is locked at community center. Who has the access key?"},
        headers={"Authorization": f"Bearer {worker_token}"},
    )
    assert asst_res.status_code == 200
    asst_list = asst_res.json()["assistance_requests"]
    assert len(asst_list) == 1
    req_id = asst_list[0]["id"]
    assert asst_list[0]["status"] == "OPEN"

    # 3. Supervisor resolves assistance request
    res_asst = client.post(
        f"/api/v1/tasks/{task_id}/assistance/{req_id}/resolve",
        json={"supervisor_response": "Security office at Gate B has the key. Show your ID."},
        headers={"Authorization": f"Bearer {supervisor_token}"},
    )
    assert res_asst.status_code == 200
    updated_req = res_asst.json()["assistance_requests"][0]
    assert updated_req["status"] == "RESOLVED"
    assert "Security office" in updated_req["supervisor_response"]

    # 4. Worker reports task issue
    issue_res = client.post(
        f"/api/v1/tasks/{task_id}/issues",
        json={
            "issue_type": "ACCESS_DENIED",
            "description": "Area restricted due to road construction until noon.",
        },
        headers={"Authorization": f"Bearer {worker_token}"},
    )
    assert issue_res.status_code == 200
    issues = issue_res.json()["issues"]
    assert len(issues) == 1
    issue_id = issues[0]["id"]
    assert issues[0]["status"] == "OPEN"

    # 5. Supervisor resolves issue
    res_issue = client.post(
        f"/api/v1/tasks/{task_id}/issues/{issue_id}/resolve",
        json={"resolution_notes": "Supervisor coordinated with site manager for entry after 12:30 PM."},
        headers={"Authorization": f"Bearer {supervisor_token}"},
    )
    assert res_issue.status_code == 200
    assert res_issue.json()["issues"][0]["status"] == "RESOLVED"
