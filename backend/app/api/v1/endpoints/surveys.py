import uuid
from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.api.deps import get_db, get_current_user, require_admin, require_supervisor_or_admin
from app.models.user import User
from app.schemas.survey import (
    SurveyCreate,
    SurveyUpdate,
    SurveyRead,
    SurveyVersionRead,
    SurveySectionCreate,
    SurveyPublicLinkCreate,
    SurveyPublicLinkRead,
)
from app.services.survey_service import SurveyService

router = APIRouter(prefix="/surveys", tags=["Surveys"])


@router.post("", response_model=SurveyRead, status_code=status.HTTP_201_CREATED)
def create_survey(
    survey_in: SurveyCreate,
    current_admin: Annotated[User, Depends(require_admin)],
    db: Annotated[Session, Depends(get_db)],
):
    """
    Create a new survey with initial Draft version (Admin only).
    """
    survey = SurveyService.create_survey(db, survey_in, current_admin.id)
    # Format with latest version
    latest_v = survey.versions[0] if survey.versions else None
    return SurveyRead(
        id=survey.id,
        title=survey.title,
        description=survey.description,
        is_archived=survey.is_archived,
        created_by=survey.created_by,
        created_at=survey.created_at,
        updated_at=survey.updated_at,
        versions=survey.versions,
        latest_version=latest_v,
    )


@router.get("", response_model=list[SurveyRead])
def list_surveys(
    current_user: Annotated[User, Depends(require_supervisor_or_admin)],
    db: Annotated[Session, Depends(get_db)],
    include_archived: bool = False,
):
    """
    List surveys with their versions (Admin or Supervisor).
    """
    surveys = SurveyService.list_surveys(db, include_archived=include_archived)
    results = []
    for s in surveys:
        latest_v = s.versions[0] if s.versions else None
        results.append(
            SurveyRead(
                id=s.id,
                title=s.title,
                description=s.description,
                is_archived=s.is_archived,
                created_by=s.created_by,
                created_at=s.created_at,
                updated_at=s.updated_at,
                versions=s.versions,
                latest_version=latest_v,
            )
        )
    return results


@router.get("/{survey_id}", response_model=SurveyRead)
def get_survey_by_id(
    survey_id: uuid.UUID,
    current_user: Annotated[User, Depends(require_supervisor_or_admin)],
    db: Annotated[Session, Depends(get_db)],
):
    """
    Get survey details and version history.
    """
    survey = SurveyService.get_survey(db, survey_id)
    latest_v = survey.versions[0] if survey.versions else None
    return SurveyRead(
        id=survey.id,
        title=survey.title,
        description=survey.description,
        is_archived=survey.is_archived,
        created_by=survey.created_by,
        created_at=survey.created_at,
        updated_at=survey.updated_at,
        versions=survey.versions,
        latest_version=latest_v,
    )


@router.patch("/{survey_id}", response_model=SurveyRead)
def update_survey(
    survey_id: uuid.UUID,
    update_in: SurveyUpdate,
    _: Annotated[User, Depends(require_admin)],
    db: Annotated[Session, Depends(get_db)],
):
    """
    Update survey metadata (Admin only).
    """
    survey = SurveyService.update_survey_metadata(db, survey_id, update_in)
    survey_full = SurveyService.get_survey(db, survey.id)
    latest_v = survey_full.versions[0] if survey_full.versions else None
    return SurveyRead(
        id=survey_full.id,
        title=survey_full.title,
        description=survey_full.description,
        is_archived=survey_full.is_archived,
        created_by=survey_full.created_by,
        created_at=survey_full.created_at,
        updated_at=survey_full.updated_at,
        versions=survey_full.versions,
        latest_version=latest_v,
    )


@router.get("/versions/{version_id}", response_model=SurveyVersionRead)
def get_version_details(
    version_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    """
    Get full question tree for a specific survey version.
    """
    return SurveyService.get_version(db, version_id)


@router.post("/{survey_id}/draft", response_model=SurveyVersionRead)
def save_survey_draft(
    survey_id: uuid.UUID,
    sections: list[SurveySectionCreate],
    _: Annotated[User, Depends(require_admin)],
    db: Annotated[Session, Depends(get_db)],
):
    """
    Save survey questions & sections.
    If the latest version is already published, this automatically creates a new version
    in DRAFT status, strictly preserving the published version as immutable.
    """
    return SurveyService.save_version_draft(db, survey_id, sections)


@router.post("/versions/{version_id}/publish", response_model=SurveyVersionRead)
def publish_version(
    version_id: uuid.UUID,
    _: Annotated[User, Depends(require_admin)],
    db: Annotated[Session, Depends(get_db)],
):
    """
    Publish a survey version. Published versions become immutable.
    """
    return SurveyService.publish_version(db, version_id)


@router.post("/versions/{version_id}/public-link", response_model=SurveyPublicLinkRead)
def create_public_link(
    version_id: uuid.UUID,
    link_in: SurveyPublicLinkCreate,
    _: Annotated[User, Depends(require_admin)],
    db: Annotated[Session, Depends(get_db)],
):
    """
    Generate a public respondent link pointing to a published survey version.
    """
    link = SurveyService.create_public_link(db, version_id, link_in.custom_slug, link_in.expires_at)
    version = SurveyService.get_version(db, version_id)
    return SurveyPublicLinkRead(
        id=link.id,
        version_id=link.version_id,
        slug=link.slug,
        is_active=link.is_active,
        expires_at=link.expires_at,
        created_at=link.created_at,
        survey_title=version.survey.title if version.survey else None,
        version_number=version.version_number,
    )


@router.get("/public/{slug}", response_model=SurveyVersionRead)
def get_survey_by_public_link(
    slug: str,
    db: Annotated[Session, Depends(get_db)],
):
    """
    Public respondent endpoint to fetch a published survey version by its link slug.
    No authentication required.
    """
    return SurveyService.get_by_public_slug(db, slug)
