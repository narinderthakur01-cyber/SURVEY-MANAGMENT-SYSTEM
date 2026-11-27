import uuid
import enum
from datetime import datetime, timezone
from sqlalchemy import (
    String,
    Float,
    Boolean,
    DateTime,
    ForeignKey,
    Index,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database.base import Base


class TrackingSessionStatus(str, enum.Enum):
    ACTIVE = "ACTIVE"
    PAUSED = "PAUSED"
    STOPPED = "STOPPED"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"
    TERMINATED = "TERMINATED"


class TrackingSession(Base):
    __tablename__ = "tracking_sessions"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    worker_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    task_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False, index=True
    )
    status: Mapped[str] = mapped_column(
        String(30), default=TrackingSessionStatus.ACTIVE.value, nullable=False, index=True
    )
    consent_granted: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    termination_reason: Mapped[str | None] = mapped_column(String(100), nullable=True)
    device_info: Mapped[str | None] = mapped_column(String(255), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Relationships
    worker: Mapped["User"] = relationship("User", foreign_keys=[worker_id], lazy="joined")
    task: Mapped["Task"] = relationship("Task", foreign_keys=[task_id], lazy="joined")
    locations: Mapped[list["WorkerLocation"]] = relationship(
        "WorkerLocation", back_populates="session", cascade="all, delete-orphan", order_by="WorkerLocation.recorded_at"
    )


class WorkerLocation(Base):
    __tablename__ = "worker_locations"
    __table_args__ = (
        Index("ix_worker_locations_worker_recorded", "worker_id", "recorded_at"),
        Index("ix_worker_locations_task_recorded", "task_id", "recorded_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    session_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("tracking_sessions.id", ondelete="CASCADE"), nullable=False, index=True
    )
    worker_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    task_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False, index=True
    )

    latitude: Mapped[float] = mapped_column(Float, nullable=False)
    longitude: Mapped[float] = mapped_column(Float, nullable=False)
    accuracy: Mapped[float] = mapped_column(Float, nullable=False)  # in meters
    speed: Mapped[float | None] = mapped_column(Float, nullable=True)  # in m/s
    heading: Mapped[float | None] = mapped_column(Float, nullable=True)  # in degrees (0-360)

    recorded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False, index=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )

    # Relationships
    session: Mapped["TrackingSession"] = relationship("TrackingSession", back_populates="locations")
    worker: Mapped["User"] = relationship("User", foreign_keys=[worker_id], lazy="joined")
    task: Mapped["Task"] = relationship("Task", foreign_keys=[task_id], lazy="joined")
