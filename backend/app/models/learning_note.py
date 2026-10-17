import uuid
from typing import Optional
from sqlalchemy import ForeignKey, Integer, String, Text, Uuid, Index
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base, TimestampMixin


class LearningNote(Base, TimestampMixin):
    __tablename__ = "learning_notes"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    video_id: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    timestamp_seconds: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    title: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    content: Mapped[str] = mapped_column(Text, nullable=False, default="")
    note_type: Mapped[str] = mapped_column(String(20), nullable=False, default="note")  # "note" or "bookmark"

    __table_args__ = (
        Index("ix_learning_notes_user_video", "user_id", "video_id"),
        Index("ix_learning_notes_user_video_time", "user_id", "video_id", "timestamp_seconds"),
        Index("ix_learning_notes_user_video_type", "user_id", "video_id", "note_type"),
    )

