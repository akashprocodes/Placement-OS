import uuid
from datetime import datetime, date
from sqlalchemy import String, Integer, Date, DateTime, ForeignKey, Uuid, text, Index, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base

class LearningDailyActivity(Base):
    __tablename__ = "learning_daily_activity"

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    content_id: Mapped[str] = mapped_column(String(255))
    content_type: Mapped[str] = mapped_column(String(50))
    activity_date: Mapped[date] = mapped_column(Date)
    
    watched_content_seconds: Mapped[int] = mapped_column(Integer, default=0)
    
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=text("now()"))
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=text("now()"), onupdate=text("now()"))

    user = relationship("User")

    __table_args__ = (
        UniqueConstraint("user_id", "content_id", "content_type", "activity_date", name="uq_user_content_date"),
        Index("ix_daily_activity_user_date", "user_id", "activity_date"),
    )
