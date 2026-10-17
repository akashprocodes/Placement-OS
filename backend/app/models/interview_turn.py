import uuid
from typing import Optional
from datetime import datetime
from sqlalchemy import ForeignKey, Integer, String, Text, Uuid, DateTime, Index, text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base


class InterviewTurn(Base):
    __tablename__ = "interview_turns"

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    interview_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("interview_sessions.id", ondelete="CASCADE"), nullable=False, index=True
    )
    turn_index: Mapped[int] = mapped_column(Integer, nullable=False)
    speaker: Mapped[str] = mapped_column(String(20), nullable=False)  # "interviewer" | "candidate"
    stage: Mapped[str] = mapped_column(String(50), nullable=False)  # "hr" | "technical" | "project_discussion"
    content: Mapped[str] = mapped_column(Text, nullable=False)
    audio_url: Mapped[Optional[str]] = mapped_column(String(1024), nullable=True)  # extensible for future voice
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=text("now()"))

    interview_session = relationship("InterviewSession", back_populates="turns")

    __table_args__ = (
        Index("ix_interview_turns_session_seq", "interview_id", "turn_index"),
    )

