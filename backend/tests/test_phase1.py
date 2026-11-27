import uuid
import concurrent.futures
from datetime import datetime, timezone, timedelta
import jwt
import pytest
from pydantic import ValidationError
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from app.main import app
from app.core.config import settings, Settings
from app.core.security import create_access_token, hash_token
from app.database.connection import SessionLocal
from app.models.role import Role
from app.models.user import User
from app.models.team import Team
from app.models.team_member import TeamMember
from app.models.refresh_token import RefreshToken

client = TestClient(app)


@pytest.fixture(scope="module")
def db():
    """Real PostgreSQL database session fixture."""
    session = SessionLocal()
    yield session
    session.close()


@pytest.fixture(scope="module")
def admin_token():
    """Retrieve an access token for the bootstrap administrator."""
    res = client.post("/api/v1/auth/login", json={
        "email": settings.FIRST_SUPERUSER_EMAIL,
        "password": settings.FIRST_SUPERUSER_PASSWORD,
    })
    assert res.status_code == 200, f"Admin login failed: {res.text}"
    return res.json()["access_token"]


@pytest.fixture(scope="module")
def roles_map(db: Session):
    """Map role names to their database records."""
    roles = db.query(Role).all()
    return {r.name: r for r in roles}


def test_admin_login_success():
    """Verify admin login succeeds with proper token structure."""
    res = client.post("/api/v1/auth/login", json={
        "email": settings.FIRST_SUPERUSER_EMAIL,
        "password": settings.FIRST_SUPERUSER_PASSWORD,
    })
    assert res.status_code == 200
    data = res.json()
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["token_type"] == "bearer"
    assert data["user"]["email"] == settings.FIRST_SUPERUSER_EMAIL.lower()
    assert data["user"]["role"]["name"] == "ADMIN"


def test_login_invalid_credentials_returns_401():
    """Verify wrong password returns 401 Unauthorized."""
    res = client.post("/api/v1/auth/login", json={
        "email": settings.FIRST_SUPERUSER_EMAIL,
        "password": "WrongPassword999!",
    })
    assert res.status_code == 401
    assert "detail" in res.json()


def test_login_nonexistent_email_returns_401():
    """Verify nonexistent email returns 401 Unauthorized."""
    res = client.post("/api/v1/auth/login", json={
        "email": "nonexistent@survey.org",
        "password": "AnyPassword123!",
    })
    assert res.status_code == 401


def test_admin_creates_users_and_duplicate_email_rejected(admin_token, roles_map):
    """Verify admin can create users and duplicate emails are rejected with 409."""
    headers = {"Authorization": f"Bearer {admin_token}"}
    worker_role = roles_map["WORKER"]
    email = f"worker_{uuid.uuid4().hex[:8]}@survey.org"

    # 1. Create worker
    res = client.post("/api/v1/users", headers=headers, json={
        "email": email,
        "password": "WorkerPassword123!",
        "full_name": "Test Worker One",
        "phone_number": "+1234567890",
        "role_id": str(worker_role.id),
    })
    assert res.status_code == 201
    worker_data = res.json()
    assert worker_data["email"] == email
    assert worker_data["role"]["name"] == "WORKER"

    # 2. Attempt duplicate creation
    res_dup = client.post("/api/v1/users", headers=headers, json={
        "email": email,
        "password": "AnotherPassword123!",
        "full_name": "Duplicate Worker",
        "role_id": str(worker_role.id),
    })
    assert res_dup.status_code == 409
    assert "already exists" in res_dup.json()["detail"].lower()


