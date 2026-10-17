import uuid
from datetime import datetime
from sqlalchemy import String, DateTime, text, Index, UniqueConstraint, JSON, Uuid
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base


class LearningSearchCache(Base):
    __tablename__ = "learning_search_cache"

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    query_normalized: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    page_token: Mapped[str] = mapped_column(String(100), nullable=False, default="", server_default="")
    response_data: Mapped[dict] = mapped_column(JSON, nullable=False)

    cached_at: Mapped[datetime] = mapped_column(DateTime, server_default=text("now()"), nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, index=True)

    __table_args__ = (
        UniqueConstraint("query_normalized", "page_token", name="uq_search_cache_query_page"),
        Index("ix_search_cache_query_page", "query_normalized", "page_token"),
    )
