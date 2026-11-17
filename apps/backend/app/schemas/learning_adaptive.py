import uuid
from datetime import datetime, date
from typing import List, Optional
from pydantic import BaseModel, ConfigDict


class AdaptivePlanRecommendation(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    schedule_status: str  # "ahead" | "on_track" | "behind" | "completed"
    recommended_daily_target_seconds: int
    pace_difference_seconds: int  # difference from plan.daily_target_seconds (positive = faster pace required)
    remaining_duration_seconds: int
    remaining_days: int
    total_completed_seconds: int
    progress_percent: float
    is_overdue: bool = False
    is_achievable: bool = True
    explanation: str
    constraint_note: Optional[str] = None


class PlanMilestoneInfo(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    completed_milestones: List[str]  # e.g. ["25% Progress", "50% Progress"]
    next_milestone: Optional[str] = None  # e.g. "75% Plan Progress"
    next_milestone_target_percent: Optional[float] = None
    progress_percent: float


class LearningMilestone(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    title: str
    description: str
    category: str  # "session" | "video" | "plan" | "playlist" | "streak"
    achieved: bool
    achieved_at: Optional[datetime] = None
    target_value: Optional[float] = None
    current_value: Optional[float] = None


class UserMilestonesSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    achieved_count: int
    total_count: int
    milestones: List[LearningMilestone]
    next_milestone: Optional[LearningMilestone] = None