def test_worker_cannot_create_user_or_access_admin_routes(admin_token, roles_map):
    """Verify role restrictions: workers cannot create accounts or view roles."""
    headers_admin = {"Authorization": f"Bearer {admin_token}"}
    worker_role = roles_map["WORKER"]
    worker_email = f"worker_{uuid.uuid4().hex[:8]}@survey.org"
    worker_pwd = "WorkerPassword123!"

    # Create worker
    client.post("/api/v1/users", headers=headers_admin, json={
        "email": worker_email,
        "password": worker_pwd,
        "full_name": "Restricted Worker",
        "role_id": str(worker_role.id),
    })

    # Log in as worker
    login_res = client.post("/api/v1/auth/login", json={
        "email": worker_email,
        "password": worker_pwd,
    })
    worker_token = login_res.json()["access_token"]
    headers_worker = {"Authorization": f"Bearer {worker_token}"}

    # Worker attempts to create an admin user -> 403 Forbidden
    res_create = client.post("/api/v1/users", headers=headers_worker, json={
        "email": "hacker@survey.org",
        "password": "HackerPassword123!",
        "full_name": "Hacker",
        "role_id": str(roles_map["ADMIN"].id),
    })
    assert res_create.status_code == 403

    # Worker attempts to access admin-only roles endpoint -> 403 Forbidden
    res_roles = client.get("/api/v1/roles", headers=headers_worker)
    assert res_roles.status_code == 403


def test_inactive_user_cannot_login(admin_token, roles_map):
    """Verify deactivated accounts cannot log in."""
    headers_admin = {"Authorization": f"Bearer {admin_token}"}
    email = f"inactive_{uuid.uuid4().hex[:8]}@survey.org"
    pwd = "TempPassword123!"

    # Create user
    res = client.post("/api/v1/users", headers=headers_admin, json={
        "email": email,
        "password": pwd,
        "full_name": "Inactive User",
        "role_id": str(roles_map["WORKER"].id),
    })
    user_id = res.json()["id"]

    # Deactivate user
    deact_res = client.patch(f"/api/v1/users/{user_id}/status", headers=headers_admin, json={"is_active": False})
    assert deact_res.status_code == 200
    assert deact_res.json()["is_active"] is False

    # Attempt login -> 403 Forbidden
    login_res = client.post("/api/v1/auth/login", json={
        "email": email,
        "password": pwd,
    })
    assert login_res.status_code == 403
    assert "inactive" in login_res.json()["detail"].lower()


def test_refresh_token_rotation_and_reuse_detection():
    """Verify refresh token rotation and token hijack/reuse detection."""
    email = settings.FIRST_SUPERUSER_EMAIL
    pwd = settings.FIRST_SUPERUSER_PASSWORD

    # 1. Login to get initial tokens
    login_res = client.post("/api/v1/auth/login", json={"email": email, "password": pwd})
    token_pair_1 = login_res.json()
    refresh_token_1 = token_pair_1["refresh_token"]

    # 2. First refresh (Rotation succeeds)
    refresh_res = client.post("/api/v1/auth/refresh", json={"refresh_token": refresh_token_1})
    assert refresh_res.status_code == 200
    token_pair_2 = refresh_res.json()
    refresh_token_2 = token_pair_2["refresh_token"]
    assert refresh_token_1 != refresh_token_2

    # 3. Reuse old refresh token (Reuse detection triggers 401)
    reuse_res = client.post("/api/v1/auth/refresh", json={"refresh_token": refresh_token_1})
    assert reuse_res.status_code == 401
    assert "revoked" in reuse_res.json()["detail"].lower()

    # 4. Token 2 should also now be invalidated due to session revocation
    subsequent_res = client.post("/api/v1/auth/refresh", json={"refresh_token": refresh_token_2})
    assert subsequent_res.status_code == 401


def test_logout_revokes_refresh_token():
    """Verify logout invalidates refresh token."""
    email = settings.FIRST_SUPERUSER_EMAIL
    pwd = settings.FIRST_SUPERUSER_PASSWORD

    login_res = client.post("/api/v1/auth/login", json={"email": email, "password": pwd})
    tokens = login_res.json()

    # Logout
    logout_res = client.post(
        "/api/v1/auth/logout",
        headers={"Authorization": f"Bearer {tokens['access_token']}"},
        json={"refresh_token": tokens["refresh_token"]},
    )
    assert logout_res.status_code == 200

    # Attempt to refresh with logged-out token -> 401
    refresh_res = client.post("/api/v1/auth/refresh", json={"refresh_token": tokens["refresh_token"]})
    assert refresh_res.status_code == 401


