import uuid
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from app.main import app
from app.core.config import settings
from app.database.connection import SessionLocal
from app.models.survey import QuestionType, SurveyVersionStatus

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


# ============================================================================
# 1. Access Control & Authorization Tests
# ============================================================================

def test_survey_creation_requires_admin(worker_token, supervisor_token):
    """Verify workers and supervisors cannot create surveys."""
    payload = {"title": "Unauthorized Survey", "description": "Should fail"}
    
    # Unauthenticated
    res = client.post("/api/v1/surveys", json=payload)
    assert res.status_code == 401

    # Worker -> 403 Forbidden
    res = client.post("/api/v1/surveys", json=payload, headers={"Authorization": f"Bearer {worker_token}"})
    assert res.status_code == 403

    # Supervisor -> 403 Forbidden (Only Admin manages survey definitions)
    res = client.post("/api/v1/surveys", json=payload, headers={"Authorization": f"Bearer {supervisor_token}"})
    assert res.status_code == 403


def test_survey_listing_allowed_for_admin_and_supervisor(admin_token, supervisor_token, worker_token):
    """Admin and Supervisor can list surveys, but Worker cannot."""
    # Admin
    res = client.get("/api/v1/surveys", headers={"Authorization": f"Bearer {admin_token}"})
    assert res.status_code == 200
    assert isinstance(res.json(), list)

    # Supervisor
    res = client.get("/api/v1/surveys", headers={"Authorization": f"Bearer {supervisor_token}"})
    assert res.status_code == 200

    # Worker
    res = client.get("/api/v1/surveys", headers={"Authorization": f"Bearer {worker_token}"})
    assert res.status_code == 403


# ============================================================================
# 2. Survey Creation and Draft Management (All 12 Question Types)
# ============================================================================

