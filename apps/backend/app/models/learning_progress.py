import uuid
from datetime import datetime
from typing import Optional
from sqlalchemy import text, Boolean, Float, ForeignKey, Integer, String, UniqueConstraint, Uuid, Index
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base, TimestampMixin


VALID_CONTENT_TYPES = {"video"}


class LearningProgress(Base, TimestampMixin):
    __tablename__ = "learning_progress"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    content_id: Mapped[str] = mapped_column(String(255), nullable=False)
    content_type: Mapped[str] = mapped_column(String(50), nullable=False, default="video")

    progress_seconds: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    duration_seconds: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    progress_percent: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    completed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    last_watched_at: Mapped[datetime] = mapped_column(server_default=text("now()"), onupdate=text("now()"))

    __table_args__ = (
        UniqueConstraint("user_id", "content_id", "content_type", name="uq_user_content_progress"),
        Index("ix_learning_progress_user_type", "user_id", "content_type"),
        Index("ix_learning_progress_user_content", "user_id", "content_id"),
    )
