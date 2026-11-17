import uuid
from datetime import datetime
from sqlalchemy import String, Integer, DateTime, ForeignKey, text, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base

class LearningPlaylistItem(Base):
    __tablename__ = "learning_playlist_items"

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    playlist_internal_id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), ForeignKey("learning_playlists.id", ondelete="CASCADE"), index=True)
    
    video_id: Mapped[str] = mapped_column(String(255))
    title: Mapped[str] = mapped_column(String(255))
    thumbnail_url: Mapped[str] = mapped_column(String(1024))
    position: Mapped[int] = mapped_column(Integer)
    duration_seconds: Mapped[int] = mapped_column(Integer, nullable=True)
    
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=text("now()"))
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=text("now()"), onupdate=text("now()"))

    playlist = relationship("LearningPlaylist", back_populates="items")
