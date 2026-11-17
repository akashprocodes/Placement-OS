from pydantic import BaseModel, ConfigDict
from typing import List, Optional
from datetime import datetime, date
import uuid
from app.schemas.learning import LearningPlanResponse, LearningPlanProgress
from app.schemas.learning_streak import StudyStreakInfo
from app.schemas.learning_adaptive import (
    AdaptivePlanRecommendation,
    PlanMilestoneInfo,
    UserMilestonesSummary,
)


class PlanResumeContext(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    video_id: str
    video_title: Optional[str] = None
    saved_position_seconds: int = 0
    duration_seconds: Optional[int] = None
    playlist_id: Optional[str] = None
    has_saved_position: bool = False


class LearningPlanWithProgress(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    plan: LearningPlanResponse
    progress: LearningPlanProgress
    resume: Optional[PlanResumeContext] = None
    adaptive: Optional[AdaptivePlanRecommendation] = None
    milestones: Optional[PlanMilestoneInfo] = None


class LearningWorkspaceResponse(BaseModel):
    active_plans: List[LearningPlanWithProgress]
    completed_plans: List[LearningPlanResponse]
    streak: Optional[StudyStreakInfo] = None
    milestones: Optional[UserMilestonesSummary] = None
