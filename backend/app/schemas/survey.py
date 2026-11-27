import uuid
from datetime import datetime
from typing import Any
from pydantic import BaseModel, ConfigDict, Field
from app.models.survey import QuestionType, SurveyVersionStatus


# --- Question Options ---
class QuestionOptionBase(BaseModel):
    option_text: str = Field(..., min_length=1, max_length=255)
    option_value: str = Field(..., min_length=1, max_length=255)
    display_order: int = 0


class QuestionOptionCreate(QuestionOptionBase):
    pass


class QuestionOptionRead(QuestionOptionBase):
    id: uuid.UUID
    question_id: uuid.UUID

    model_config = ConfigDict(from_attributes=True)


# --- Questions ---
class QuestionBase(BaseModel):
    question_text: str = Field(..., min_length=1)
    question_type: QuestionType
    is_required: bool = False
    display_order: int = 0
    validation_rules: dict[str, Any] | None = None
    conditional_logic: dict[str, Any] | None = None


class QuestionCreate(QuestionBase):
    options: list[QuestionOptionCreate] = []


class QuestionRead(QuestionBase):
    id: uuid.UUID
    section_id: uuid.UUID
    options: list[QuestionOptionRead] = []

    model_config = ConfigDict(from_attributes=True)


# --- Survey Sections ---
class SurveySectionBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    description: str | None = None
    display_order: int = 0


class SurveySectionCreate(SurveySectionBase):
    questions: list[QuestionCreate] = []


class SurveySectionRead(SurveySectionBase):
    id: uuid.UUID
    version_id: uuid.UUID
    questions: list[QuestionRead] = []

    model_config = ConfigDict(from_attributes=True)


# --- Survey Versions ---
class SurveyVersionBase(BaseModel):
    version_number: int
    status: SurveyVersionStatus
    published_at: datetime | None = None


class SurveyVersionSummary(BaseModel):
    id: uuid.UUID
    version_number: int
    status: SurveyVersionStatus
    published_at: datetime | None = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class SurveyVersionRead(SurveyVersionSummary):
    survey_id: uuid.UUID
    survey_title: str | None = None
    sections: list[SurveySectionRead] = []

    model_config = ConfigDict(from_attributes=True)


# --- Surveys ---
class SurveyBase(BaseModel):
    title: str = Field(..., min_length=2, max_length=200)
    description: str | None = None


class SurveyCreate(SurveyBase):
    sections: list[SurveySectionCreate] = []


class SurveyUpdate(BaseModel):
    title: str | None = Field(None, min_length=2, max_length=200)
    description: str | None = None
    is_archived: bool | None = None


class SurveyRead(SurveyBase):
    id: uuid.UUID
    created_by: uuid.UUID
    is_archived: bool
    created_at: datetime
    updated_at: datetime
    versions: list[SurveyVersionSummary] = []
    latest_version: SurveyVersionRead | None = None

    model_config = ConfigDict(from_attributes=True)


# --- Public Links ---
class SurveyPublicLinkCreate(BaseModel):
    version_id: uuid.UUID
    custom_slug: str | None = None
    expires_at: datetime | None = None


class SurveyPublicLinkRead(BaseModel):
    id: uuid.UUID
    version_id: uuid.UUID
    slug: str
    is_active: bool
    expires_at: datetime | None = None
    created_at: datetime
    survey_title: str | None = None
    version_number: int | None = None

    model_config = ConfigDict(from_attributes=True)