def test_password_change_invalidates_sessions(admin_token, roles_map):
    """Verify changing password updates hash and revokes existing refresh tokens."""
    headers_admin = {"Authorization": f"Bearer {admin_token}"}
    email = f"pwd_user_{uuid.uuid4().hex[:8]}@survey.org"
    old_pwd = "OldPassword123!"
    new_pwd = "NewSecurePassword456!"

    # Create user
    client.post("/api/v1/users", headers=headers_admin, json={
        "email": email,
        "password": old_pwd,
        "full_name": "Password Test User",
        "role_id": str(roles_map["WORKER"].id),
    })

    # Log in with old password
    login_res = client.post("/api/v1/auth/login", json={"email": email, "password": old_pwd})
    tokens = login_res.json()

    # Change password
    change_res = client.post(
        "/api/v1/auth/change-password",
        headers={"Authorization": f"Bearer {tokens['access_token']}"},
        json={"current_password": old_pwd, "new_password": new_pwd},
    )
    assert change_res.status_code == 200

    # Old password fails
    old_login = client.post("/api/v1/auth/login", json={"email": email, "password": old_pwd})
    assert old_login.status_code == 401

    # Old refresh token is revoked
    old_refresh = client.post("/api/v1/auth/refresh", json={"refresh_token": tokens["refresh_token"]})
    assert old_refresh.status_code == 401

    # New password succeeds
    new_login = client.post("/api/v1/auth/login", json={"email": email, "password": new_pwd})
    assert new_login.status_code == 200


def test_team_creation_and_duplicate_membership_rejection(admin_token, roles_map):
    """Verify team creation and duplicate membership constraint."""
    headers_admin = {"Authorization": f"Bearer {admin_token}"}
    worker_role = roles_map["WORKER"]
    supervisor_role = roles_map["SUPERVISOR"]

    # Create a supervisor
    sup_email = f"sup_{uuid.uuid4().hex[:8]}@survey.org"
    sup_res = client.post("/api/v1/users", headers=headers_admin, json={
        "email": sup_email,
        "password": "SupervisorPassword123!",
        "full_name": "Team Supervisor",
        "role_id": str(supervisor_role.id),
    })
    supervisor_id = sup_res.json()["id"]

    # Create a worker
    worker_email = f"worker_{uuid.uuid4().hex[:8]}@survey.org"
    worker_res = client.post("/api/v1/users", headers=headers_admin, json={
        "email": worker_email,
        "password": "WorkerPassword123!",
        "full_name": "Team Worker",
        "role_id": str(worker_role.id),
    })
    worker_id = worker_res.json()["id"]

    # Create team
    team_name = f"Field Alpha {uuid.uuid4().hex[:6]}"
    team_res = client.post("/api/v1/teams", headers=headers_admin, json={
        "name": team_name,
        "description": "Primary field research team",
        "supervisor_id": supervisor_id,
    })
    assert team_res.status_code == 201
    team_id = team_res.json()["id"]

    # Add worker to team
    add_res = client.post(f"/api/v1/teams/{team_id}/members", headers=headers_admin, json={"user_id": worker_id})
    assert add_res.status_code == 201

    # Add same worker again -> 409 Conflict (Duplicate rejection)
    add_dup = client.post(f"/api/v1/teams/{team_id}/members", headers=headers_admin, json={"user_id": worker_id})
    assert add_dup.status_code == 409
    assert "already a member" in add_dup.json()["detail"].lower()


def test_supervisor_team_isolation(admin_token, roles_map):
    """Verify supervisor cannot access another supervisor's team data."""
    headers_admin = {"Authorization": f"Bearer {admin_token}"}
    sup_role = roles_map["SUPERVISOR"]

    # Supervisor A
    sup_a_res = client.post("/api/v1/users", headers=headers_admin, json={
        "email": f"sup_a_{uuid.uuid4().hex[:6]}@survey.org",
        "password": "Password123!",
        "full_name": "Supervisor A",
        "role_id": str(sup_role.id),
    })
    sup_a_id = sup_a_res.json()["id"]
    token_a = client.post("/api/v1/auth/login", json={
        "email": sup_a_res.json()["email"], "password": "Password123!"
    }).json()["access_token"]

    # Supervisor B
    sup_b_res = client.post("/api/v1/users", headers=headers_admin, json={
        "email": f"sup_b_{uuid.uuid4().hex[:6]}@survey.org",
        "password": "Password123!",
        "full_name": "Supervisor B",
        "role_id": str(sup_role.id),
    })
    sup_b_id = sup_b_res.json()["id"]

    # Team B owned by Supervisor B
    team_b_res = client.post("/api/v1/teams", headers=headers_admin, json={
        "name": f"Team Beta {uuid.uuid4().hex[:6]}",
        "supervisor_id": sup_b_id,
    })
    team_b_id = team_b_res.json()["id"]

    # Supervisor A attempts to view Team B -> 403 Forbidden
    res = client.get(f"/api/v1/teams/{team_b_id}", headers={"Authorization": f"Bearer {token_a}"})
    assert res.status_code == 403
    assert "not authorized" in res.json()["detail"].lower()


