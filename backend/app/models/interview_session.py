import uuid
from typing import Optional, Any
from datetime import datetime
from sqlalchemy import ForeignKey, Integer, String, Uuid, JSON, DateTime, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base, TimestampMixin


class InterviewSession(Base, TimestampMixin):
    __tablename__ = "interview_sessions"

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    resume_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("resumes.id", ondelete="SET NULL"), nullable=True, index=True
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    interview_type: Mapped[str] = mapped_column(String(50), nullable=False, index=True, default="role_based")
    status: Mapped[str] = mapped_column(String(50), nullable=False, index=True, default="draft")
    target_role: Mapped[str] = mapped_column(String(100), nullable=False)
    experience_level: Mapped[str] = mapped_column(String(50), nullable=False, default="entry")
    difficulty: Mapped[str] = mapped_column(String(50), nullable=False, default="medium")
    selected_stages: Mapped[Any] = mapped_column(JSON, nullable=False)
    duration_minutes: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    current_stage: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    user = relationship("User", backref="interview_sessions")
    resume = relationship("Resume", backref="interview_sessions")
    turns = relationship(
        "InterviewTurn",
        back_populates="interview_session",
        cascade="all, delete-orphan",
        order_by="InterviewTurn.turn_index",
    )

    __table_args__ = (
        Index("ix_interview_sessions_user_status", "user_id", "status"),
        Index("ix_interview_sessions_user_created", "user_id", "created_at"),
    )

