from pydantic import BaseModel, ConfigDict
from typing import List, Optional
from datetime import date, datetime
import uuid
from app.schemas.learning_streak import StudyStreakInfo

class AnalyticsSummary(BaseModel):
    total_watched_seconds: int
    total_active_days: int
    active_plans_count: int
    completed_plans_count: int
    current_streak_days: int = 0
    longest_streak_days: int = 0

class DailyActivityRecord(BaseModel):
    date: date
    watched_seconds: int

class WeeklyActivityRecord(BaseModel):
    week_start: date
    watched_seconds: int
    active_days: int

class PlanPerformanceRecord(BaseModel):
    plan_id: uuid.UUID
    title: str
    content_id: str
    content_type: str
    target_completion_date: date
    total_duration_seconds: int
    total_watched_seconds: int
    status: str
    completed_at: Optional[datetime] = None

class RecentActivityRecord(BaseModel):
    activity_date: date
    content_id: str
    content_type: str
    title: Optional[str] = None
    watched_seconds: int

class LearningAnalyticsResponse(BaseModel):
    summary: AnalyticsSummary
    daily_history: List[DailyActivityRecord]
    weekly_history: List[WeeklyActivityRecord]
    plan_performance: List[PlanPerformanceRecord]
    recent_activity: List[RecentActivityRecord]
    streak: Optional[StudyStreakInfo] = None