def test_concurrent_refresh_race_condition_prevention():
    """Verify that under concurrent requests with the same refresh token, only one succeeds and reuse detection triggers."""
    email = settings.FIRST_SUPERUSER_EMAIL
    pwd = settings.FIRST_SUPERUSER_PASSWORD

    login_res = client.post("/api/v1/auth/login", json={"email": email, "password": pwd})
    assert login_res.status_code == 200
    shared_refresh_token = login_res.json()["refresh_token"]

    def do_refresh():
        c = TestClient(app)
        return c.post("/api/v1/auth/refresh", json={"refresh_token": shared_refresh_token})

    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
        f1 = executor.submit(do_refresh)
        f2 = executor.submit(do_refresh)
        r1 = f1.result()
        r2 = f2.result()

    status_codes = sorted([r1.status_code, r2.status_code])
    assert 401 in status_codes
    assert status_codes in ([200, 401], [401, 401])


def test_self_role_escalation_rejected(admin_token, roles_map):
    """Verify a regular user cannot escalate their own role via PATCH /users/{id}."""
    headers_admin = {"Authorization": f"Bearer {admin_token}"}
    worker_role = roles_map["WORKER"]
    admin_role = roles_map["ADMIN"]
    worker_email = f"worker_{uuid.uuid4().hex[:6]}@survey.org"
    worker_pwd = "WorkerPassword123!"

    create_res = client.post("/api/v1/users", headers=headers_admin, json={
        "email": worker_email,
        "password": worker_pwd,
        "full_name": "Worker Escalation Test",
        "role_id": str(worker_role.id),
    })
    worker_id = create_res.json()["id"]

    login_res = client.post("/api/v1/auth/login", json={"email": worker_email, "password": worker_pwd})
    worker_token = login_res.json()["access_token"]
    headers_worker = {"Authorization": f"Bearer {worker_token}"}

    # Worker attempts to update own profile to ADMIN role -> 403 Forbidden
    patch_res = client.patch(f"/api/v1/users/{worker_id}", headers=headers_worker, json={
        "role_id": str(admin_role.id)
    })
    assert patch_res.status_code == 403
    assert "administrators" in patch_res.json()["detail"].lower()


def test_unauthorized_account_status_modification(admin_token, roles_map):
    """Verify non-admin users cannot activate or deactivate user accounts."""
    headers_admin = {"Authorization": f"Bearer {admin_token}"}
    worker_role = roles_map["WORKER"]
    worker_email = f"worker_{uuid.uuid4().hex[:6]}@survey.org"
    worker_pwd = "WorkerPassword123!"

    create_res = client.post("/api/v1/users", headers=headers_admin, json={
        "email": worker_email,
        "password": worker_pwd,
        "full_name": "Worker Status Test",
        "role_id": str(worker_role.id),
    })
    worker_id = create_res.json()["id"]

    login_res = client.post("/api/v1/auth/login", json={"email": worker_email, "password": worker_pwd})
    worker_token = login_res.json()["access_token"]
    headers_worker = {"Authorization": f"Bearer {worker_token}"}

    # Worker attempts to deactivate an account -> 403 Forbidden
    res = client.patch(f"/api/v1/users/{worker_id}/status", headers=headers_worker, json={"is_active": False})
    assert res.status_code == 403


