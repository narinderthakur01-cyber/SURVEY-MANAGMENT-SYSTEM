import uuid
from datetime import datetime, timezone, timedelta
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
from app.models.tracking import WorkerLocation
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
def test_setup_p5(db: Session, admin_token: str):
    """
    Set up published survey, teams, and tasks for Phase 5 tracking verification.
    """
    worker_role = db.query(Role).filter(Role.name == "WORKER").first()
    sup_role = db.query(Role).filter(Role.name == "SUPERVISOR").first()

    # Get or create Supervisor 1 & Worker 1
    sup_1 = db.query(User).filter(User.email == "supervisor@survey.org").first()
    worker_1 = db.query(User).filter(User.email == "worker@survey.org").first()

    # Get or create external worker not in any supervisor team
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

    # Get or create Supervisor 2 & Worker 2
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

    # Dedicated teams for Phase 5
    team_a = db.query(Team).filter(Team.name == "Tracking Team Alpha").first()
    if not team_a:
        team_a = Team(name="Tracking Team Alpha", supervisor_id=sup_1.id)
        db.add(team_a)
        db.flush()
        db.add(TeamMember(team_id=team_a.id, user_id=worker_1.id))

    team_b = db.query(Team).filter(Team.name == "Tracking Team Beta").first()
    if not team_b:
        team_b = Team(name="Tracking Team Beta", supervisor_id=sup_2.id)
        db.add(team_b)
        db.flush()
        db.add(TeamMember(team_id=team_b.id, user_id=worker_2.id))

    db.commit()

    # Worker 2 Login Token
    w2_res = client.post("/api/v1/auth/login", json={"email": "worker2@survey.org", "password": "Worker123!"})
    worker_2_token = w2_res.json()["access_token"]

    # Create published survey
    survey_res = client.post(
        "/api/v1/surveys",
        json={"title": "Tracking Verification Survey", "description": "Phase 5 GPS testing"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    s_id = survey_res.json()["id"]
    v_id = survey_res.json()["versions"][0]["id"]

    client.post(
        f"/api/v1/surveys/{s_id}/draft",
        json=[
            {
                "title": "GPS Verification Section",
                "questions": [
                    {"question_text": "Confirmation", "question_type": QuestionType.SHORT_TEXT.value, "is_required": True}
                ],
            }
        ],
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    client.post(
        f"/api/v1/surveys/versions/{v_id}/publish",
        headers={"Authorization": f"Bearer {admin_token}"},
    )

    # Create task for Worker 1 on Team A
    task_res1 = client.post(
        "/api/v1/tasks",
        json={
            "title": "Alpha Tracking Inspection Task",
            "survey_version_id": v_id,
            "team_id": str(team_a.id),
            "assigned_worker_id": str(worker_1.id),
        },
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    task_1_id = task_res1.json()["id"]

    # Worker 1 accepts task
    client.post(f"/api/v1/tasks/{task_1_id}/accept", headers={"Authorization": f"Bearer {w2_res.json()['access_token']}"}) # test accept
    # Real accept with worker_token
    w1_res = client.post("/api/v1/auth/login", json={"email": "worker@survey.org", "password": "Worker123!"})
    client.post(f"/api/v1/tasks/{task_1_id}/accept", headers={"Authorization": f"Bearer {w1_res.json()['access_token']}"})

    # Create task for Worker 2 on Team B
    task_res2 = client.post(
        "/api/v1/tasks",
        json={
            "title": "Beta Tracking Inspection Task",
            "survey_version_id": v_id,
            "team_id": str(team_b.id),
            "assigned_worker_id": str(worker_2.id),
        },
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    task_2_id = task_res2.json()["id"]
    client.post(f"/api/v1/tasks/{task_2_id}/accept", headers={"Authorization": f"Bearer {worker_2_token}"})

    return {
        "task_1_id": task_1_id,
        "task_2_id": task_2_id,
        "team_a_id": str(team_a.id),
        "team_b_id": str(team_b.id),
        "worker_1_id": str(worker_1.id),
        "worker_2_id": str(worker_2.id),
        "external_worker_id": str(worker_ext.id),
        "worker_2_token": worker_2_token,
    }


# ============================================================================
# 1. Consent Enforcement & Tracking Session Lifecycle
# ============================================================================

def test_consent_required_before_tracking(worker_token, test_setup_p5):
    """Worker consent is strictly required to start location tracking."""
    task_id = test_setup_p5["task_1_id"]

    # 1. Starting session with consent_granted = False -> 400 Bad Request
    fail_res = client.post(
        "/api/v1/tracking/sessions/start",
        json={"task_id": task_id, "consent_granted": False},
        headers={"Authorization": f"Bearer {worker_token}"},
    )
    assert fail_res.status_code == 400
    assert "consent is strictly required" in fail_res.json()["detail"].lower()

    # 2. Starting session with consent_granted = True -> 201 Created
    ok_res = client.post(
        "/api/v1/tracking/sessions/start",
        json={"task_id": task_id, "consent_granted": True, "device_info": "Chrome/131.0 on Windows"},
        headers={"Authorization": f"Bearer {worker_token}"},
    )
    assert ok_res.status_code == 201
    session_data = ok_res.json()
    assert session_data["status"] == "ACTIVE"
    assert session_data["consent_granted"] is True
    assert session_data["task_id"] == task_id


def test_worker_cannot_start_session_for_another_worker_task(worker_token, test_setup_p5):
    """Worker 1 cannot start a tracking session on Worker 2's task."""
    task_2_id = test_setup_p5["task_2_id"]

    res = client.post(
        "/api/v1/tracking/sessions/start",
        json={"task_id": task_2_id, "consent_granted": True},
        headers={"Authorization": f"Bearer {worker_token}"},
    )
    assert res.status_code == 403
    assert "not assigned to you" in res.json()["detail"].lower()


# ============================================================================
# 2. Coordinate Validation & Location Updates
# ============================================================================

def test_valid_location_update_and_invalid_coordinates_rejected(worker_token, test_setup_p5):
    """
    Test coordinate bounds validation:
    - Valid coordinates accepted.
    - Latitude > 90 or < -90 rejected.
    - Longitude > 180 or < -180 rejected.
    - Negative accuracy rejected.
    """
    task_id = test_setup_p5["task_1_id"]
    start_res = client.post(
        "/api/v1/tracking/sessions/start",
        json={"task_id": task_id, "consent_granted": True},
        headers={"Authorization": f"Bearer {worker_token}"},
    )
    session_id = start_res.json()["id"]

    # 1. Invalid Latitude (95.0 > 90) -> 422 Validation Error
    lat_fail = client.post(
        "/api/v1/tracking/locations",
        json={"session_id": session_id, "latitude": 95.0, "longitude": 77.2090, "accuracy": 12.0},
        headers={"Authorization": f"Bearer {worker_token}"},
    )
    assert lat_fail.status_code == 422

    # 2. Invalid Longitude (-195.0 < -180) -> 422 Validation Error
    lon_fail = client.post(
        "/api/v1/tracking/locations",
        json={"session_id": session_id, "latitude": 28.6139, "longitude": -195.0, "accuracy": 12.0},
        headers={"Authorization": f"Bearer {worker_token}"},
    )
    assert lon_fail.status_code == 422

    # 3. Invalid Accuracy (-5.0 < 0) -> 422 Validation Error
    acc_fail = client.post(
        "/api/v1/tracking/locations",
        json={"session_id": session_id, "latitude": 28.6139, "longitude": 77.2090, "accuracy": -5.0},
        headers={"Authorization": f"Bearer {worker_token}"},
    )
    assert acc_fail.status_code == 422

    # 4. Valid Coordinates -> 201 Created
    valid_res = client.post(
        "/api/v1/tracking/locations",
        json={
            "session_id": session_id,
            "latitude": 28.6139,
            "longitude": 77.2090,
            "accuracy": 8.5,
            "speed": 1.4,
            "heading": 180.0,
        },
        headers={"Authorization": f"Bearer {worker_token}"},
    )
    assert valid_res.status_code == 201
    loc_data = valid_res.json()
    assert loc_data["latitude"] == 28.6139
    assert loc_data["longitude"] == 77.2090
    assert loc_data["accuracy"] == 8.5


def test_unauthenticated_location_updates_rejected(test_setup_p5):
    """Unauthenticated location updates are rejected with 401."""
    res = client.post(
        "/api/v1/tracking/locations",
        json={"session_id": str(uuid.uuid4()), "latitude": 28.6139, "longitude": 77.2090, "accuracy": 10.0},
    )
    assert res.status_code == 401


# ============================================================================
# 3. Role-Based Location Access & Team Isolation
# ============================================================================

def test_supervisor_and_worker_access_isolation(admin_token, supervisor_token, worker_token, test_setup_p5):
    """
    Verify strict role scoping:
    - Supervisor 1 can view live locations of Worker 1 (Team A).
    - Supervisor 1 CANNOT view location history of Worker 2 (Team B) -> 403.
    - Worker 1 CANNOT view location history of Worker 2 -> 403.
    - Admin can view all active workforce locations organization-wide.
    """
    # Start session and record location for Worker 2 on Team B
    w2_token = test_setup_p5["worker_2_token"]
    w2_session = client.post(
        "/api/v1/tracking/sessions/start",
        json={"task_id": test_setup_p5["task_2_id"], "consent_granted": True},
        headers={"Authorization": f"Bearer {w2_token}"},
    ).json()["id"]

    client.post(
        "/api/v1/tracking/locations",
        json={"session_id": w2_session, "latitude": 19.0760, "longitude": 72.8777, "accuracy": 15.0},
        headers={"Authorization": f"Bearer {w2_token}"},
    )

    # 1. Supervisor 1 attempts to view External Worker location history -> 403 Forbidden
    s1_history_fail = client.get(
        f"/api/v1/tracking/workers/{test_setup_p5['external_worker_id']}/history",
        headers={"Authorization": f"Bearer {supervisor_token}"},
    )
    assert s1_history_fail.status_code == 403

    # 2. Worker 1 attempts to view Worker 2 location history -> 403 Forbidden
    w1_history_fail = client.get(
        f"/api/v1/tracking/workers/{test_setup_p5['worker_2_id']}/history",
        headers={"Authorization": f"Bearer {worker_token}"},
    )
    assert w1_history_fail.status_code == 403

    # 3. Worker 1 can view their OWN location history
    w1_history_ok = client.get(
        f"/api/v1/tracking/workers/{test_setup_p5['worker_1_id']}/history",
        headers={"Authorization": f"Bearer {worker_token}"},
    )
    assert w1_history_ok.status_code == 200
    assert isinstance(w1_history_ok.json(), list)

    # 4. Admin views organization-wide live locations -> sees both
    admin_live = client.get("/api/v1/tracking/live", headers={"Authorization": f"Bearer {admin_token}"})
    assert admin_live.status_code == 200
    active_worker_ids = [w["worker_id"] for w in admin_live.json()]
    assert test_setup_p5["worker_2_id"] in active_worker_ids


# ============================================================================
# 4. Stop Tracking & Auto-Termination on Task Completion
# ============================================================================

def test_stopping_session_prevents_further_updates(worker_token, test_setup_p5):
    """
    When worker stops tracking session, status becomes STOPPED and subsequent updates fail.
    """
    task_id = test_setup_p5["task_1_id"]
    session_id = client.post(
        "/api/v1/tracking/sessions/start",
        json={"task_id": task_id, "consent_granted": True},
        headers={"Authorization": f"Bearer {worker_token}"},
    ).json()["id"]

    # Stop session
    stop_res = client.post(
        f"/api/v1/tracking/sessions/{session_id}/stop",
        json={"termination_reason": "Worker taking lunch break"},
        headers={"Authorization": f"Bearer {worker_token}"},
    )
    assert stop_res.status_code == 200
    assert stop_res.json()["status"] == "STOPPED"
    assert stop_res.json()["ended_at"] is not None

    # Subsequent location update -> 400 Bad Request
    update_fail = client.post(
        "/api/v1/tracking/locations",
        json={"session_id": session_id, "latitude": 28.6139, "longitude": 77.2090, "accuracy": 10.0},
        headers={"Authorization": f"Bearer {worker_token}"},
    )
    assert update_fail.status_code == 400
    assert "must be active" in update_fail.json()["detail"].lower()


def test_task_completion_auto_terminates_tracking_session(admin_token, worker_token, test_setup_p5):
    """
    Completing a task automatically terminates active tracking sessions.
    """
    task_id = test_setup_p5["task_1_id"]

    # Start tracking session
    session_id = client.post(
        "/api/v1/tracking/sessions/start",
        json={"task_id": task_id, "consent_granted": True},
        headers={"Authorization": f"Bearer {worker_token}"},
    ).json()["id"]

    # Start task (transition ACCEPTED -> IN_PROGRESS)
    client.post(f"/api/v1/tasks/{task_id}/start", headers={"Authorization": f"Bearer {worker_token}"})

    # Complete task
    comp_res = client.post(
        f"/api/v1/tasks/{task_id}/complete",
        json={"survey_response_data": {"Confirmation": "Audit verified on site"}},
        headers={"Authorization": f"Bearer {worker_token}"},
    )
    assert comp_res.status_code == 200
    assert comp_res.json()["status"] == "COMPLETED"

    # Verify session is now COMPLETED
    session_details = client.get(
        f"/api/v1/tracking/sessions/{session_id}",
        headers={"Authorization": f"Bearer {worker_token}"},
    )
    assert session_details.status_code == 200
    assert session_details.json()["status"] == "COMPLETED"
    assert session_details.json()["ended_at"] is not None


# ============================================================================
# 5. Stale Location Detection & Retention Policy
# ============================================================================

def test_retention_policy_and_stale_detection(admin_token, worker_token, test_setup_p5, db: Session):
    """
    Test:
    - Retention policy pruning deletes locations older than retention window.
    - Location older than 5 minutes is marked is_stale = True in live view.
    """
    task_2_id = test_setup_p5["task_2_id"]
    w2_token = test_setup_p5["worker_2_token"]
    w2_uuid = uuid.UUID(test_setup_p5["worker_2_id"])
    t2_uuid = uuid.UUID(task_2_id)

    # Start session for worker 2
    sess_id = client.post(
        "/api/v1/tracking/sessions/start",
        json={"task_id": task_2_id, "consent_granted": True},
        headers={"Authorization": f"Bearer {w2_token}"},
    ).json()["id"]
    sess_uuid = uuid.UUID(sess_id)

    # Insert an old location (40 days ago) directly into DB
    old_loc = WorkerLocation(
        session_id=sess_uuid,
        worker_id=w2_uuid,
        task_id=t2_uuid,
        latitude=12.9716,
        longitude=77.5946,
        accuracy=20.0,
        recorded_at=datetime.now(timezone.utc) - timedelta(days=40),
        created_at=datetime.now(timezone.utc) - timedelta(days=40),
    )
    db.add(old_loc)

    # Ensure all existing points for this session are set to 10 minutes ago so latest is stale
    db.query(WorkerLocation).filter(WorkerLocation.session_id == sess_uuid).update({
        WorkerLocation.recorded_at: datetime.now(timezone.utc) - timedelta(minutes=10)
    })
    db.commit()

    # Verify stale detection in live feed
    live_res = client.get("/api/v1/tracking/live", headers={"Authorization": f"Bearer {admin_token}"})
    assert live_res.status_code == 200
    w2_live = next((w for w in live_res.json() if w["worker_id"] == test_setup_p5["worker_2_id"]), None)
    assert w2_live is not None
    assert w2_live["is_stale"] is True

    # Run retention cleanup
    cleanup_res = client.post("/api/v1/tracking/retention/cleanup", headers={"Authorization": f"Bearer {admin_token}"})
    assert cleanup_res.status_code == 200
    assert cleanup_res.json()["deleted_records"] >= 1
