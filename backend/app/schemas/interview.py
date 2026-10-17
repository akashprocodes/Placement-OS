import uuid
from enum import Enum
from typing import List, Optional, Any
from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field, field_validator


class InterviewType(str, Enum):
    RESUME_BASED = "resume_based"
    ROLE_BASED = "role_based"


class InterviewStage(str, Enum):
    HR = "hr"
    TECHNICAL = "technical"
    PROJECT_DISCUSSION = "project_discussion"


class InterviewStatus(str, Enum):
    DRAFT = "draft"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    ABANDONED = "abandoned"


class ExperienceLevel(str, Enum):
    ENTRY = "entry"
    MID = "mid"
    SENIOR = "senior"
    LEAD = "lead"


class InterviewDifficulty(str, Enum):
    EASY = "easy"
    MEDIUM = "medium"
    HARD = "hard"


# ─── Request Schemas ──────────────────────────────────────────────────────────

class InterviewSessionCreate(BaseModel):
    interview_type: InterviewType = InterviewType.ROLE_BASED
    target_role: str = Field(..., min_length=2, max_length=100)
    experience_level: ExperienceLevel = ExperienceLevel.ENTRY
    difficulty: InterviewDifficulty = InterviewDifficulty.MEDIUM
    selected_stages: List[InterviewStage] = Field(..., min_length=1)
    duration_minutes: Optional[int] = Field(default=30, ge=10, le=120)
    resume_id: Optional[uuid.UUID] = None
    title: Optional[str] = Field(default=None, max_length=255)

    @field_validator("target_role")
    @classmethod
    def role_not_blank(cls, v: str) -> str:
        stripped = v.strip()
        if not stripped:
            raise ValueError("Target role cannot be blank")
        return stripped

    @field_validator("selected_stages")
    @classmethod
    def stages_not_empty(cls, v: List[InterviewStage]) -> List[InterviewStage]:
        if not v:
            raise ValueError("At least one interview stage must be selected")
        # Deduplicate while preserving order
        seen = set()
        deduped = []
        for stage in v:
            if stage not in seen:
                seen.add(stage)
                deduped.append(stage)
        return deduped


class InterviewSessionUpdate(BaseModel):
    title: Optional[str] = Field(default=None, max_length=255)
    status: Optional[InterviewStatus] = None
    current_stage: Optional[InterviewStage] = None


# ─── Response Schemas ─────────────────────────────────────────────────────────

class InterviewTurnResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    interview_id: uuid.UUID
    turn_index: int
    speaker: str
    stage: str
    content: str
    audio_url: Optional[str] = None
    created_at: datetime


class InterviewSessionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    title: str
    interview_type: InterviewType
    status: InterviewStatus
    target_role: str
    experience_level: ExperienceLevel
    difficulty: InterviewDifficulty
    selected_stages: List[str]
    duration_minutes: Optional[int] = None
    current_stage: Optional[str] = None
    resume_id: Optional[uuid.UUID] = None
    turn_count: int = 0
    created_at: datetime
    updated_at: datetime
    completed_at: Optional[datetime] = None


class InterviewSessionListResponse(BaseModel):
    sessions: List[InterviewSessionResponse]
    total: int


# ─── Resume Schemas ───────────────────────────────────────────────────────────

class ResumeCreateRequest(BaseModel):
    filename: str = Field(..., min_length=1, max_length=255)
    file_type: str = Field(default="text/plain", max_length=100)
    raw_text: Optional[str] = None
    content_base64: Optional[str] = None


class ResumeResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    filename: str
    file_size_bytes: int
    file_type: str
    skills: Optional[Any] = None
    experience_summary: Optional[str] = None
    created_at: datetime