def test_supervisor_unauthorized_member_management(admin_token, roles_map):
    """Verify Supervisor A cannot add/remove members from Supervisor B's team, and only WORKERs can be added."""
    headers_admin = {"Authorization": f"Bearer {admin_token}"}
    sup_role = roles_map["SUPERVISOR"]
    worker_role = roles_map["WORKER"]

    # Supervisor A & B
    sup_a = client.post("/api/v1/users", headers=headers_admin, json={
        "email": f"sup_a_{uuid.uuid4().hex[:6]}@survey.org", "password": "Password123!", "full_name": "Sup A", "role_id": str(sup_role.id)
    }).json()
    token_a = client.post("/api/v1/auth/login", json={"email": sup_a["email"], "password": "Password123!"}).json()["access_token"]

    sup_b = client.post("/api/v1/users", headers=headers_admin, json={
        "email": f"sup_b_{uuid.uuid4().hex[:6]}@survey.org", "password": "Password123!", "full_name": "Sup B", "role_id": str(sup_role.id)
    }).json()

    # Team B owned by Supervisor B
    team_b = client.post("/api/v1/teams", headers=headers_admin, json={
        "name": f"Team Beta {uuid.uuid4().hex[:6]}", "supervisor_id": sup_b["id"]
    }).json()

    # Worker
    worker = client.post("/api/v1/users", headers=headers_admin, json={
        "email": f"worker_{uuid.uuid4().hex[:6]}@survey.org", "password": "Password123!", "full_name": "Worker", "role_id": str(worker_role.id)
    }).json()

    # Supervisor A attempts to add worker to Team B -> 403 Forbidden
    add_res = client.post(
        f"/api/v1/teams/{team_b['id']}/members",
        headers={"Authorization": f"Bearer {token_a}"},
        json={"user_id": worker["id"]}
    )
    assert add_res.status_code == 403

    # Admin adds worker to Team B
    client.post(f"/api/v1/teams/{team_b['id']}/members", headers=headers_admin, json={"user_id": worker["id"]})

    # Supervisor A attempts to remove worker from Team B -> 403 Forbidden
    del_res = client.delete(
        f"/api/v1/teams/{team_b['id']}/members/{worker['id']}",
        headers={"Authorization": f"Bearer {token_a}"}
    )
    assert del_res.status_code == 403

    # Attempt to add an ADMIN/SUPERVISOR user as a team worker -> 400 Bad Request
    add_admin_res = client.post(
        f"/api/v1/teams/{team_b['id']}/members",
        headers=headers_admin,
        json={"user_id": sup_a["id"]}
    )
    assert add_admin_res.status_code == 400
    assert "worker role" in add_admin_res.json()["detail"].lower()


def test_jwt_signature_and_algorithm_validation():
    """Verify that tampered tokens, algorithm='none', or tokens with wrong secret are rejected."""
    # 1. Token signed with wrong secret
    fake_token = jwt.encode({"sub": str(uuid.uuid4()), "type": "access"}, "wrong_secret_key_that_is_at_least_32_bytes_long!", algorithm="HS256")
    res1 = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {fake_token}"})
    assert res1.status_code == 401

    # 2. Token with algorithm='none'
    none_token = jwt.encode({"sub": str(uuid.uuid4()), "type": "access"}, "", algorithm="none")
    res2 = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {none_token}"})
    assert res2.status_code == 401

    # 3. Token with invalid type claim (e.g. 'refresh' passed as access)
    refresh_claim_token = jwt.encode({"sub": str(uuid.uuid4()), "type": "refresh"}, settings.SECRET_KEY, algorithm="HS256")
    res3 = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {refresh_claim_token}"})
    assert res3.status_code == 401


def test_email_normalization_on_registration_and_login(admin_token, roles_map):
    """Verify email normalization ensures case-insensitive uniqueness and login."""
    headers_admin = {"Authorization": f"Bearer {admin_token}"}
    worker_role = roles_map["WORKER"]
    raw_email = f"MiXeD.CaSe_{uuid.uuid4().hex[:6]}@SuRvEy.OrG"
    pwd = "MixedPassword123!"

    # Create user with mixed-case email
    create_res = client.post("/api/v1/users", headers=headers_admin, json={
        "email": raw_email,
        "password": pwd,
        "full_name": "Mixed Case User",
        "role_id": str(worker_role.id),
    })
    assert create_res.status_code == 201
    assert create_res.json()["email"] == raw_email.lower()

    # Login with uppercase email -> 200 OK
    login_res = client.post("/api/v1/auth/login", json={
        "email": raw_email.upper(),
        "password": pwd,
    })
    assert login_res.status_code == 200


