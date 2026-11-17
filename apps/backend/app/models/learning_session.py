import uuid
from datetime import datetime
from sqlalchemy import String, Integer, DateTime, ForeignKey, Uuid, text, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base

class LearningSession(Base):
    __tablename__ = "learning_sessions"

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    content_id: Mapped[str] = mapped_column(String(255))
    content_type: Mapped[str] = mapped_column(String(50))
    
    started_at: Mapped[datetime] = mapped_column(DateTime, server_default=text("now()"))
    last_event_at: Mapped[datetime] = mapped_column(DateTime, server_default=text("now()"))
    
    watched_content_seconds: Mapped[int] = mapped_column(Integer, default=0)
    wall_clock_seconds: Mapped[int] = mapped_column(Integer, default=0)
    
    last_position_seconds: Mapped[int] = mapped_column(Integer, nullable=True)
    last_sequence: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[str] = mapped_column(String(30), default="active")
    
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=text("now()"))
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=text("now()"), onupdate=text("now()"))

    user = relationship("User", backref="learning_sessions")

    __table_args__ = (
        Index("ix_learning_sessions_user_content_type", "user_id", "content_type"),
        Index("ix_learning_sessions_user_content_id", "user_id", "content_id"),
        Index("ix_learning_sessions_user_created", "user_id", "created_at"),
    )
