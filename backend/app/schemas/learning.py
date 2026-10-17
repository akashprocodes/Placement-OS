from pydantic import BaseModel, field_validator, model_validator, ConfigDict
from typing import List, Optional
import uuid
from datetime import datetime, date

VALID_CONTENT_TYPES = {"video", "playlist"}
COMPLETION_THRESHOLD = 95.0


class YouTubeVideo(BaseModel):
    id: str
    title: str
    description: str
    thumbnailUrl: str
    channelTitle: str
    publishedAt: str
    duration: Optional[str] = None
    url: str

class YouTubePlaylistItem(BaseModel):
    video_id: str
    title: str
    thumbnail_url: str
    position: int
    duration_seconds: Optional[int] = None
    video_url: str
    progress_seconds: Optional[int] = None
    progress_percent: Optional[float] = None
    completed: Optional[bool] = None

class YouTubePlaylistDetailed(BaseModel):
    id: str
    title: str
    description: str
    thumbnailUrl: str
    channelTitle: str
    itemCount: Optional[int] = None
    url: str
    total_duration_seconds: int = 0
    duration_available: bool = False
    synced_at: Optional[datetime] = None
    items: List[YouTubePlaylistItem] = []
    completed_count: Optional[int] = None
    total_count: Optional[int] = None
    next_incomplete_video_id: Optional[str] = None

class YouTubePlaylist(BaseModel):

    id: str
    title: str
    description: str
    thumbnailUrl: str
    channelTitle: str
    itemCount: Optional[int] = None
    url: str

class LearningSearchResult(BaseModel):
    query: str
    videos: List[YouTubeVideo]
    playlists: List[YouTubePlaylist]
    nextPageToken: Optional[str] = None


# --- Progress schemas: user_id is NEVER accepted from client ---

class LearningProgressUpsert(BaseModel):
    content_id: str
    content_type: str
    progress_seconds: int
    duration_seconds: Optional[int] = None

    @field_validator("content_id")
    @classmethod
    def content_id_not_empty(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("content_id must not be empty")
        return v.strip()

    @field_validator("content_type")
    @classmethod
    def content_type_valid(cls, v: str) -> str:
        if v not in VALID_CONTENT_TYPES:
            raise ValueError(f"content_type must be one of: {VALID_CONTENT_TYPES}")
        return v

    @field_validator("progress_seconds")
    @classmethod
    def progress_not_negative(cls, v: int) -> int:
        if v < 0:
            raise ValueError("progress_seconds must be >= 0")
        return v

    @field_validator("duration_seconds")
    @classmethod
    def duration_positive(cls, v: Optional[int]) -> Optional[int]:
        if v is not None and v <= 0:
            raise ValueError("duration_seconds must be > 0 when provided")
        return v

    @model_validator(mode="after")
    def clamp_progress_to_duration(self) -> "LearningProgressUpsert":
        if self.duration_seconds is not None and self.progress_seconds > self.duration_seconds:
            self.progress_seconds = self.duration_seconds
        return self


class LearningProgressResponse(BaseModel):
    id: uuid.UUID
    content_id: str
    content_type: str
    progress_seconds: int
    duration_seconds: Optional[int]
    progress_percent: float
    completed: bool
    last_watched_at: datetime
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}

# --- Learning Plan schemas ---

class LearningPlanCreate(BaseModel):
    content_id: str
    content_type: str
    title: str
    total_duration_seconds: int
    target_completion_date: date

    @field_validator("content_id", "title")
    @classmethod
    def field_not_empty(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Field must not be empty")
        return v.strip()

    @field_validator("content_type")
    @classmethod
    def content_type_valid(cls, v: str) -> str:
        if v not in VALID_CONTENT_TYPES:
            raise ValueError(f"content_type must be one of: {VALID_CONTENT_TYPES}")
        return v

    @field_validator("total_duration_seconds")
    @classmethod
    def duration_positive(cls, v: int) -> int:
        if v <= 0:
            raise ValueError("total_duration_seconds must be > 0")
        return v


class LearningPlanResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    user_id: uuid.UUID
    content_id: str
    content_type: str
    title: str
    total_duration_seconds: int
    target_completion_date: date
    daily_target_seconds: int
    status: str
    completed_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime


# --- Learning Session schemas ---

class LearningSessionHeartbeat(BaseModel):
    session_id: uuid.UUID
    content_id: str
    content_type: str
    sequence: int
    position_seconds: int
    playback_rate: float
    played_content_seconds: int
    wall_clock_seconds: int
    status: str  # "active", "paused", "ended"
    client_event_at: datetime
    @field_validator("content_id")
    @classmethod
    def heartbeat_content_id_not_empty(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("content_id must not be empty")
        return v.strip()

    @field_validator("content_type")
    @classmethod
    def heartbeat_content_type_valid(cls, v: str) -> str:
        if v not in VALID_CONTENT_TYPES:
            raise ValueError(f"content_type must be one of: {VALID_CONTENT_TYPES}")
        return v
        
    @field_validator("status")
    @classmethod
    def status_valid(cls, v: str) -> str:
        if v not in {"active", "paused", "ended"}:
            raise ValueError("status must be active, paused, or ended")
        return v
        
    @field_validator("playback_rate")
    @classmethod
    def rate_valid(cls, v: float) -> float:
        if v <= 0 or v > 4.0:
            raise ValueError("playback_rate must be between 0 and 4")
        return v
        
    @model_validator(mode="after")
    def validate_durations(self):
        if self.played_content_seconds < 0 or self.wall_clock_seconds < 0:
            raise ValueError("time increments cannot be negative")
            
        # Hard limit: no single heartbeat should represent > 5 minutes of wall clock time (300s)
        if self.wall_clock_seconds > 300:
            raise ValueError("wall_clock_seconds exceeds reasonable maximum for a single heartbeat")
            
        # Consistency check: played_content_seconds ≈ wall_clock_seconds * playback_rate
        expected_content = self.wall_clock_seconds * self.playback_rate
        # Allow 2 seconds + 5% tolerance for timing/rounding discrepancies
        tolerance = 2.0 + (expected_content * 0.05)
        
        if abs(self.played_content_seconds - expected_content) > tolerance:
            raise ValueError(f"played_content_seconds ({self.played_content_seconds}) does not match wall_clock_seconds * playback_rate ({expected_content})")
            
        return self

# --- Learning Plan Progress schema ---
from app.schemas.learning_adaptive import AdaptivePlanRecommendation

class LearningPlanProgress(BaseModel):
    plan_id: uuid.UUID
    target_completion_date: date
    daily_target_seconds: int
    completed_seconds_today: int
    base_target_seconds_today: int
    previous_debt_seconds: int
    required_seconds_today: int
    remaining_seconds_today: int
    current_debt_seconds: int
    current_date: date
    status: str
    completed_at: Optional[datetime] = None
    adaptive: Optional[AdaptivePlanRecommendation] = None


class VideoPlanContextResponse(BaseModel):
    video_id: str
    active_plan: Optional[LearningPlanResponse] = None
    direct_plan: Optional[LearningPlanResponse] = None
    parent_playlist_plan: Optional[LearningPlanResponse] = None
    parent_playlist_id: Optional[str] = None
    parent_playlist_title: Optional[str] = None
    all_parent_playlist_ids: List[str] = []

