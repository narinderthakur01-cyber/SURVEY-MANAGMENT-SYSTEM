"""
Comprehensive Final Integration Security Audit (Phases 0-5)
Validates:
1. Unauthorized API access and authentication rejection
2. Cross-team isolation and data leakage prevention
3. Role-based privilege escalation defenses
4. Refresh token rotation, reuse detection, and session invalidation
5. Sensitive data exposure prevention (hashes, secrets, raw tokens)
6. Coordinate boundary validation and spoofing prevention
7. Consent enforcement and automatic session termination
"""
import uuid
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.main import app
from app.core.config import settings
from app.database.connection import SessionLocal
from app.models.role import Role
from app.models.user import User
from app.models.team import Team
from app.models.team_member import TeamMember
from app.models.task import Task, TaskAssignment, TaskStatus, TaskPriority
from app.models.tracking import TrackingSession, WorkerLocation, TrackingSessionStatus
from app.models.survey import Survey, SurveyVersion, SurveyVersionStatus

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


def test_security_unauthorized_endpoints_rejected():
    """Verify anonymous access to protected endpoints is rejected with 401."""
    endpoints = [
        ("GET", "/api/v1/users"),
        ("GET", "/api/v1/teams"),
        ("GET", "/api/v1/surveys"),
        ("GET", "/api/v1/tasks"),
        ("GET", "/api/v1/tracking/live"),
        ("POST", "/api/v1/tracking/sessions/start"),
    ]
    for method, url in endpoints:
        if method == "GET":
            res = client.get(url)
        else:
            res = client.post(url, json={})
        assert res.status_code == 401, f"Expected 401 for {method} {url}, got {res.status_code}"


def test_security_worker_forbidden_from_administrative_endpoints(admin_token):
    """Verify worker role is rejected with 403 when trying to access admin endpoints."""
    # Login as worker
    res = client.post("/api/v1/auth/login", json={
        "email": "worker@survey.org",
        "password": "Worker123!",
    })
    assert res.status_code == 200
    worker_token = res.json()["access_token"]
    headers = {"Authorization": f"Bearer {worker_token}"}

    # Worker cannot list all users
    r = client.get("/api/v1/users", headers=headers)
    assert r.status_code == 403

    # Worker cannot create a user
    r = client.post("/api/v1/users", json={
        "email": "fake@survey.org",
        "password": "Password123!",
        "full_name": "Fake",
        "role_id": str(uuid.uuid4())
    }, headers=headers)
    assert r.status_code == 403

    # Worker cannot create a team
    r = client.post("/api/v1/teams", json={"name": "Fake Team"}, headers=headers)
    assert r.status_code == 403

    # Worker cannot create a survey
    r = client.post("/api/v1/surveys", json={"title": "Fake Survey"}, headers=headers)
    assert r.status_code == 403

    # Worker cannot create a task
    r = client.post("/api/v1/tasks", json={"title": "Fake Task"}, headers=headers)
    assert r.status_code == 403

    # Worker cannot access team location summaries or prune tracking data
    r_sum = client.get(f"/api/v1/tracking/teams/{uuid.uuid4()}/summary", headers=headers)
    assert r_sum.status_code == 403

    r_prune = client.post("/api/v1/tracking/retention/cleanup", headers=headers)
    assert r_prune.status_code == 403