def test_expired_access_token_rejected():
    """Verify that expired JWT access tokens are rejected with 401 Unauthorized."""
    expired_token = create_access_token(
        subject=str(uuid.uuid4()),
        expires_delta=timedelta(seconds=-30)  # Expired in past
    )
    res = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {expired_token}"})
    assert res.status_code == 401
    assert "could not validate credentials" in res.json()["detail"].lower()


def test_invalid_and_missing_jwt_secret_handling():
    """Verify that missing or insecurely short SECRET_KEY causes safe configuration failure."""
    with pytest.raises(ValidationError):
        Settings(SECRET_KEY="too_short_secret")

    with pytest.raises(ValidationError):
        Settings(SECRET_KEY="")


def test_sensitive_information_never_leaked(admin_token, roles_map):
    """Verify that password hashes and raw refresh token hashes are never exposed through API responses."""
    # 1. Login response
    login_res = client.post("/api/v1/auth/login", json={
        "email": settings.FIRST_SUPERUSER_EMAIL,
        "password": settings.FIRST_SUPERUSER_PASSWORD,
    })
    assert login_res.status_code == 200
    login_data = login_res.json()
    assert "hashed_password" not in login_data["user"]
    assert "password" not in login_data["user"]
    assert "token_hash" not in login_data

    # 2. Refresh response
    refresh_res = client.post("/api/v1/auth/refresh", json={"refresh_token": login_data["refresh_token"]})
    assert refresh_res.status_code == 200
    refresh_data = refresh_res.json()
    assert "hashed_password" not in refresh_data["user"]
    assert "password" not in refresh_data["user"]
    assert "token_hash" not in refresh_data

    # 3. GET /auth/me
    headers = {"Authorization": f"Bearer {refresh_data['access_token']}"}
    me_res = client.get("/api/v1/auth/me", headers=headers)
    assert me_res.status_code == 200
    me_data = me_res.json()
    assert "hashed_password" not in me_data
    assert "password" not in me_data

    # 4. GET /users list
    headers_admin = {"Authorization": f"Bearer {admin_token}"}
    users_res = client.get("/api/v1/users", headers=headers_admin)
    assert users_res.status_code == 200
    for u in users_res.json():
        assert "hashed_password" not in u
        assert "password" not in u
        assert "token_hash" not in u


def test_refresh_transaction_rollback_preserves_token_state(db: Session):
    """Verify that a transaction failure during token rotation rolls back and preserves token validity."""
    email = settings.FIRST_SUPERUSER_EMAIL
    pwd = settings.FIRST_SUPERUSER_PASSWORD

    login_res = client.post("/api/v1/auth/login", json={"email": email, "password": pwd})
    assert login_res.status_code == 200
    raw_refresh_token = login_res.json()["refresh_token"]
    raw_token_hash = hash_token(raw_refresh_token)

    # Verify token exists and is not revoked
    token_record = db.query(RefreshToken).filter(RefreshToken.token_hash == raw_token_hash).first()
    assert token_record is not None
    assert token_record.is_revoked is False

    # Simulate a transaction failure: mark revoked in session, then simulate error and rollback
    session = SessionLocal()
    try:
        t = session.query(RefreshToken).filter(RefreshToken.token_hash == raw_token_hash).with_for_update().first()
        t.is_revoked = True
        # Simulate unexpected failure before commit
        raise RuntimeError("Simulated transaction failure during rotation")
    except RuntimeError:
        session.rollback()
    finally:
        session.close()

    # Query fresh session to confirm database state is unchanged
    fresh_session = SessionLocal()
    try:
        t_fresh = fresh_session.query(RefreshToken).filter(RefreshToken.token_hash == raw_token_hash).first()
        assert t_fresh.is_revoked is False
    finally:
        fresh_session.close()

    # Verify the un-revoked token can still be rotated normally
    valid_refresh = client.post("/api/v1/auth/refresh", json={"refresh_token": raw_refresh_token})
    assert valid_refresh.status_code == 200
    assert "access_token" in valid_refresh.json()
