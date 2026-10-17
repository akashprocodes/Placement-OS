import uuid
from datetime import datetime
from sqlalchemy import String, Integer, DateTime, Boolean, text, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base

class LearningPlaylist(Base):
    __tablename__ = "learning_playlists"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    playlist_id: Mapped[str] = mapped_column(String(255), unique=True, index=True) # YouTube ID
    title: Mapped[str] = mapped_column(String(255))
    channel_title: Mapped[str] = mapped_column(String(255))
    thumbnail_url: Mapped[str] = mapped_column(String(1024))
    description: Mapped[str] = mapped_column(Text)
    
    total_duration_seconds: Mapped[int] = mapped_column(Integer, default=0)
    item_count: Mapped[int] = mapped_column(Integer, default=0)
    duration_available: Mapped[bool] = mapped_column(Boolean, default=False)
    
    synced_at: Mapped[datetime] = mapped_column(DateTime, server_default=text("now()"))
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=text("now()"))
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=text("now()"), onupdate=text("now()"))

    items = relationship("LearningPlaylistItem", back_populates="playlist", cascade="all, delete-orphan", order_by="LearningPlaylistItem.position")

