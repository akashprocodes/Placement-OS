import uuid
from datetime import datetime, date
from sqlalchemy import String, Integer, Date, DateTime, ForeignKey, Uuid, text, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base

class LearningPlan(Base):
    __tablename__ = "learning_plans"

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    content_id: Mapped[str] = mapped_column(String(255))
    content_type: Mapped[str] = mapped_column(String(50))
    title: Mapped[str] = mapped_column(String(255))
    total_duration_seconds: Mapped[int] = mapped_column(Integer)
    target_completion_date: Mapped[date] = mapped_column(Date)
    daily_target_seconds: Mapped[int] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(String(50), default="active")
    completed_at: Mapped[datetime] = mapped_column(DateTime, nullable=True)
    
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=text("now()"))
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=text("now()"), onupdate=text("now()"))

    user = relationship("User", backref="learning_plans")

    __table_args__ = (
        Index("ix_learning_plans_user_content_type", "user_id", "content_type"),
        Index("ix_learning_plans_user_status", "user_id", "status"),
        Index(
            "uq_learning_plans_user_active_content",
            "user_id",
            "content_id",
            unique=True,
            postgresql_where=text("status = 'active'"),
        ),
    )