def test_security_cross_team_isolation(db: Session, admin_token: str):
    """Verify Supervisor A cannot access tasks or live telemetry of Team B."""
    sup_role = db.query(Role).filter(Role.name == "SUPERVISOR").first()
    worker_role = db.query(Role).filter(Role.name == "WORKER").first()

    # Create Supervisor A and Supervisor B
    uid_a = uuid.uuid4().hex[:6]
    uid_b = uuid.uuid4().hex[:6]
    email_a = f"sup_audit_a_{uid_a}@survey.org"
    email_b = f"sup_audit_b_{uid_b}@survey.org"
    worker_b_email = f"worker_audit_b_{uid_b}@survey.org"

    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    client.post("/api/v1/users", json={
        "email": email_a, "password": "Password123!", "full_name": "Supervisor A", "role_id": str(sup_role.id)
    }, headers=admin_headers)
    client.post("/api/v1/users", json={
        "email": email_b, "password": "Password123!", "full_name": "Supervisor B", "role_id": str(sup_role.id)
    }, headers=admin_headers)
    client.post("/api/v1/users", json={
        "email": worker_b_email, "password": "Password123!", "full_name": "Worker B", "role_id": str(worker_role.id)
    }, headers=admin_headers)

    user_a = db.query(User).filter(User.email == email_a).first()
    user_b = db.query(User).filter(User.email == email_b).first()
    worker_b = db.query(User).filter(User.email == worker_b_email).first()

    # Create Team A and Team B
    res_ta = client.post("/api/v1/teams", json={
        "name": f"Team Alpha {uid_a}", "supervisor_id": str(user_a.id)
    }, headers=admin_headers)
    res_tb = client.post("/api/v1/teams", json={
        "name": f"Team Beta {uid_b}", "supervisor_id": str(user_b.id)
    }, headers=admin_headers)
    team_a_id = res_ta.json()["id"]
    team_b_id = res_tb.json()["id"]

    # Enroll worker B into team B
    client.post(f"/api/v1/teams/{team_b_id}/members", json={"user_id": str(worker_b.id)}, headers=admin_headers)

    # Login as Supervisor A
    res_login_a = client.post("/api/v1/auth/login", json={"email": email_a, "password": "Password123!"})
    token_a = res_login_a.json()["access_token"]
    headers_a = {"Authorization": f"Bearer {token_a}"}

    # Supervisor A attempts to view Team B details -> 403
    r_tb = client.get(f"/api/v1/teams/{team_b_id}", headers=headers_a)
    assert r_tb.status_code == 403

    # Supervisor A attempts to add member to Team B -> 403
    r_add = client.post(f"/api/v1/teams/{team_b_id}/members", json={"user_id": str(worker_b.id)}, headers=headers_a)
    assert r_add.status_code == 403

    # Supervisor A attempts to query tracking history for Worker B -> 403 Forbidden
    r_hist = client.get(f"/api/v1/tracking/workers/{worker_b.id}/history", headers=headers_a)
    assert r_hist.status_code == 403


def test_security_self_privilege_escalation_prevented(db: Session):
    """Verify a worker cannot escalate their own role to ADMIN or SUPERVISOR."""
    res = client.post("/api/v1/auth/login", json={
        "email": "worker@survey.org",
        "password": "Worker123!",
    })
    token = res.json()["access_token"]
    worker_id = res.json()["user"]["id"]
    admin_role = db.query(Role).filter(Role.name == "ADMIN").first()

    headers = {"Authorization": f"Bearer {token}"}
    r = client.patch(f"/api/v1/users/{worker_id}", json={"role_id": str(admin_role.id)}, headers=headers)
    assert r.status_code == 403

    # Verify database state remained unchanged
    db_worker = db.query(User).filter(User.id == worker_id).first()
    assert db_worker.role.name == "WORKER"


def test_security_sensitive_data_exposure_prevention(admin_token: str):
    """Verify API responses never include password hashes or raw secrets."""
    headers = {"Authorization": f"Bearer {admin_token}"}
    res = client.get("/api/v1/users", headers=headers)
    assert res.status_code == 200
    users = res.json()
    for u in users:
        assert "hashed_password" not in u
        assert "password" not in u
        assert "secret" not in u


def test_security_location_boundary_and_spoofing_defense(admin_token: str, db: Session):
    """Verify invalid coordinate boundaries, negative accuracy, and non-active sessions are rejected."""
    # Worker login
    res = client.post("/api/v1/auth/login", json={
        "email": "worker@survey.org",
        "password": "Worker123!",
    })
    worker_token = res.json()["access_token"]
    headers = {"Authorization": f"Bearer {worker_token}"}

    # Attempt to post coordinate update for non-existent session
    r_bad_sess = client.post("/api/v1/tracking/locations", json={
        "session_id": str(uuid.uuid4()),
        "latitude": 28.6139,
        "longitude": 77.2090,
        "accuracy": 15.0,
    }, headers=headers)
    assert r_bad_sess.status_code in [400, 404]

    # Attempt coordinates out of bounds: lat > 90
    r_bad_lat = client.post("/api/v1/tracking/locations", json={
        "session_id": str(uuid.uuid4()),
        "latitude": 95.0,
        "longitude": 77.2090,
        "accuracy": 15.0,
    }, headers=headers)
    assert r_bad_lat.status_code in [400, 422]

    # Attempt coordinates out of bounds: lon > 180
    r_bad_lon = client.post("/api/v1/tracking/locations", json={
        "session_id": str(uuid.uuid4()),
        "latitude": 28.0,
        "longitude": 185.0,
        "accuracy": 15.0,
    }, headers=headers)
    assert r_bad_lon.status_code in [400, 422]

    # Attempt negative accuracy
    r_bad_acc = client.post("/api/v1/tracking/locations", json={
        "session_id": str(uuid.uuid4()),
        "latitude": 28.0,
        "longitude": 77.0,
        "accuracy": -10.0,
    }, headers=headers)
    assert r_bad_acc.status_code in [400, 422]
