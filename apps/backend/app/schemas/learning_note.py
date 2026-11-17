import uuid
from datetime import datetime
from typing import Optional, Literal
from pydantic import BaseModel, Field, field_validator, model_validator


class LearningNoteCreate(BaseModel):
    video_id: str = Field(..., min_length=1, max_length=255)
    timestamp_seconds: int = Field(..., ge=0)
    title: Optional[str] = Field(None, max_length=255)
    content: str = Field("", max_length=5000)
    note_type: Literal["note", "bookmark"] = "note"

    @field_validator("video_id")
    @classmethod
    def validate_video_id(cls, v: str) -> str:
        cleaned = v.strip()
        if not cleaned:
            raise ValueError("video_id cannot be blank")
        return cleaned

    @field_validator("title")
    @classmethod
    def clean_title(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        cleaned = v.strip()
        return cleaned if cleaned else None

    @field_validator("content")
    @classmethod
    def clean_content(cls, v: str) -> str:
        return v.strip()

    @model_validator(mode="after")
    def validate_note_semantics(self) -> "LearningNoteCreate":
        if self.note_type == "note":
            if not self.content:
                raise ValueError("Note content cannot be empty")
        elif self.note_type == "bookmark":
            # For bookmark, if title is omitted and content is omitted, default title to "Bookmark"
            if not self.title and not self.content:
                self.title = "Bookmark"
        return self


class LearningNoteUpdate(BaseModel):
    timestamp_seconds: Optional[int] = Field(None, ge=0)
    title: Optional[str] = Field(None, max_length=255)
    content: Optional[str] = Field(None, max_length=5000)
    note_type: Optional[Literal["note", "bookmark"]] = None

    @field_validator("title")
    @classmethod
    def clean_title(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        cleaned = v.strip()
        return cleaned if cleaned else None

    @field_validator("content")
    @classmethod
    def clean_content(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        return v.strip()


class LearningNoteResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    video_id: str
    timestamp_seconds: int
    title: Optional[str]
    content: str
    note_type: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}

