import uuid
import secrets
from datetime import datetime, timezone
from fastapi import HTTPException, status
from sqlalchemy.orm import Session, joinedload
from app.models.survey import (
    Survey,
    SurveyVersion,
    SurveySection,
    Question,
    QuestionOption,
    SurveyPublicLink,
    SurveyVersionStatus,
    QuestionType,
)
from app.schemas.survey import (
    SurveyCreate,
    SurveyUpdate,
    SurveySectionCreate,
)


class SurveyService:
    @staticmethod
    def create_survey(db: Session, survey_in: SurveyCreate, user_id: uuid.UUID) -> Survey:
        """Create a new survey with an initial Draft version."""
        survey = Survey(
            title=survey_in.title.strip(),
            description=survey_in.description.strip() if survey_in.description else None,
            created_by=user_id,
            is_archived=False,
        )
        db.add(survey)
        db.flush()

        # Create initial Version 1 as DRAFT
        version = SurveyVersion(
            survey_id=survey.id,
            version_number=1,
            status=SurveyVersionStatus.DRAFT.value,
        )
        db.add(version)
        db.flush()

        # Build initial sections & questions if provided
        if survey_in.sections:
            for s_idx, sec_in in enumerate(survey_in.sections):
                section = SurveySection(
                    version_id=version.id,
                    title=sec_in.title.strip(),
                    description=sec_in.description.strip() if sec_in.description else None,
                    display_order=sec_in.display_order if sec_in.display_order else s_idx,
                )
                db.add(section)
                db.flush()

                for q_idx, q_in in enumerate(sec_in.questions):
                    question = Question(
                        section_id=section.id,
                        question_text=q_in.question_text.strip(),
                        question_type=q_in.question_type.value if hasattr(q_in.question_type, 'value') else str(q_in.question_type),
                        is_required=q_in.is_required,
                        display_order=q_in.display_order if q_in.display_order else q_idx,
                        validation_rules=q_in.validation_rules,
                        conditional_logic=q_in.conditional_logic,
                    )
                    db.add(question)
                    db.flush()

                    for o_idx, opt_in in enumerate(q_in.options):
                        option = QuestionOption(
                            question_id=question.id,
                            option_text=opt_in.option_text.strip(),
                            option_value=opt_in.option_value.strip(),
                            display_order=opt_in.display_order if opt_in.display_order else o_idx,
                        )
                        db.add(option)

        db.commit()
        db.refresh(survey)
        return survey

    @staticmethod
    def get_survey(db: Session, survey_id: uuid.UUID) -> Survey:
        """Get survey by ID with all versions and sections."""
        survey = (
            db.query(Survey)
            .options(
                joinedload(Survey.versions).joinedload(SurveyVersion.sections).joinedload(SurveySection.questions).joinedload(Question.options),
                joinedload(Survey.creator),
            )
            .filter(Survey.id == survey_id)
            .first()
        )
        if not survey:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Survey not found")
        return survey

    @staticmethod
    def list_surveys(db: Session, include_archived: bool = False) -> list[Survey]:
        """List surveys with their latest versions."""
        query = db.query(Survey).options(
            joinedload(Survey.versions).joinedload(SurveyVersion.sections).joinedload(SurveySection.questions).joinedload(Question.options)
        )
        if not include_archived:
            query = query.filter(Survey.is_archived.is_(False))
        return query.order_by(Survey.created_at.desc()).all()

    @staticmethod
    def update_survey_metadata(db: Session, survey_id: uuid.UUID, update_in: SurveyUpdate) -> Survey:
        """Update top-level survey metadata (title, description, archive flag)."""
        survey = db.query(Survey).filter(Survey.id == survey_id).first()
        if not survey:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Survey not found")

        if update_in.title is not None:
            survey.title = update_in.title.strip()
        if update_in.description is not None:
            survey.description = update_in.description.strip()
        if update_in.is_archived is not None:
            survey.is_archived = update_in.is_archived

        db.commit()
        db.refresh(survey)
        return survey

    @staticmethod
    def get_version(db: Session, version_id: uuid.UUID) -> SurveyVersion:
        """Get survey version with sections, questions, and options."""
        version = (
            db.query(SurveyVersion)
            .options(
                joinedload(SurveyVersion.sections).joinedload(SurveySection.questions).joinedload(Question.options),
                joinedload(SurveyVersion.survey),
            )
            .filter(SurveyVersion.id == version_id)
            .first()
        )
        if not version:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Survey version not found")
        return version

    @staticmethod
    def save_version_draft(db: Session, survey_id: uuid.UUID, sections_in: list[SurveySectionCreate]) -> SurveyVersion:
        """
        Save changes to survey structure:
        - If latest version is DRAFT: updates it in place.
        - If latest version is PUBLISHED: creates a new immutable version (latest + 1) in DRAFT state,
          preserving the published version without altering assigned tasks or existing data!
        """
        survey = db.query(Survey).filter(Survey.id == survey_id).first()
        if not survey:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Survey not found")

        latest_version = (
            db.query(SurveyVersion)
            .filter(SurveyVersion.survey_id == survey_id)
            .order_by(SurveyVersion.version_number.desc())
            .first()
        )

        target_version: SurveyVersion
        if latest_version and latest_version.status == SurveyVersionStatus.DRAFT.value:
            # Update existing draft
            target_version = latest_version
            # Remove existing sections (cascade deletes questions and options)
            db.query(SurveySection).filter(SurveySection.version_id == target_version.id).delete()
            db.flush()
        else:
            # Published or archived: clone into new version
            next_version_num = (latest_version.version_number + 1) if latest_version else 1
            target_version = SurveyVersion(
                survey_id=survey_id,
                version_number=next_version_num,
                status=SurveyVersionStatus.DRAFT.value,
            )
            db.add(target_version)
            db.flush()

        # Insert updated sections and questions
        for s_idx, sec_in in enumerate(sections_in):
            section = SurveySection(
                version_id=target_version.id,
                title=sec_in.title.strip(),
                description=sec_in.description.strip() if sec_in.description else None,
                display_order=sec_in.display_order if sec_in.display_order else s_idx,
            )
            db.add(section)
            db.flush()

            for q_idx, q_in in enumerate(sec_in.questions):
                q_type_str = q_in.question_type.value if hasattr(q_in.question_type, 'value') else str(q_in.question_type)
                question = Question(
                    section_id=section.id,
                    question_text=q_in.question_text.strip(),
                    question_type=q_type_str,
                    is_required=q_in.is_required,
                    display_order=q_in.display_order if q_in.display_order else q_idx,
                    validation_rules=q_in.validation_rules,
                    conditional_logic=q_in.conditional_logic,
                )
                db.add(question)
                db.flush()

                for o_idx, opt_in in enumerate(q_in.options):
                    option = QuestionOption(
                        question_id=question.id,
                        option_text=opt_in.option_text.strip(),
                        option_value=opt_in.option_value.strip(),
                        display_order=opt_in.display_order if opt_in.display_order else o_idx,
                    )
                    db.add(option)

        db.commit()
        return SurveyService.get_version(db, target_version.id)

    @staticmethod
    def publish_version(db: Session, version_id: uuid.UUID) -> SurveyVersion:
        """
        Publish a survey version.
        Validates completeness and ensures published versions become immutable.
        """
        version = (
            db.query(SurveyVersion)
            .options(joinedload(SurveyVersion.sections).joinedload(SurveySection.questions).joinedload(Question.options))
            .filter(SurveyVersion.id == version_id)
            .first()
        )
        if not version:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Survey version not found")

        if version.status == SurveyVersionStatus.PUBLISHED.value:
            return version  # Already published

        # Validation rules: at least one section and one question
        if not version.sections:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot publish a survey with no sections",
            )

        has_questions = any(len(s.questions) > 0 for s in version.sections)
        if not has_questions:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot publish a survey with no questions",
            )

        # Validate choice options
        for section in version.sections:
            for q in section.questions:
                if q.question_type in [
                    QuestionType.SINGLE_CHOICE.value,
                    QuestionType.MULTIPLE_CHOICE.value,
                    QuestionType.DROPDOWN.value,
                ]:
                    if not q.options or len(q.options) < 2:
                        raise HTTPException(
                            status_code=status.HTTP_400_BAD_REQUEST,
                            detail=f"Question '{q.question_text}' requires at least 2 options",
                        )

        version.status = SurveyVersionStatus.PUBLISHED.value
        version.published_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(version)
        return version

    @staticmethod
    def create_public_link(
        db: Session, version_id: uuid.UUID, custom_slug: str | None = None, expires_at: datetime | None = None
    ) -> SurveyPublicLink:
        """Create a public respondent link pointing to a published survey version."""
        version = db.query(SurveyVersion).filter(SurveyVersion.id == version_id).first()
        if not version:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Survey version not found")

        if version.status != SurveyVersionStatus.PUBLISHED.value:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Public links can only be created for published survey versions",
            )

        slug = custom_slug.strip().lower() if custom_slug else secrets.token_urlsafe(12).lower()

        # Check slug uniqueness
        existing = db.query(SurveyPublicLink).filter(SurveyPublicLink.slug == slug).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="This custom link slug is already taken",
            )

        link = SurveyPublicLink(
            version_id=version_id,
            slug=slug,
            is_active=True,
            expires_at=expires_at,
        )
        db.add(link)
        db.commit()
        db.refresh(link)
        return link

    @staticmethod
    def get_by_public_slug(db: Session, slug: str) -> SurveyVersion:
        """Retrieve the immutable published survey version by its public slug."""
        link = (
            db.query(SurveyPublicLink)
            .options(
                joinedload(SurveyPublicLink.version)
                .joinedload(SurveyVersion.sections)
                .joinedload(SurveySection.questions)
                .joinedload(Question.options),
                joinedload(SurveyPublicLink.version).joinedload(SurveyVersion.survey),
            )
            .filter(SurveyPublicLink.slug == slug.lower().strip(), SurveyPublicLink.is_active.is_(True))
            .first()
        )
        if not link:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Survey link not found or inactive")

        if link.expires_at and link.expires_at < datetime.now(timezone.utc):
            raise HTTPException(status_code=status.HTTP_410_GONE, detail="This survey link has expired")

        return link.version
