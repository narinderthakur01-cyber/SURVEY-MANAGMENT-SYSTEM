from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List
import os


class Settings(BaseSettings):
    PROJECT_NAME: str = "Survey Management & Live Field Workforce Tracking System"
    ENVIRONMENT: str = "development"
    DEBUG: bool = True
    API_V1_STR: str = "/api/v1"
    BACKEND_CORS_ORIGINS: str = "http://localhost:5173,http://localhost:3000"

    # Database Configuration (PostgreSQL 18)
    POSTGRES_SERVER: str = "localhost"
    POSTGRES_PORT: int = 5432
    POSTGRES_USER: str = "postgres"
    POSTGRES_PASSWORD: str = "your_postgres_password"
    POSTGRES_DB: str = "survey_management"
    DATABASE_URL: str = "postgresql+psycopg2://postgres:your_postgres_password@localhost:5432/survey_management"

    # Security & Authentication (JWT + Argon2id)
    SECRET_KEY: str = Field(
        default="c0a8f8d94e2b1748291047586a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b",
        min_length=32,
        description="Cryptographic secret key for signing JWT tokens (minimum 32 characters)"
    )
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # Initial Admin Bootstrap
    FIRST_SUPERUSER_EMAIL: str = "admin@survey.org"
    FIRST_SUPERUSER_PASSWORD: str = "ChangeThisPassword123!"

    # Phase 5 Tracking Configuration
    LOCATION_RETENTION_DAYS: int = 30
    MIN_LOCATION_UPDATE_INTERVAL_SECONDS: int = 5

    model_config = SettingsConfigDict(
        env_file=os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))), ".env"),
        env_file_encoding="utf-8",
        extra="ignore"
    )

    @property
    def cors_origins(self) -> List[str]:
        return [origin.strip() for origin in self.BACKEND_CORS_ORIGINS.split(",") if origin.strip()]


settings = Settings()