def test_survey_crud_and_all_12_question_types(admin_token):
    """
    Test creating a survey and updating drafts with all 12 question types,
    including validation rules and conditional logic.
    """
    # 1. Create survey
    create_res = client.post(
        "/api/v1/surveys",
        json={
            "title": "Comprehensive Urban Field Survey",
            "description": "Baseline assessment covering all 12 dynamic question types",
        },
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert create_res.status_code == 201
    survey_data = create_res.json()
    survey_id = survey_data["id"]
    assert survey_data["title"] == "Comprehensive Urban Field Survey"
    assert len(survey_data["versions"]) == 1
    assert survey_data["versions"][0]["version_number"] == 1
    assert survey_data["versions"][0]["status"] == "DRAFT"

    # 2. Define sections with all 12 question types
    sections_payload = [
        {
            "title": "Demographics and Identification",
            "description": "Basic details and text inputs",
            "display_order": 1,
            "questions": [
                {
                    "question_text": "Respondent Full Name",
                    "question_type": QuestionType.SHORT_TEXT.value,
                    "is_required": True,
                    "display_order": 1,
                    "validation_rules": {"min_length": 2, "max_length": 100},
                },
                {
                    "question_text": "Detailed Residence Address / Notes",
                    "question_type": QuestionType.LONG_TEXT.value,
                    "is_required": False,
                    "display_order": 2,
                },
                {
                    "question_text": "Household Size",
                    "question_type": QuestionType.NUMBER.value,
                    "is_required": True,
                    "display_order": 3,
                    "validation_rules": {"min": 1, "max": 25},
                },
                {
                    "question_text": "Household Head Gender",
                    "question_type": QuestionType.SINGLE_CHOICE.value,
                    "is_required": True,
                    "display_order": 4,
                    "options": [
                        {"option_text": "Female", "option_value": "F", "display_order": 1},
                        {"option_text": "Male", "option_value": "M", "display_order": 2},
                        {"option_text": "Other / Prefer not to say", "option_value": "OTHER", "display_order": 3},
                    ],
                },
                {
                    "question_text": "Household Assets Owned",
                    "question_type": QuestionType.MULTIPLE_CHOICE.value,
                    "is_required": False,
                    "display_order": 5,
                    "options": [
                        {"option_text": "Solar Power", "option_value": "SOLAR", "display_order": 1},
                        {"option_text": "Vehicle", "option_value": "VEHICLE", "display_order": 2},
                        {"option_text": "Smartphone", "option_value": "PHONE", "display_order": 3},
                    ],
                },
                {
                    "question_text": "Primary Income Source",
                    "question_type": QuestionType.DROPDOWN.value,
                    "is_required": True,
                    "display_order": 6,
                    "options": [
                        {"option_text": "Agriculture", "option_value": "AGRI", "display_order": 1},
                        {"option_text": "Salaried Employment", "option_value": "SALARIED", "display_order": 2},
                        {"option_text": "Self-Employed / Business", "option_value": "BUSINESS", "display_order": 3},
                    ],
                },
            ],
        },
        {
            "title": "Facility Ratings and Media Capture",
            "description": "Assessments, dates, geolocation, and uploads",
            "display_order": 2,
            "questions": [
                {
                    "question_text": "Overall Public Service Satisfaction (1-5)",
                    "question_type": QuestionType.RATING.value,
                    "is_required": True,
                    "display_order": 1,
                    "validation_rules": {"min_rating": 1, "max_rating": 5},
                },
                {
                    "question_text": "Date of Last Health Center Visit",
                    "question_type": QuestionType.DATE.value,
                    "is_required": False,
                    "display_order": 2,
                },
                {
                    "question_text": "Is drinking water piped to the dwelling?",
                    "question_type": QuestionType.YES_NO.value,
                    "is_required": True,
                    "display_order": 3,
                },
                {
                    "question_text": "Water Quality Proof Photo",
                    "question_type": QuestionType.IMAGE_UPLOAD.value,
                    "is_required": False,
                    "display_order": 4,
                    "conditional_logic": {
                        "action": "show",
                        "field": "drinking_water_piped",
                        "operator": "equals",
                        "value": "yes",
                    },
                },
                {
                    "question_text": "Official Utility Bill Document",
                    "question_type": QuestionType.FILE_UPLOAD.value,
                    "is_required": False,
                    "display_order": 5,
                },
                {
                    "question_text": "Survey Location GPS Coordinates",
                    "question_type": QuestionType.GPS_CAPTURE.value,
                    "is_required": True,
                    "display_order": 6,
                },
            ],
        },
    ]

    # 3. Save draft version
    draft_res = client.post(
        f"/api/v1/surveys/{survey_id}/draft",
        json=sections_payload,
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert draft_res.status_code == 200
    version_data = draft_res.json()
    assert version_data["version_number"] == 1
    assert version_data["status"] == "DRAFT"
    assert len(version_data["sections"]) == 2
    assert len(version_data["sections"][0]["questions"]) == 6
    assert len(version_data["sections"][1]["questions"]) == 6

    # Verify conditional logic and validation rules persisted
    sec2_q4 = version_data["sections"][1]["questions"][3]
    assert sec2_q4["question_type"] == "IMAGE_UPLOAD"
    assert sec2_q4["conditional_logic"]["operator"] == "equals"


# ============================================================================
# 3. Publishing Validation Rules
# ============================================================================

def test_publish_validation_enforcement(admin_token):
    """Verify validation before publishing (cannot publish empty surveys or choice questions with <2 options)."""
    # Create empty survey
    res = client.post(
        "/api/v1/surveys",
        json={"title": "Empty Test Survey"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    survey_id = res.json()["id"]
    version_id = res.json()["versions"][0]["id"]

    # 1. Attempt to publish empty survey -> fails
    pub_res = client.post(
        f"/api/v1/surveys/versions/{version_id}/publish",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert pub_res.status_code == 400
    assert "no sections" in pub_res.json()["detail"].lower()

    # 2. Add section with invalid single choice (only 1 option)
    invalid_section = [
        {
            "title": "Invalid Section",
            "questions": [
                {
                    "question_text": "Incomplete choice question",
                    "question_type": QuestionType.SINGLE_CHOICE.value,
                    "options": [{"option_text": "Only One Option", "option_value": "1"}],
                }
            ],
        }
    ]
    client.post(
        f"/api/v1/surveys/{survey_id}/draft",
        json=invalid_section,
        headers={"Authorization": f"Bearer {admin_token}"},
    )

    # Attempt to publish -> fails
    pub_res2 = client.post(
        f"/api/v1/surveys/versions/{version_id}/publish",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert pub_res2.status_code == 400
    assert "at least 2 options" in pub_res2.json()["detail"].lower()


# ============================================================================
# 4. Immutability & Version Cloning
# ============================================================================

def test_survey_version_immutability(admin_token):
    """
    Verify that once a survey version is PUBLISHED:
    - Version 1 status is PUBLISHED and its contents are locked.
    - Saving new draft creates Version 2 in DRAFT status.
    - Version 1 remains completely untouched.
    """
    # 1. Create survey with valid section
    res = client.post(
        "/api/v1/surveys",
        json={"title": "Immutability Test Survey"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    survey_id = res.json()["id"]
    v1_id = res.json()["versions"][0]["id"]

    valid_sections = [
        {
            "title": "Section 1",
            "questions": [
                {
                    "question_text": "What is your rating?",
                    "question_type": QuestionType.RATING.value,
                }
            ],
        }
    ]
    client.post(
        f"/api/v1/surveys/{survey_id}/draft",
        json=valid_sections,
        headers={"Authorization": f"Bearer {admin_token}"},
    )

    # 2. Publish Version 1
    pub_res = client.post(
        f"/api/v1/surveys/versions/{v1_id}/publish",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert pub_res.status_code == 200
    assert pub_res.json()["status"] == "PUBLISHED"
    assert pub_res.json()["published_at"] is not None

    # 3. Save new draft on the published survey
    updated_sections = [
        {
            "title": "Section 1 Updated",
            "questions": [
                {
                    "question_text": "What is your updated rating?",
                    "question_type": QuestionType.RATING.value,
                },
                {
                    "question_text": "Additional feedback",
                    "question_type": QuestionType.SHORT_TEXT.value,
                },
            ],
        }
    ]
    v2_res = client.post(
        f"/api/v1/surveys/{survey_id}/draft",
        json=updated_sections,
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert v2_res.status_code == 200
    v2_data = v2_res.json()
    assert v2_data["version_number"] == 2
    assert v2_data["status"] == "DRAFT"
    assert v2_data["id"] != v1_id
    assert len(v2_data["sections"][0]["questions"]) == 2

    # 4. Verify Version 1 is still PUBLISHED and intact
    v1_check = client.get(
        f"/api/v1/surveys/versions/{v1_id}",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert v1_check.status_code == 200
    v1_data = v1_check.json()
    assert v1_data["version_number"] == 1
    assert v1_data["status"] == "PUBLISHED"
    assert len(v1_data["sections"][0]["questions"]) == 1
    assert v1_data["sections"][0]["title"] == "Section 1"


# ============================================================================
# 5. Public Respondent Links
# ============================================================================

def test_public_links_workflow(admin_token):
    """
    Test public links:
    - Cannot create public link for a DRAFT version.
    - Can create public link for a PUBLISHED version.
    - Public respondent can fetch published survey by slug without authentication.
    """
    # 1. Create survey and publish it
    res = client.post(
        "/api/v1/surveys",
        json={"title": "Public Feedback Survey"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    survey_id = res.json()["id"]
    v1_id = res.json()["versions"][0]["id"]

    # Attempt public link on DRAFT -> 400 Bad Request
    link_fail = client.post(
        f"/api/v1/surveys/versions/{v1_id}/public-link",
        json={"version_id": v1_id, "custom_slug": "feedback-draft"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert link_fail.status_code == 400

    # Add questions and publish
    client.post(
        f"/api/v1/surveys/{survey_id}/draft",
        json=[
            {
                "title": "General Feedback",
                "questions": [
                    {
                        "question_text": "Do you recommend our community services?",
                        "question_type": QuestionType.YES_NO.value,
                    }
                ],
            }
        ],
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    client.post(
        f"/api/v1/surveys/versions/{v1_id}/publish",
        headers={"Authorization": f"Bearer {admin_token}"},
    )

    # 2. Create public link with custom slug
    custom_slug = f"community-{uuid.uuid4().hex[:6]}"
    link_res = client.post(
        f"/api/v1/surveys/versions/{v1_id}/public-link",
        json={"version_id": v1_id, "custom_slug": custom_slug},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert link_res.status_code == 200
    assert link_res.json()["slug"] == custom_slug
    assert link_res.json()["is_active"] is True

    # 3. Public respondent retrieves survey without Authorization header
    pub_get = client.get(f"/api/v1/surveys/public/{custom_slug}")
    assert pub_get.status_code == 200
    resp_data = pub_get.json()
    assert resp_data["version_number"] == 1
    assert resp_data["status"] == "PUBLISHED"
    assert resp_data["sections"][0]["questions"][0]["question_type"] == "YES_NO"

    # 4. Non-existent slug returns 404
    not_found = client.get("/api/v1/surveys/public/non-existent-slug-xyz")
    assert not_found.status_code == 404
